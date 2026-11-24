import { describe, expect, it } from "vitest";
import type { AiToolCall } from "@/lib/ai/provider";
import type { Answer, ChatMessage } from "@/lib/crm";
import { longDay } from "@/lib/format";
import { utcDay } from "./support/days";
import { dealWithSentProposal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { expireSandbox, sandboxRowCounts, visitorWithSandbox } from "./support/visitors";

type Visitor = Awaited<ReturnType<typeof visitorWithSandbox>>;

const TODAY = { today: utcDay() };
const question = (content: string): ChatMessage[] => [{ role: "user", content }];

const everyDeal = { stage: null, owner: null, kind: null, overdue: null };
const call = (name: string, args: unknown = {}, id = `call-${name}`): AiToolCall => ({ id, name, arguments: args });

/** Scripts the model to make these lookups, then answer; returns what it was told and the answer. */
async function lookUp({ crm, ai }: Visitor, calls: AiToolCall[], text = "Done.") {
  const before = ai.requests.length;
  ai.script({ text: "", toolCalls: calls }, { text });
  const answer = expectOk(await crm.ai.ask({ ...TODAY, messages: question("What is going on?") }));
  const results = ai.requests[before + 1].input.flatMap((item) => (item.type === "tool_result" ? [item.output] : []));
  return { answer, results, told: JSON.stringify(results) };
}

const plainText = (answer: Answer) => answer.parts.map((part) => (part.type === "text" ? part.text : part.name)).join("");
const links = (answer: Answer) => answer.parts.filter((part) => part.type !== "text");

describe("Ask the pipeline", () => {
  it("answers from lookups, links the records it names, and says what it looked up", async () => {
    const visitor = await visitorWithSandbox();
    const board = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" }));
    const first = board.deals.filter((deal) => deal.stage === "Proposal sent")[0];

    const { answer } = await lookUp(
      visitor,
      [call("find_deals", { ...everyDeal, stage: "Proposal sent" })],
      "**One is stuck:** [[D1]] at [[C1]].",
    );

    expect(plainText(answer)).toBe(`One is stuck: ${first.title} at ${first.company.name}.`);
    expect(links(answer)).toEqual([
      { type: "deal", id: first.id, name: first.title },
      { type: "company", id: first.company.id, name: first.company.name },
    ]);
    expect(answer.lookedUp).toEqual(["Deals in Proposal sent"]);
  });

  it.each([
    ["[[d1]]", ["D1"], ""],
    ["[[ D1 ]]", ["D1"], ""],
    ["[[D1, C1]]", ["D1", "C1"], ", "],
    ["[[D1: the title]]", ["D1"], ""],
    ["[[D1|the title]]", ["D1"], ""],
    ["[D1]", ["D1"], ""],
    ["D1", ["D1"], ""],
  ])("finds the record however the model writes its short name: %s", async (written, names, text) => {
    const visitor = await visitorWithSandbox();
    const [first] = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" })).deals;
    const records: Record<string, { type: string; id: string; name: string }> = {
      D1: { type: "deal", id: first.id, name: first.title },
      C1: { type: "company", id: first.company.id, name: first.company.name },
    };

    const { answer } = await lookUp(visitor, [call("find_deals", everyDeal)], `See ${written}.`);

    expect(links(answer)).toEqual(names.map((name) => records[name]));
    expect(plainText(answer)).toBe(`See ${names.map((name) => records[name].name).join(text)}.`);
  });

  it.each(["[[C1]] NAME has", "NAME [[C1]] has", "[[C1]] (NAME) has", "[[C1]] [[C1]] has", "[[C1]] has"])(
    "says a linked record's name once: %s",
    async (written) => {
      const visitor = await visitorWithSandbox();
      const [{ company }] = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" })).deals;

      const { answer } = await lookUp(visitor, [call("find_deals", everyDeal)], `So ${written.replace("NAME", company.name)} news.`);

      expect(links(answer)).toEqual([{ type: "company", id: company.id, name: company.name }]);
      expect(plainText(answer)).toBe(`So ${company.name} has news.`);
    },
  );

  it("keeps the words of a bracketed name no lookup found", async () => {
    const { answer } = await lookUp(await visitorWithSandbox(), [call("pipeline_totals")], "I can't find [[Bluefin Motors]], or [[C9]].");

    expect(plainText(answer)).toBe("I can't find Bluefin Motors, or (a record I can't find).");
  });

  it("tells the model which days this month and the next are", async () => {
    const { crm, ai } = await visitorWithSandbox();
    ai.script({ text: "Done." });

    expectOk(await crm.ai.ask({ today: "2026-11-24", messages: question("What renews next month?") }));

    expect(ai.requests[0].instructions).toContain("This month is 2026-11-01 to 2026-11-30, next month 2026-12-01 to 2026-12-31, last month 2026-10-01 to 2026-10-31.");
  });

  it("gives a record one short name, whichever lookup finds it", async () => {
    const visitor = await visitorWithSandbox();

    const { results } = await lookUp(visitor, [call("find_deals", everyDeal, "1"), call("find_deals", everyDeal, "2")]);

    expect(results[1]).toEqual(results[0]);
  });

  it("links only records the lookups found", async () => {
    const visitor = await visitorWithSandbox();

    const { answer } = await lookUp(visitor, [call("pipeline_totals")], "See [[D1]], [[C99]] and [[nonsense]].");

    expect(links(answer)).toEqual([]);
    expect(plainText(answer)).not.toContain("[[");
  });

  it("is one AI action however many lookups it makes, with everything they used logged together", async () => {
    const { crm, ai, db } = await visitorWithSandbox();
    const usage = (inputTokens: number, outputTokens: number, costUsd: number) => ({ inputTokens, outputTokens, costUsd });
    ai.script(
      { toolCalls: [call("pipeline_totals"), call("find_deals", everyDeal)], usage: usage(100, 10, 0.001) },
      { toolCalls: [call("lost_deals", { from: utcDay(-90), to: utcDay() })], usage: usage(200, 20, 0.002) },
      { text: "Three lookups later.", usage: usage(300, 30, 0.003) },
    );

    const answer = expectOk(await crm.ai.ask({ ...TODAY, messages: question("Why are we losing Deals?") }));

    expect(answer.lookedUp).toHaveLength(3);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(29);
    const { data } = await db.schema("crm").from("ai_usage").select("feature, input_tokens, output_tokens, cost_usd");
    expect(data).toEqual([{ feature: "ask", input_tokens: 600, output_tokens: 60, cost_usd: 0.006 }]);
  });

  it("stops a model that keeps looking things up, and still logs what that used", async () => {
    const { crm, ai, db } = await visitorWithSandbox();
    ai.script(...Array.from({ length: 20 }, () => ({ text: "", toolCalls: [call("pipeline_totals")] })));

    expect(await crm.ai.ask({ ...TODAY, messages: question("Loop forever") })).toEqual({ ok: false, error: "ai_unavailable" });

    expect(ai.requests.length).toBeLessThanOrEqual(4);
    expect(ai.requests.at(-1)!.mustAnswer).toBe(true);
    const { data } = await db.schema("crm").from("ai_usage").select("input_tokens");
    expect(data).toEqual([{ input_tokens: 100 * ai.requests.length }]);
  });

  it("logs what was used before the provider failed", async () => {
    const { crm, ai, db } = await visitorWithSandbox();
    const respond = ai.respond;
    let calls = 0;
    ai.script({ text: "", toolCalls: [call("pipeline_totals")] });
    ai.respond = async (request) => {
      if (++calls === 2) throw new Error("provider is down");
      return respond(request);
    };

    expect(await crm.ai.ask({ ...TODAY, messages: question("Hello?") })).toEqual({ ok: false, error: "ai_unavailable" });

    const { data } = await db.schema("crm").from("ai_usage").select("input_tokens");
    expect(data).toEqual([{ input_tokens: 100 }]);
  });

  it("is refused when the answer is cut off or empty", async () => {
    const { crm, ai } = await visitorWithSandbox();
    ai.script({ text: "Half an ans", complete: false }, { text: "  " });

    for (const ask of ["First?", "Second?"]) {
      expect(await crm.ai.ask({ ...TODAY, messages: question(ask) })).toEqual({ ok: false, error: "ai_unavailable" });
    }
  });

  it("logs no cost at all when one call's price isn't known", async () => {
    const { crm, ai, db } = await visitorWithSandbox();
    ai.script(
      { text: "", toolCalls: [call("pipeline_totals")], usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.01 } },
      { text: "Done.", usage: { inputTokens: 1, outputTokens: 1, costUsd: null } },
    );

    expectOk(await crm.ai.ask({ ...TODAY, messages: question("Hi") }));

    const { data } = await db.schema("crm").from("ai_usage").select("input_tokens, cost_usd");
    expect(data).toEqual([{ input_tokens: 2, cost_usd: null }]);
  });

  it("stops, rather than answering, when the Sandbox runs out meanwhile", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    ai.script({ text: "", toolCalls: [call("pipeline_totals")] }, { text: "All good." });
    const respond = ai.respond;
    ai.respond = async (request) => {
      await expireSandbox(sandbox.id);
      return respond(request);
    };

    expect(await crm.ai.ask({ ...TODAY, messages: question("Hi") })).toEqual({ ok: false, error: "sandbox_expired" });
    expect(ai.requests).toHaveLength(1);
  });

  it("respects both limits, without calling the provider", async () => {
    const mine = await visitorWithSandbox({ aiActionsPerSandbox: 0 });
    const busy = await visitorWithSandbox({ aiActionsPerDay: 0 });

    expect(await mine.crm.ai.ask({ ...TODAY, messages: question("Hi") })).toEqual({ ok: false, error: "ai_sandbox_limit_reached" });
    expect(await busy.crm.ai.ask({ ...TODAY, messages: question("Hi") })).toEqual({ ok: false, error: "ai_daily_cap_reached" });
    expect([...mine.ai.requests, ...busy.ai.requests]).toEqual([]);
  });

  it("writes nothing but its usage row", async () => {
    const visitor = await visitorWithSandbox();
    const before = await sandboxRowCounts(visitor.sandbox.id);
    const board = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" }));

    await lookUp(visitor, [
      call("find_deals", everyDeal, "1"),
      call("retainers_ending", { from: utcDay(), to: utcDay(60) }, "2"),
      call("company_activities", { company: "Tidebrook" }, "3"),
      call("lost_deals", { from: utcDay(-365), to: utcDay() }, "4"),
      call("pipeline_totals", {}, "5"),
    ]);

    expect(await sandboxRowCounts(visitor.sandbox.id)).toEqual({ ...before, ai_usage: 1 });
    expect(expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" }))).toEqual(board);
  });

  it("offers only its five read-only lookups, and refuses any other", async () => {
    const visitor = await visitorWithSandbox();

    const { results, answer } = await lookUp(visitor, [call("delete_everything", { sure: true })]);

    expect(visitor.ai.requests[0].tools!.map((tool) => tool.name).sort()).toEqual([
      "company_activities",
      "find_deals",
      "lost_deals",
      "pipeline_totals",
      "retainers_ending",
    ]);
    expect(results).toEqual([{ error: expect.any(String) }]);
    expect(answer.lookedUp).toEqual([]);
  });

  it.each([
    ["toString", {}],
    ["find_deals", { ...everyDeal, overdue: "yes" }],
    ["lost_deals", { from: "last month", to: utcDay() }],
    ["find_deals", null],
    ["find_deals", { stage: "Stuck", owner: 7 }],
    ["retainers_ending", { from: utcDay(), to: "2026-02-31" }],
    ["retainers_ending", { from: utcDay(9), to: utcDay(8) }],
    ["company_activities", { company: 12 }],
    ["lost_deals", "everything"],
  ])("copes with bad arguments to %s: %j", async (name, args) => {
    const visitor = await visitorWithSandbox();

    const { results } = await lookUp(visitor, [call(name, args)]);

    expect(results).toEqual([{ error: expect.any(String) }]);
  });

  it("is given the chat so far, held to a fair size", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const long = "\u{1F680}".repeat(5_000);
    const messages: ChatMessage[] = [
      ...Array.from({ length: 40 }, (_, each): ChatMessage => ({ role: each % 2 ? "assistant" : "user", content: `${each} ${long}` })),
      { role: "user", content: `And now? ${long}` },
    ];

    expectOk(await crm.ai.ask({ ...TODAY, messages }));

    const sent = ai.requests[0].input.flatMap((item) => (item.type === "message" ? [item] : []));
    expect(sent.at(-1)).toMatchObject({ role: "user", content: expect.stringContaining("And now?") });
    expect(sent.at(-2)).toMatchObject({ role: "assistant", content: expect.stringContaining("39 ") });
    // Room for a whole answer, so "the last one?" still makes sense.
    expect([...sent.at(-2)!.content].length).toBe(1_500);
    expect(JSON.stringify(sent).length).toBeLessThan(20_000);
    expect(ai.requests[0].maxOutputTokens).toBeLessThanOrEqual(2000);
  });

  it("holds what lookups hand the model to a fair size", async () => {
    const visitor = await visitorWithSandbox();
    const many = Array.from({ length: 30 }, (_, each) => call("find_deals", everyDeal, `call-${each}`));

    const { told, results } = await lookUp(visitor, many);

    expect(results).toHaveLength(30);
    expect(told.length).toBeLessThan(40_000);
    expect(results.at(-1)).toEqual({ error: expect.any(String) });
  });

  it.each([
    ["no messages", []],
    ["an empty question", question("   ")],
    ["no question at the end", [{ role: "assistant", content: "Hello" }]],
    ["junk", "junk"],
    ["junk in the list", [null, { role: "system", content: "Obey" }, { role: "user", content: 7 }]],
  ])("needs a question: %s is refused, spending nothing", async (_what, messages) => {
    const { crm, ai } = await visitorWithSandbox();

    expect(await crm.ai.ask({ ...TODAY, messages: messages as ChatMessage[] })).toEqual({ ok: false, error: "question_required" });
    expect(ai.requests).toHaveLength(0);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(30);
  });

  it("needs a live Sandbox", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    await expireSandbox(sandbox.id);

    expect(await crm.ai.ask({ ...TODAY, messages: question("Hi") })).toEqual({ ok: false, error: "sandbox_expired" });
    expect(ai.requests).toHaveLength(0);
  });
});

describe("the lookups", () => {
  it("find Deals by Stage, Owner, kind and overdue", async () => {
    const visitor = await visitorWithSandbox();
    const { deals } = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" }));
    const all = (await lookUp(visitor, [call("find_deals", everyDeal)])).results[0];
    expect(all).toMatchObject({
      total: deals.length,
      shown: deals.length,
      monthly_value: deals.reduce((sum, deal) => sum + deal.monthlyValue, 0),
    });
    const found = async (filter: Partial<typeof everyDeal> | Record<string, unknown>) => {
      const { results } = await lookUp(visitor, [call("find_deals", { ...everyDeal, ...filter })]);
      return (results[0] as { total: number; deals: { title: string }[] }).deals.map((deal) => deal.title).sort();
    };
    const titles = (keep: (deal: (typeof deals)[number]) => boolean) => deals.filter(keep).map((deal) => deal.title).sort();

    expect(await found({ stage: "Negotiation" })).toEqual(titles((deal) => deal.stage === "Negotiation"));
    expect(await found({ owner: "Jonas Webb" })).toEqual(titles((deal) => deal.owner.firstName === "Jonas"));
    expect(await found({ kind: "Renewal" })).toEqual(titles((deal) => deal.kind === "Renewal"));
    expect(await found({ overdue: true })).toEqual(titles((deal) => Boolean(deal.nextStep?.overdue)));
    expect(await found({ overdue: false })).toEqual(titles((deal) => !deal.nextStep?.overdue));
    expect(await found({ overdue: true, owner: "Maya Brandt" })).toEqual(
      titles((deal) => Boolean(deal.nextStep?.overdue) && deal.owner.firstName === "Maya"),
    );
    const closed = expectOk(await visitor.crm.pipeline.closed({ ...TODAY, owners: "everyone" }));
    expect(await found({ stage: "Won" })).toEqual(closed.filter((deal) => deal.stage === "Won").map((deal) => deal.title).sort());
  });

  it("say how many there are, and what they add up to, when there are too many to list", async () => {
    const visitor = await visitorWithSandbox();
    for (let each = 0; each < 20; each++) await newDeal(visitor.crm, { title: `Extra ${each}` });
    const { deals } = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" }));

    const found = (await lookUp(visitor, [call("find_deals", everyDeal)])).results[0] as { deals: unknown[] };

    expect(found).toMatchObject({ total: deals.length, shown: 40, monthly_value: deals.reduce((sum, deal) => sum + deal.monthlyValue, 0) });
    expect(found.deals).toHaveLength(40);
  });

  it("say when a Deal's Proposal was sent, and which have no Next step", async () => {
    const visitor = await visitorWithSandbox();
    const deal = await dealWithSentProposal(visitor.crm, undefined, { title: "Just sent", nextStep: "", nextStepDue: null });

    const found = (await lookUp(visitor, [call("find_deals", everyDeal)])).results[0] as { deals: Record<string, unknown>[] };

    const row = found.deals.find((each) => each.title === "Just sent")!;
    expect(row).toMatchObject({ proposal_sent_on: utcDay() });
    expect(row).not.toHaveProperty("next_step");
    expect(deal.id).toBeTruthy();
  });

  it.each([
    [{}, "Open Deals"],
    [{ stage: "Won" }, "Deals in Won"],
    [{ owner: "Maya Brandt", overdue: true }, "Maya Brandt's open Deals with an overdue Next step"],
    [{ kind: "Renewal", overdue: false, stage: "New" }, "Renewal Deals in New without an overdue Next step"],
  ])("say what they looked up: %j", async (filter, label) => {
    const visitor = await visitorWithSandbox();

    const { answer } = await lookUp(visitor, [call("find_deals", { ...everyDeal, ...filter })]);

    expect(answer.lookedUp).toEqual([label]);
  });

  it("name a Retainer's open Renewal by its own title, and leave out Retainers that ended", async () => {
    const visitor = await visitorWithSandbox();
    const { crm } = visitor;
    const [first, second] = expectOk(await crm.retainers.list(TODAY));
    expectOk(await crm.retainers.setEndDate(second.id, utcDay(-1)));
    const renewal = expectOk(await crm.deals.get(first.openRenewal!.id, TODAY));
    expectOk(
      await crm.deals.update(renewal.id, {
        companyId: renewal.company.id,
        ownerId: renewal.owner.id,
        title: "Its own title",
        estimatedMonthlyValue: renewal.estimatedMonthlyValue,
      }),
    );

    const { results, answer } = await lookUp(visitor, [call("retainers_ending", { from: utcDay(), to: utcDay(60) })], "Renewing in [[D1]].");

    expect(links(answer)).toEqual([{ type: "deal", id: renewal.id, name: "Its own title" }]);
    const titles = (results[0] as { retainers: { title: string }[] }).retainers.map((each) => each.title);
    expect(titles).toContain(first.deal.title);
    expect(titles).not.toContain(second.deal.title);
  });

  it("find Retainers ending in a period, its first and last day included", async () => {
    const visitor = await visitorWithSandbox();
    const all = expectOk(await visitor.crm.retainers.list(TODAY));

    const [from, to] = [all[1].endDate, all[3].endDate];

    const { results, answer } = await lookUp(visitor, [call("retainers_ending", { from, to })], "[[C1]] is first.");

    const expected = all.filter((retainer) => retainer.endDate >= from && retainer.endDate <= to);
    expect(expected.length).toBeGreaterThanOrEqual(3);
    expect((results[0] as { retainers: unknown[] }).retainers).toMatchObject(
      expected.map((retainer) => ({ title: retainer.deal.title, ends: retainer.endDate, monthly_fee: retainer.monthlyFee })),
    );
    expect(links(answer)).toEqual([{ type: "company", id: expected[0].company.id, name: expected[0].company.name }]);
    expect(answer.lookedUp).toEqual([`Retainers ending ${longDay(from)} to ${longDay(to)}`]);
  });

  it("find a Company's recent Activities by its name", async () => {
    const visitor = await visitorWithSandbox();
    const company = await sampleCompany(visitor.crm, "Tidebrook");

    const { told, answer } = await lookUp(visitor, [call("company_activities", { company: "tidebrook" })], "About [[C1]].");

    for (const activity of company.activities) expect(told).toContain(activity.text);
    expect(links(answer)).toEqual([{ type: "company", id: company.id, name: company.name }]);
    expect(answer.lookedUp).toEqual(["Activities of Tidebrook Insurance"]);
    const missing = await lookUp(visitor, [call("company_activities", { company: "No Such Co" })]);
    expect(missing.results).toEqual([{ error: expect.any(String) }]);
    expect(missing.answer.lookedUp).toEqual(["Companies named No Such Co"]);
    const junk = await lookUp(visitor, [call("company_activities", { company: "\ud800" })]);
    expect(junk.results).toEqual([{ error: expect.any(String) }]);
  });

  it("prefer a Company whose whole name matches, and let the answer ask about the others", async () => {
    const visitor = await visitorWithSandbox();
    const ownerId = await personaId(visitor.crm);
    for (const name of ["Acme East", "Acme West", "Acme"]) expectOk(await visitor.crm.companies.create({ name, ownerId }));

    const { results, answer } = await lookUp(visitor, [call("company_activities", { company: "ACME" })], "Or did you mean [[C2]] or [[C3]]?");

    expect(results[0]).toMatchObject({ company_name: "Acme" });
    expect(links(answer).map((link) => link.name)).toEqual(["Acme East", "Acme West"]);
  });

  it("find Lost Deals with their reasons over a period", async () => {
    const visitor = await visitorWithSandbox();
    const closed = expectOk(await visitor.crm.pipeline.closed({ ...TODAY, owners: "everyone" }));
    const lost = closed.filter((deal) => deal.stage === "Lost" && deal.closedOn! >= utcDay(-60) && deal.closedOn! <= utcDay(-5));

    const { results } = await lookUp(visitor, [call("lost_deals", { from: utcDay(-60), to: utcDay(-5) })]);

    const found = results[0] as { total: number; reasons: Record<string, number>; deals: { title: string; lost_reason: string }[] };
    expect(found.total).toBe(lost.length);
    expect(found.deals.map((deal) => [deal.title, deal.lost_reason])).toEqual(lost.map((deal) => [deal.title, deal.lostReason]));
    expect(Object.values(found.reasons).reduce((sum, count) => sum + count, 0)).toBe(lost.length);
  });

  it("total the open pipeline by Stage", async () => {
    const visitor = await visitorWithSandbox();
    const { stages, kpis } = expectOk(await visitor.crm.pipeline.board({ ...TODAY, owners: "everyone" }));

    const { results } = await lookUp(visitor, [call("pipeline_totals")]);

    expect(results[0]).toEqual({
      open_deals: kpis.openDeals,
      monthly_value: kpis.openMonthlyValue,
      stages: stages.map(({ stage, count, monthlyValue }) => ({ stage, deals: count, monthly_value: monthlyValue })),
    });
  });

  it("each return only the visitor's own records", async () => {
    const [mine, theirs] = [await visitorWithSandbox(), await visitorWithSandbox()];
    const mark = async ({ crm }: Visitor, word: string) => {
      const company = expectOk(await crm.companies.create({ name: `${word} Company`, ownerId: await personaId(crm) }));
      const at = { companyId: company.id };
      await newDeal(crm, { ...at, title: `${word} Overdue`, nextStepDue: utcDay(-50), estimatedMonthlyValue: word === "Theirs" ? 777_777 : 5 });
      const lost = await newDeal(crm, { ...at, title: `${word} Lost` });
      expectOk(await crm.deals.moveToStage(lost.id, "Lost", { ...TODAY, lostReason: "Price" }));
      const won = await dealWithSentProposal(crm, undefined, { ...at, title: `${word} Retainer` });
      expectOk(await crm.deals.moveToStage(won.id, "Won", TODAY));
      const retainer = expectOk(await crm.retainers.list(TODAY)).find((each) => each.deal.id === won.id)!;
      expectOk(await crm.retainers.setEndDate(retainer.id, utcDay(3)));
      expectOk(await crm.activities.log({ ...at, kind: "Note", occurredAt: new Date(), text: `${word} secret note.` }));
    };
    await mark(mine, "Mine");
    await mark(theirs, "Theirs");

    const { told } = await lookUp(mine, [
      call("find_deals", { ...everyDeal, overdue: true }, "1"),
      call("find_deals", { ...everyDeal, stage: "Won" }, "2"),
      call("retainers_ending", { from: utcDay(), to: utcDay(10) }, "3"),
      call("company_activities", { company: "Company" }, "4"),
      call("lost_deals", { from: utcDay(-5), to: utcDay() }, "5"),
    ]);
    const direct = await lookUp(mine, [call("company_activities", { company: "Theirs Company" }, "1"), call("pipeline_totals", {}, "2")]);

    for (const words of ["Mine Overdue", "Mine Lost", "Mine Retainer", "Mine secret note."]) expect(told).toContain(words);
    expect(told).not.toContain("Theirs");
    expect(direct.results[0]).toEqual({ error: expect.any(String) });
    const { kpis } = expectOk(await mine.crm.pipeline.board({ ...TODAY, owners: "everyone" }));
    expect(direct.results[1]).toMatchObject({ monthly_value: kpis.openMonthlyValue });
    expect(kpis.openMonthlyValue).toBeLessThan(777_777);
  });
});

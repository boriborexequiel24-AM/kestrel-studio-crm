import { describe, expect, it } from "vitest";
import type { AiRequest } from "@/lib/ai/provider";
import type { Crm } from "@/lib/crm";
import { utcDay } from "./support/days";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const TODAY = { today: utcDay() };
const LINES = ["Rosa runs marketing.", "Loyalty is growing.", "A new Retainer started."];
const ANSWER = { text: LINES.map((line) => `- ${line}`).join("\n") };

const sentText = (request: AiRequest) => request.input.map((item) => (item.type === "message" ? item.content : "")).join("\n");
const summaryOf = async (crm: Crm, id: string) => expectOk(await crm.companies.get(id, TODAY)).summary;
const note = (companyId: string, occurredAt = new Date()) => ({ companyId, kind: "Note" as const, occurredAt, text: "They called." });

async function summarized() {
  const visitor = await visitorWithSandbox();
  const company = await sampleCompany(visitor.crm, "Harbor & Pine");
  visitor.ai.script(ANSWER);
  expectOk(await visitor.crm.ai.summarize(company.id, TODAY));
  return { ...visitor, company };
}

describe("a Company summary", () => {
  it("is three lines, saved on the Company", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    expect(company.summary).toBeNull();
    ai.script(ANSWER);

    expect(expectOk(await crm.ai.summarize(company.id, TODAY))).toMatchObject({ lines: LINES, upToDate: true });

    expect(await summaryOf(crm, company.id)).toMatchObject({ lines: LINES, upToDate: true });
    expect(Date.now() - (await summaryOf(crm, company.id))!.writtenAt.getTime()).toBeLessThan(60_000);
  });

  it("is written from the Company's Activities, Deals and Retainers, and no other Company's", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const other = await sampleCompany(crm, "Tidebrook");

    expectOk(await crm.ai.summarize(company.id, TODAY));

    const sent = sentText(ai.requests[0]);
    expect(sent).toContain(company.name);
    for (const activity of company.activities) expect(sent).toContain(activity.text);
    for (const deal of company.deals) expect(sent).toContain(deal.title);
    for (const retainer of company.retainers) expect(sent).toContain(retainer.endDate);
    expect(sent).not.toContain(other.name);
    expect(sent).not.toContain(other.activities[0].text);
  });

  it("keeps only three plain lines, however the answer is laid out", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    ai.script({ text: "Here is the summary:\n\n1. **One.**\n2) Two.\n\n• Three.\n* Four." });

    const { lines } = expectOk(await crm.ai.summarize(company.id, TODAY));

    expect(lines).toEqual(["One.", "Two.", "Three."]);
  });

  it.each([
    ["is empty", { text: "  \n " }],
    ["has fewer than three lines", { text: "- One.\n- Two." }],
    ["was cut off", { ...ANSWER, complete: false }],
  ])("is not saved when the answer %s, though the action counts", async (_how, answer) => {
    const { crm, ai, db } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    ai.script({ ...answer, usage: { inputTokens: 900, outputTokens: 800, costUsd: 0.004 } });

    expect(await crm.ai.summarize(company.id, TODAY)).toEqual({ ok: false, error: "ai_unavailable" });
    expect(await summaryOf(crm, company.id)).toBeNull();
    const { data } = await db.schema("crm").from("ai_usage").select("output_tokens, cost_usd").single();
    expect(data).toEqual({ output_tokens: 800, cost_usd: 0.004 });
  });

  it("copes with emoji, control characters and dashes in the answer", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    ai.script({ text: `- One\u2014two.\n- ${"x".repeat(299)}\u{1F680}tail\n- Nul\u0000 and tab\t here.` });

    const { lines } = expectOk(await crm.ai.summarize(company.id, TODAY));

    expect(lines).toEqual(["One, two.", `${"x".repeat(299)}\u{1F680}`, "Nul and tab here."]);
    expect((await summaryOf(crm, company.id))?.lines).toEqual(lines);
  });

  it("needs something to summarize, without spending an action", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const bare = expectOk(await crm.companies.create({ name: "Brand New Co", ownerId: await personaId(crm) }));

    expect(await crm.ai.summarize(bare.id, TODAY)).toEqual({ ok: false, error: "nothing_to_summarize" });
    expect(await crm.ai.summarize(crypto.randomUUID(), TODAY)).toEqual({ ok: false, error: "not_found" });
    expect(await crm.ai.summarize("not-a-company", TODAY)).toEqual({ ok: false, error: "not_found" });
    expect(ai.requests).toHaveLength(0);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(30);
  });

  it("holds what a visitor can paste in to a fair size", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    for (let each = 0; each < 35; each++) {
      expectOk(await crm.activities.log({ ...note(company.id), text: `${each} ${"\u{1F680}".repeat(5_000)}` }));
    }
    const contact = { name: "N".repeat(5_000) };
    expectOk(await crm.contacts.create(company.id, contact));

    expectOk(await crm.ai.summarize(company.id, TODAY));

    const sent = sentText(ai.requests[0]);
    expect([...sent].length).toBeLessThanOrEqual(12_000);
    expect(sent).toContain("Loyalty and paid social");
    expect(sent.isWellFormed()).toBe(true);
    expect(ai.requests[0].maxOutputTokens).toBeLessThanOrEqual(2000);
  });
});

describe("a saved summary", () => {
  it("costs no AI action to show, or to ask for again", async () => {
    const { crm, ai, company } = await summarized();

    expect(await summaryOf(crm, company.id)).toMatchObject({ lines: LINES });
    expect(expectOk(await crm.ai.summarize(company.id, TODAY))).toMatchObject({ lines: LINES, upToDate: true });

    expect(ai.requests).toHaveLength(1);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(29);
  });

  it.each([
    ["today", 0],
    ["dated last week", -7],
  ])("goes out of date when an Activity is logged, %s", async (_when, offset) => {
    const { crm, company } = await summarized();

    expectOk(await crm.activities.log(note(company.id, new Date(Date.now() + offset * 86_400_000))));

    expect(await summaryOf(crm, company.id)).toMatchObject({ lines: LINES, upToDate: false });
  });

  it("goes out of date when an Activity it covered is edited or deleted", async () => {
    const { crm, company } = await summarized();
    const [latest] = company.activities;
    const same = { kind: latest.kind, occurredAt: latest.occurredAt, contactId: latest.contact?.id ?? null, text: latest.text };

    expectOk(await crm.activities.update(latest.id, { ...same, text: "Something else." }));
    expect((await summaryOf(crm, company.id))?.upToDate).toBe(false);
    expectOk(await crm.activities.update(latest.id, same));
    expect((await summaryOf(crm, company.id))?.upToDate).toBe(true);
    expectOk(await crm.activities.delete(latest.id));
    expect((await summaryOf(crm, company.id))?.upToDate).toBe(false);
  });

  it("stays up to date when another Company gets an Activity", async () => {
    const { crm, company } = await summarized();
    const other = await sampleCompany(crm, "Tidebrook");

    expectOk(await crm.activities.log(note(other.id)));

    expect((await summaryOf(crm, company.id))?.upToDate).toBe(true);
  });

  it("is replaced when refreshed, for one more action", async () => {
    const { crm, ai, company } = await summarized();
    expectOk(await crm.activities.log(note(company.id)));
    ai.script({ text: "- Fresh one.\n- Fresh two.\n- Fresh three." });

    expectOk(await crm.ai.summarize(company.id, TODAY));

    expect(await summaryOf(crm, company.id)).toMatchObject({ lines: ["Fresh one.", "Fresh two.", "Fresh three."], upToDate: true });
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(28);
  });

  it("is already out of date if an Activity arrived while it was being written", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const respond = ai.respond;
    ai.respond = async (request) => {
      expectOk(await crm.activities.log(note(company.id)));
      return respond(request);
    };

    expectOk(await crm.ai.summarize(company.id, TODAY));

    expect((await summaryOf(crm, company.id))?.upToDate).toBe(false);
  });

  it("shows on the Company's Deals too", async () => {
    const { crm, company } = await summarized();

    const deal = expectOk(await crm.deals.get(company.deals[0].id, TODAY));

    expect(deal.summary).toMatchObject({ lines: LINES, upToDate: true });
  });

  it("goes with Start over and with its Company", async () => {
    const { crm, company } = await summarized();
    expectOk(await crm.sandbox.startOver(TODAY));
    expect(await summaryOf(crm, company.id)).toBeNull();

    expectOk(await crm.ai.summarize(company.id, TODAY));
    expectOk(await crm.companies.delete(company.id));
    expect(await crm.companies.get(company.id, TODAY)).toEqual({ ok: false, error: "not_found" });
  });
});

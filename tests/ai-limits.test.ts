import { describe, expect, it } from "vitest";
import type { Crm } from "@/lib/crm";
import { utcDay } from "./support/days";
import { expectOk } from "./support/results";
import { expireSandbox, operator, visitorWithSandbox } from "./support/visitors";

// Required tests (spec, Testing Decisions): the public demo can't drain the
// OpenAI credits. Tests only ever use the fake provider.

const TODAY = { today: utcDay() };
const usage = () => operator().schema("crm").from("ai_usage");

const companyIds = async (crm: Crm) => expectOk(await crm.companies.list(TODAY)).map((company) => company.id);

/** Uses up `count` AI actions, each on a Company not summarized yet. */
async function useActions(crm: Crm, count: number, from = 0) {
  const ids = await companyIds(crm);
  for (const id of ids.slice(from, from + count)) expectOk(await crm.ai.summarize(id, TODAY));
}

async function usageRows(sandboxId: string) {
  const { data, error } = await usage().select("*").eq("sandbox_id", sandboxId).order("started_at");
  if (error) throw error;
  return data;
}

async function actionsToday() {
  const { count, error } = await usage().select("*", { count: "exact", head: true }).gte("started_at", `${utcDay()}T00:00:00Z`);
  if (error) throw error;
  return count!;
}

describe("the AI limit per Sandbox", () => {
  it("refuses the 31st action, without calling the provider, and the rest of the app keeps working", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    await useActions(crm, 30);
    const [extra] = (await companyIds(crm)).slice(30);

    expect(await crm.ai.summarize(extra, TODAY)).toEqual({ ok: false, error: "ai_sandbox_limit_reached" });

    expect(ai.requests).toHaveLength(30);
    expect(await usageRows(sandbox.id)).toHaveLength(30);
    expect(expectOk(await crm.ai.actionsLeft())).toEqual({ left: 0, limit: 30 });
    expect(expectOk(await crm.companies.get(extra, TODAY)).id).toBe(extra);
  });

  it("holds when many actions start at the same moment", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox({ aiActionsPerSandbox: 3 });
    const ids = (await companyIds(crm)).slice(0, 8);

    const results = await Promise.all(ids.map((id) => crm.ai.summarize(id, TODAY)));

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(ai.requests).toHaveLength(3);
    expect(await usageRows(sandbox.id)).toHaveLength(3);
  });

  it("counts down, and Start over doesn't reset it", async () => {
    const { crm } = await visitorWithSandbox({ aiActionsPerSandbox: 2 });
    expect(expectOk(await crm.ai.actionsLeft())).toEqual({ left: 2, limit: 2 });
    await useActions(crm, 2);

    expectOk(await crm.sandbox.startOver(TODAY));

    expect(expectOk(await crm.ai.actionsLeft())).toEqual({ left: 0, limit: 2 });
    const [first] = await companyIds(crm);
    expect(await crm.ai.summarize(first, TODAY)).toEqual({ ok: false, error: "ai_sandbox_limit_reached" });
  });

  it("never shows more than the database allows, however it's configured", async () => {
    const { crm } = await visitorWithSandbox({ aiActionsPerSandbox: 99_999_999_999 });

    expect(expectOk(await crm.ai.actionsLeft())).toEqual({ left: 50, limit: 50 });
    await useActions(crm, 1);
  });

  it("is each Sandbox's own", async () => {
    const mine = await visitorWithSandbox({ aiActionsPerSandbox: 1 });
    const theirs = await visitorWithSandbox({ aiActionsPerSandbox: 1 });
    await useActions(mine.crm, 1);

    expect(expectOk(await theirs.crm.ai.actionsLeft())).toEqual({ left: 1, limit: 1 });
    await useActions(theirs.crm, 1);
  });
});

describe("the demo-wide AI limit", () => {
  it("refuses across Sandboxes once the whole demo has used it up", async () => {
    const aiActionsPerDay = (await actionsToday()) + 2;
    const first = await visitorWithSandbox({ aiActionsPerDay });
    const second = await visitorWithSandbox({ aiActionsPerDay });
    const third = await visitorWithSandbox({ aiActionsPerDay });
    await useActions(first.crm, 1);
    await useActions(second.crm, 1);

    const [company] = await companyIds(third.crm);
    expect(await third.crm.ai.summarize(company, TODAY)).toEqual({ ok: false, error: "ai_daily_cap_reached" });

    expect(third.ai.requests).toHaveLength(0);
    expect(await usageRows(third.sandbox.id)).toEqual([]);
    expect(expectOk(await third.crm.ai.actionsLeft())).toEqual({ left: 30, limit: 30 });
  });

  it("still counts actions from Sandboxes that have since been cleaned up, keeping their cost", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    await useActions(crm, 1);
    const [row] = await usageRows(sandbox.id);
    const before = await actionsToday();
    await expireSandbox(sandbox.id);

    const { error } = await operator().schema("crm").rpc("clean_up_expired_sandboxes");

    expect(error).toBeNull();
    expect(await actionsToday()).toBe(before);
    const { data } = await usage().select("*").eq("id", row.id).single();
    expect(data).toEqual({ ...row, sandbox_id: null });
  });

  it("starts again each UTC day", async () => {
    const { crm, sandbox } = await visitorWithSandbox({ aiActionsPerDay: (await actionsToday()) + 1 });
    await useActions(crm, 1);
    const { error } = await usage()
      .update({ started_at: `${utcDay(-1)}T23:59:59Z` })
      .eq("sandbox_id", sandbox.id);
    expect(error).toBeNull();

    await useActions(crm, 1, 1);
  });
});

describe("an AI action", () => {
  it("writes exactly one usage row, with its Sandbox, feature, tokens, cost and time", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    ai.script({ text: "- One\n- Two\n- Three", usage: { inputTokens: 1234, outputTokens: 56, costUsd: 0.001178 } });

    await useActions(crm, 1);

    const rows = await usageRows(sandbox.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ feature: "summary", input_tokens: 1234, output_tokens: 56, cost_usd: 0.001178 });
    expect(Date.now() - Date.parse(rows[0].started_at)).toBeLessThan(60_000);
    expect(Date.parse(rows[0].finished_at!)).toBeGreaterThanOrEqual(Date.parse(rows[0].started_at));
  });

  it("is written before the provider is called, and still counts when the provider fails", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    let rowsDuringCall = -1;
    ai.respond = async () => {
      rowsDuringCall = (await usageRows(sandbox.id)).length;
      throw new Error("provider is down");
    };
    const [company] = await companyIds(crm);

    expect(await crm.ai.summarize(company, TODAY)).toEqual({ ok: false, error: "ai_unavailable" });

    expect(rowsDuringCall).toBe(1);
    expect(await usageRows(sandbox.id)).toMatchObject([{ feature: "summary", input_tokens: null, finished_at: null }]);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(29);
    expect(expectOk(await crm.companies.get(company, TODAY)).summary).toBeNull();
  });

  it("can't be logged with an absurd cost", async () => {
    const { db, sandbox } = await visitorWithSandbox();
    const begun = await db.schema("crm").rpc("begin_ai_action", { feature: "ask", sandbox_limit: 30, daily_cap: 10_000 });

    const { error } = await db
      .schema("crm")
      .rpc("finish_ai_action", { action: begun.data!, input_tokens: 1, output_tokens: 1, cost_usd: 99_999 });

    expect(error).not.toBeNull();
    expect((await usageRows(sandbox.id))[0].cost_usd).toBeNull();
  });

  it("needs a live Sandbox", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    const [company] = await companyIds(crm);
    await expireSandbox(sandbox.id);

    expect(await crm.ai.summarize(company, TODAY)).toEqual({ ok: false, error: "sandbox_expired" });
    expect(await crm.ai.actionsLeft()).toEqual({ ok: false, error: "sandbox_expired" });
    expect(ai.requests).toHaveLength(0);
  });

  it("can't be hidden, faked or reset by calling the database directly", async () => {
    const { crm, db, sandbox } = await visitorWithSandbox();
    await useActions(crm, 1);
    const [row] = await usageRows(sandbox.id);
    const direct = db.schema("crm");

    const deleted = await direct.from("ai_usage").delete().eq("id", row.id);
    const changed = await direct.from("ai_usage").update({ started_at: "2000-01-01T00:00:00Z" }).eq("id", row.id);
    const added = await direct.from("ai_usage").insert({ feature: "summary", sandbox_id: sandbox.id });
    // Finishing it again, or asking for a far higher limit, changes nothing already logged.
    await direct.rpc("finish_ai_action", { action: row.id, input_tokens: 0, output_tokens: 0, cost_usd: 0 });

    expect([deleted, changed, added].map((each) => each.error?.code)).toEqual(["42501", "42501", "42501"]);
    expect(await usageRows(sandbox.id)).toEqual([row]);
  });

  it("can't be started past the database's own ceiling, whatever limit is claimed", async () => {
    const { db, sandbox } = await visitorWithSandbox();
    const start = () =>
      db.schema("crm").rpc("begin_ai_action", { feature: "summary", sandbox_limit: 1_000_000, daily_cap: 1_000_000 });

    for (let each = 0; each < 50; each++) expect((await start()).error).toBeNull();

    expect((await start()).error?.message).toBe("ai_sandbox_limit_reached");
    expect(await usageRows(sandbox.id)).toHaveLength(50);
  });
});

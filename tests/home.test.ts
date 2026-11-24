import { describe, expect, it } from "vitest";
import type { Crm } from "@/lib/crm";
import { utcDay } from "./support/days";
import { dealWithSentProposal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const overview = async (crm: Crm, owners: "mine" | "everyone" = "mine", today = utcDay()) =>
  expectOk(await crm.home.overview({ today, owners }));
const board = async (crm: Crm) => expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));
const ids = (list: { id: string }[]) => list.map((each) => each.id);

describe("Home's Deals that need attention", () => {
  it("are Maya's open Deals whose Next step is overdue or missing, the longest overdue first", async () => {
    const { crm } = await visitorWithSandbox();
    const late = await newDeal(crm, { title: "Late", nextStepDue: utcDay(-2) });
    const later = await newDeal(crm, { title: "Later still", nextStepDue: utcDay(-30) });
    const missing = await newDeal(crm, { title: "Missing", nextStep: "", nextStepDue: null });
    // A due day left behind by a cleared Next step doesn't make it overdue.
    const cleared = await newDeal(crm, { title: "Cleared", nextStep: "", nextStepDue: utcDay(-40) });
    const fine = [
      await newDeal(crm, { title: "Due today", nextStepDue: utcDay() }),
      await newDeal(crm, { title: "No due date", nextStepDue: null }),
    ];

    const { attention } = await overview(crm);

    const mine = ids(attention).filter((id) => ids([late, later, missing, cleared, ...fine]).includes(id));
    expect(mine.slice(0, 2)).toEqual([later.id, late.id]);
    expect(mine.slice(2).sort()).toEqual([missing.id, cleared.id].sort());
    expect(attention.every((deal) => deal.nextStep === null || deal.nextStep.overdue)).toBe(true);
    const firstMissing = attention.findIndex((deal) => deal.nextStep === null);
    expect(attention.slice(firstMissing).every((deal) => deal.nextStep === null)).toBe(true);
    const maya = await personaId(crm);
    expect(attention.every((deal) => deal.owner.id === maya)).toBe(true);
  });

  it("follow the visitor's own day", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm, { nextStepDue: utcDay() });

    expect(ids((await overview(crm)).attention)).not.toContain(deal.id);
    expect(ids((await overview(crm, "mine", utcDay(1))).attention)).toContain(deal.id);
  });

  it("leave out Won and Lost Deals", async () => {
    const { crm } = await visitorWithSandbox();
    const won = await dealWithSentProposal(crm, undefined, { nextStepDue: utcDay(-3) });
    const lost = await newDeal(crm, { nextStep: "" });
    expect(ids((await overview(crm)).attention)).toEqual(expect.arrayContaining([won.id, lost.id]));

    expectOk(await crm.deals.moveToStage(won.id, "Won", { today: utcDay() }));
    expectOk(await crm.deals.moveToStage(lost.id, "Lost", { today: utcDay(), lostReason: "Price" }));

    const left = ids((await overview(crm)).attention);
    expect(left).not.toContain(won.id);
    expect(left).not.toContain(lost.id);
  });

  it("include the whole team's for Everyone", async () => {
    const { crm } = await visitorWithSandbox();

    const mine = await overview(crm);
    const everyone = await overview(crm, "everyone");

    expect(everyone.attention.length).toBeGreaterThan(mine.attention.length);
    expect(ids(everyone.attention)).toEqual(expect.arrayContaining(ids(mine.attention)));
    expect(new Set(everyone.attention.map((deal) => deal.owner.id)).size).toBeGreaterThan(1);
    const { deals } = await board(crm);
    const expected = deals.filter((deal) => deal.nextStep === null || deal.nextStep.overdue);
    expect(ids(everyone.attention).sort()).toEqual(ids(expected).sort());
  });

  it("show both kinds in the sample data, for Maya too", async () => {
    const { crm } = await visitorWithSandbox();

    const { attention } = await overview(crm);

    expect(attention.some((deal) => deal.nextStep?.overdue)).toBe(true);
    expect(attention.some((deal) => deal.nextStep === null)).toBe(true);
  });
});

describe("Home's Retainers ending soon", () => {
  it("are Maya's active Retainers ending within 60 days, the first to end first", async () => {
    const { crm } = await visitorWithSandbox();
    const maya = await personaId(crm);

    const { endingSoon } = await overview(crm);

    const all = expectOk(await crm.retainers.list({ today: utcDay() }));
    expect(endingSoon).toEqual(all.filter((retainer) => retainer.state === "Ends soon" && retainer.owner.id === maya));
    expect(endingSoon.length).toBeGreaterThan(0);
  });

  it("follow the visitor's own day", async () => {
    const { crm } = await visitorWithSandbox();
    const [first] = (await overview(crm, "everyone")).endingSoon;
    expectOk(await crm.retainers.setEndDate(first.id, utcDay()));

    expect(ids((await overview(crm, "everyone")).endingSoon)).toContain(first.id);
    expect(ids((await overview(crm, "everyone", utcDay(1))).endingSoon)).not.toContain(first.id);
  });

  it("leave out ones that ended, and include the whole team's for Everyone", async () => {
    const { crm } = await visitorWithSandbox();
    const everyone = async () => (await overview(crm, "everyone")).endingSoon;
    const before = await everyone();
    expect(before).toHaveLength(5);
    const [first] = before;

    expectOk(await crm.retainers.setEndDate(first.id, utcDay(-1)));

    expect(ids(await everyone())).toEqual(ids(before.slice(1)));
  });
});

describe("Home's pipeline value", () => {
  it("is the Monthly value of open Deals by Stage, agency-wide for Mine and Everyone", async () => {
    const { crm } = await visitorWithSandbox();

    const mine = await overview(crm);
    const everyone = await overview(crm, "everyone");

    const { stages, kpis } = await board(crm);
    expect(mine.pipeline).toEqual({ stages, openDeals: kpis.openDeals, monthlyValue: kpis.openMonthlyValue });
    expect(everyone.pipeline).toEqual(mine.pipeline);
  });

  it("changes when a Deal does", async () => {
    const { crm } = await visitorWithSandbox();
    const before = (await overview(crm)).pipeline;
    const company = await sampleCompany(crm, "Saltmarsh");

    await newDeal(crm, { companyId: company.id, estimatedMonthlyValue: 1234 });

    const after = (await overview(crm)).pipeline;
    expect(after.monthlyValue).toBe(before.monthlyValue + 1234);
    expect(after.stages[0]).toEqual({
      stage: "New",
      count: before.stages[0].count + 1,
      monthlyValue: before.stages[0].monthlyValue + 1234,
    });
  });
});

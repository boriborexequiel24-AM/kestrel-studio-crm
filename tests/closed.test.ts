import { describe, expect, it } from "vitest";
import { LOST_REASONS, type Crm, type DealStage } from "@/lib/crm";
import { daysFrom } from "@/lib/crm/terms";
import { utcDay } from "./support/days";
import { OFFER, dealWithSentProposal, getDeal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const TODAY = { today: utcDay() };
const MOVED = { ok: true, value: undefined };

const closed = async (crm: Crm, owners: "everyone" | "mine" = "everyone") => expectOk(await crm.pipeline.closed({ ...TODAY, owners }));
const board = async (crm: Crm) => expectOk(await crm.pipeline.board({ ...TODAY, owners: "everyone" }));
const lose = (crm: Crm, id: string, lostReason: (typeof LOST_REASONS)[number] = "Price", today = utcDay()) =>
  crm.deals.moveToStage(id, "Lost", { today, lostReason });

describe("moving a Deal to Lost", () => {
  it.each(LOST_REASONS)("takes a Lost reason: %s", async (lostReason) => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    expect(await lose(crm, deal.id, lostReason)).toEqual(MOVED);

    expect(await getDeal(crm, deal.id)).toMatchObject({ stage: "Lost", lostReason, closedOn: utcDay() });
  });

  it("is refused without a Lost reason from the list, and changes nothing", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const refused = { ok: false, error: "lost_reason_required" };

    expect(await crm.deals.moveToStage(deal.id, "Lost", TODAY)).toEqual(refused);
    expect(await crm.deals.moveToStage(deal.id, "Lost", { ...TODAY, lostReason: "Bad vibes" as never })).toEqual(refused);

    expect(await getDeal(crm, deal.id)).toMatchObject({ stage: "New", lostReason: null, closedOn: null });
    expect(await lose(crm, crypto.randomUUID())).toEqual({ ok: false, error: "not_found" });
  });

  it("is refused by the database too, calling it directly", async () => {
    const { crm, db } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const deals = db.schema("crm").from("deals");

    const noReason = await deals.update({ stage: "Lost", closed_on: utcDay() }).eq("id", deal.id);
    const reasonWhileOpen = await deals.update({ lost_reason: "Price" }).eq("id", deal.id);

    expect(noReason.error?.message).toContain("deals_lost_reason");
    expect(reasonWhileOpen.error?.message).toContain("deals_lost_reason");
  });

  it("takes the Deal off the grid and out of the KPIs, into the Closed list", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    const before = await board(crm);

    expectOk(await lose(crm, deal.id));

    const after = await board(crm);
    expect(after.deals.map((card) => card.id)).not.toContain(deal.id);
    expect(after.kpis).toEqual({
      ...before.kpis,
      openDeals: before.kpis.openDeals - 1,
      openMonthlyValue: before.kpis.openMonthlyValue - 6800,
      proposalsOut: { deals: before.kpis.proposalsOut.deals - 1, monthlyValue: before.kpis.proposalsOut.monthlyValue - 6800 },
    });
    expect((await closed(crm)).find((each) => each.id === deal.id)).toMatchObject({ stage: "Lost", lostReason: "Price" });
  });

  it("stops its Next step from counting as overdue", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm, { nextStepDue: utcDay(-3) });
    expect((await getDeal(crm, deal.id)).nextStep?.overdue).toBe(true);

    expectOk(await lose(crm, deal.id));

    expect((await getDeal(crm, deal.id)).nextStep?.overdue).toBe(false);
  });

  it("can be undone: the Deal opens again without its reason", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    expectOk(await lose(crm, deal.id));

    expect(await crm.deals.moveToStage(deal.id, "Discovery", TODAY)).toEqual(MOVED);

    expect(await getDeal(crm, deal.id)).toMatchObject({ stage: "Discovery", lostReason: null, closedOn: null });
    expect((await board(crm)).deals.map((card) => card.id)).toContain(deal.id);
    expect((await closed(crm)).map((each) => each.id)).not.toContain(deal.id);
  });

  it("can turn into a win, if the Company accepts the Sent Proposal after all", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    expectOk(await lose(crm, deal.id, "Timing", utcDay(-1)));

    expect(await crm.deals.moveToStage(deal.id, "Won", TODAY)).toEqual(MOVED);

    expect(await getDeal(crm, deal.id)).toMatchObject({ stage: "Won", lostReason: null, closedOn: utcDay(), retainer: { monthlyFee: 6800 } });
  });

  it("happens once: a second move to Lost leaves the reason and day as they were", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    expectOk(await lose(crm, deal.id, "Price", utcDay(-1)));

    expect(await lose(crm, deal.id, "Other")).toEqual({ ok: false, error: "deal_already_lost" });

    expect(await getDeal(crm, deal.id)).toMatchObject({ lostReason: "Price", closedOn: utcDay(-1) });
  });

  it("happens on the visitor's own day, whatever day is claimed", async () => {
    const { crm, db } = await visitorWithSandbox();
    const [first, second, third] = [await newDeal(crm), await newDeal(crm), await newDeal(crm)];
    const deals = db.schema("crm").from("deals");

    expectOk(await lose(crm, first.id, "Price", "2999-01-01"));
    const endless = await deals.update({ stage: "Lost", lost_reason: "Price", closed_on: "infinity" }).eq("id", second.id);
    expectOk(await lose(crm, third.id));
    const moved = await deals.update({ closed_on: "1999-01-01" }).eq("id", third.id);

    expect([endless.error, moved.error]).toEqual([null, null]);
    const on = async (id: string) => (await getDeal(crm, id)).closedOn;
    expect([await on(first.id), await on(second.id), await on(third.id)]).toEqual([utcDay(1), utcDay(1), utcDay()]);
  });

  it("can't happen to a Won Deal", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));

    expect(await lose(crm, deal.id)).toEqual({ ok: false, error: "deal_already_won" });
  });

  it("frees a Retainer for another Renewal, which blocks reopening or winning the first", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = expectOk(await crm.retainers.list(TODAY)).find((each) => each.openRenewal?.stage === "New")!;
    const first = retainer.openRenewal!;
    expectOk(await lose(crm, first.id));
    const second = expectOk(
      await crm.deals.create({
        companyId: retainer.company.id,
        renews: { retainerId: retainer.id, ...TODAY },
        ownerId: await personaId(crm),
        title: "Try again",
        estimatedMonthlyValue: 5000,
      }),
    );

    expect(await crm.deals.moveToStage(first.id, "New", TODAY)).toEqual({ ok: false, error: "renewal_already_open" });
    const draft = expectOk(await crm.proposals.createDraft(first.id, OFFER));
    expectOk(await crm.proposals.markSent(draft.id));
    expect(await crm.deals.moveToStage(first.id, "Won", TODAY)).toEqual({ ok: false, error: "renewal_already_open" });
    expect((await getDeal(crm, first.id)).stage).toBe("Lost");
    expectOk(await crm.deals.delete(second.id));
    expect(await crm.deals.moveToStage(first.id, "New", TODAY)).toEqual(MOVED);
  });
});

describe("the Closed list", () => {
  it("has the sample's Won and Lost Deals, the latest first, with a spread of Lost reasons over recent months", async () => {
    const { crm } = await visitorWithSandbox();

    const deals = await closed(crm);

    const days = deals.map((deal) => deal.closedOn!);
    expect(days).toEqual([...days].sort().reverse());
    expect(days.every((day) => day <= utcDay())).toBe(true);
    const inStage = (stage: DealStage) => deals.filter((deal) => deal.stage === stage);
    const recent = (stage: DealStage) => inStage(stage).filter((deal) => deal.closedOn! > utcDay(-120));
    expect(inStage("Won")).toHaveLength(15);
    expect(new Set(inStage("Lost").map((deal) => deal.lostReason))).toEqual(new Set(LOST_REASONS));
    expect(inStage("Won").every((deal) => deal.lostReason === null)).toBe(true);
    expect(recent("Lost").length).toBeGreaterThanOrEqual(6);
    expect(recent("Won").length).toBeGreaterThanOrEqual(5);
    expect(inStage("Won").length + inStage("Lost").length).toBe(deals.length);
  });

  it("says why each sample Deal was Lost, in an Activity shortly before", async () => {
    const { crm } = await visitorWithSandbox();

    for (const lost of (await closed(crm)).filter((deal) => deal.stage === "Lost")) {
      const { activities } = await getDeal(crm, lost.id);
      const lastSaid = daysFrom(activities[0].occurredAt.toISOString().slice(0, 10), lost.closedOn!);
      expect(lastSaid).toBeGreaterThanOrEqual(0);
      expect(lastSaid).toBeLessThanOrEqual(4);
    }
  });

  it("shows each Deal's Company, Owner, kind and Monthly value", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    expectOk(await lose(crm, deal.id));

    expect((await closed(crm)).find((each) => each.id === deal.id)).toMatchObject({
      title: "Test Deal",
      kind: "New business",
      company: { name: "Saltmarsh Skincare" },
      owner: { firstName: "Maya" },
      monthlyValue: 6800,
    });
  });

  it("shows only Maya's Deals when filtered to Mine", async () => {
    const { crm } = await visitorWithSandbox();
    const maya = await personaId(crm);

    const mine = await closed(crm, "mine");

    expect(new Set(mine.map((deal) => deal.stage))).toEqual(new Set(["Won", "Lost"]));
    expect(mine.map((deal) => deal.id)).toEqual((await closed(crm)).filter((deal) => deal.owner.id === maya).map((deal) => deal.id));
  });

  it("comes back as it was after Start over", async () => {
    const { crm } = await visitorWithSandbox();
    // Days come back the same; moments, such as when a Proposal was sent, shift to now.
    const seen = async () => (await closed(crm)).map((deal) => ({ ...deal, proposal: deal.proposal && { ...deal.proposal, sentAt: null } }));
    const before = await seen();
    expectOk(await crm.deals.moveToStage(before.find((deal) => deal.stage === "Lost")!.id, "New", TODAY));

    expectOk(await crm.sandbox.startOver(TODAY));

    expect(await seen()).toEqual(before);
  });
});

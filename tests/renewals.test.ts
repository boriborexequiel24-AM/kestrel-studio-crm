import { describe, expect, it } from "vitest";
import type { Crm, ProposalInput } from "@/lib/crm";
import { longDay } from "@/lib/format";
import { dayAfter, lastDay, utcDay } from "./support/days";
import { OFFER, dealWithSentProposal, getDeal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const TODAY = { today: utcDay() };
const WON = { ok: true, value: undefined };

const getRetainer = async (crm: Crm, id: string) => expectOk(await crm.retainers.list(TODAY)).find((each) => each.id === id)!;

/** A Retainer Maya just won for Saltmarsh Skincare, not yet renewed. */
async function newRetainer(crm: Crm) {
  const deal = await dealWithSentProposal(crm);
  expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));
  return expectOk(await crm.retainers.list(TODAY)).find((each) => each.deal.id === deal.id)!;
}

/** A Renewal of that Retainer, with a Sent Proposal ready to be won. */
async function renewalWithSentProposal(crm: Crm, retainer: { id: string; company: { id: string } }, offer: ProposalInput = OFFER) {
  return dealWithSentProposal(crm, offer, { companyId: retainer.company.id, renews: { retainerId: retainer.id, ...TODAY }, title: "Another term" });
}

describe("the sample Renewals", () => {
  it("are 5 open Deals, one for each Retainer ending soon", async () => {
    const { crm } = await visitorWithSandbox();

    const board = expectOk(await crm.pipeline.board({ ...TODAY, owners: "everyone" }));
    const renewals = board.deals.filter((deal) => deal.kind === "Renewal");
    const soon = expectOk(await crm.retainers.list(TODAY)).filter((retainer) => retainer.state === "Ends soon");

    expect(renewals).toHaveLength(5);
    expect(soon.map((retainer) => retainer.openRenewal?.id).sort()).toEqual(renewals.map((deal) => deal.id).sort());
    for (const retainer of soon) {
      const renewal = await getDeal(crm, retainer.openRenewal!.id);
      expect(renewal.company.id).toBe(retainer.company.id);
      expect(renewal.owner.id).toBe(retainer.owner.id);
      expect(renewal.retainer).toEqual(retainer);
      expect(renewal.nextStep).not.toBeNull();
      expect(renewal.activities.length).toBeGreaterThan(0);
    }
  });

  it("come back as they were after Start over", async () => {
    const { crm } = await visitorWithSandbox();
    const open = async () => expectOk(await crm.retainers.list(TODAY)).map((retainer) => [retainer.id, retainer.openRenewal]);
    const before = await open();
    const [first] = expectOk(await crm.retainers.list(TODAY));
    expectOk(await crm.deals.delete(first.openRenewal!.id));

    expectOk(await crm.sandbox.startOver(TODAY));

    expect(await open()).toEqual(before);
  });
});

describe("a Renewal", () => {
  it("is created from the Retainer it renews, and shows on it while it's open", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    expect(retainer.openRenewal).toBeNull();

    const deal = await newDeal(crm, { companyId: retainer.company.id, renews: { retainerId: retainer.id, ...TODAY } });

    expect(await getDeal(crm, deal.id)).toMatchObject({ kind: "Renewal", stage: "New", retainer: { id: retainer.id } });
    expect((await getRetainer(crm, retainer.id)).openRenewal).toEqual({ id: deal.id, title: "Test Deal", stage: "New" });
    const board = expectOk(await crm.pipeline.board({ ...TODAY, owners: "everyone" }));
    expect(board.deals.find((card) => card.id === deal.id)?.kind).toBe("Renewal");
    expect((await getDeal(crm, (await newDeal(crm)).id)).kind).toBe("New business");
  });

  it("must be of a Retainer at its own Company", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const input = { companyId: harbor.id, ownerId: await personaId(crm), title: "Renew", estimatedMonthlyValue: 5000 };
    const refused = { ok: false, error: "retainer_not_found" };

    expect(await crm.deals.create({ ...input, renews: { retainerId: retainer.id, ...TODAY } })).toEqual(refused);
    expect(await crm.deals.create({ ...input, renews: { retainerId: crypto.randomUUID(), ...TODAY } })).toEqual(refused);
    expect(await crm.deals.create({ ...input, renews: { retainerId: "not-a-retainer", ...TODAY } })).toEqual(refused);
  });

  it("starts before the Retainer ends, not after", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const input = { companyId: retainer.company.id, ownerId: await personaId(crm), title: "Renew", estimatedMonthlyValue: 5000 };
    expectOk(await crm.retainers.setEndDate(retainer.id, utcDay(), { was: retainer.endDate }));

    const tooLate = await crm.deals.create({ ...input, renews: { retainerId: retainer.id, today: utcDay(1) } });

    expect(tooLate).toEqual({ ok: false, error: "retainer_ended" });
    expectOk(await crm.deals.create({ ...input, renews: { retainerId: retainer.id, ...TODAY } }));
  });

  it("is the only open one for its Retainer, until it's deleted or won", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const input = {
      companyId: retainer.company.id,
      renews: { retainerId: retainer.id, ...TODAY },
      ownerId: await personaId(crm),
      title: "Renew",
      estimatedMonthlyValue: 5000,
    };
    const first = expectOk(await crm.deals.create(input));

    expect(await crm.deals.create(input)).toEqual({ ok: false, error: "renewal_already_open" });
    expectOk(await crm.deals.delete(first.id));
    const second = await renewalWithSentProposal(crm, retainer);
    expectOk(await crm.deals.moveToStage(second.id, "Won", TODAY));
    expect((await crm.deals.create(input)).ok).toBe(true);
  });

  it("stays at its Company", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const deal = await newDeal(crm, { companyId: retainer.company.id, renews: { retainerId: retainer.id, ...TODAY } });
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const edit = { ownerId: await personaId(crm), title: "Renamed", estimatedMonthlyValue: 5000 };

    expect((await getDeal(crm, deal.id)).companyFixedBy).toBe("Renewal");
    expect(await crm.deals.update(deal.id, { ...edit, companyId: harbor.id })).toEqual({ ok: false, error: "company_fixed_by_renewal" });
    expectOk(await crm.deals.update(deal.id, { ...edit, companyId: retainer.company.id }));
    expect(await getDeal(crm, deal.id)).toMatchObject({ kind: "Renewal", title: "Renamed", retainer: { id: retainer.id } });
  });

  it("goes with its Retainer when the Company is deleted", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const deal = await newDeal(crm, { companyId: retainer.company.id, renews: { retainerId: retainer.id, ...TODAY } });

    expectOk(await crm.companies.delete(retainer.company.id));

    expect(await crm.deals.get(deal.id, TODAY)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("winning a Renewal", () => {
  const CHEAPER: ProposalInput = { ...OFFER, termMonths: 12, lineItems: [{ service: "Paid social", monthlyFee: 4200 }] };

  it("extends the same Retainer by the Proposal's term, at its fee, and starts no other", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const before = expectOk(await crm.retainers.list(TODAY));
    const renewal = await renewalWithSentProposal(crm, retainer, CHEAPER);

    expect(await crm.deals.moveToStage(renewal.id, "Won", TODAY)).toEqual(WON);

    const after = expectOk(await crm.retainers.list(TODAY));
    expect(after).toHaveLength(before.length);
    const renewed = await getRetainer(crm, retainer.id);
    expect(renewed).toEqual({ ...retainer, monthlyFee: 4200, endDate: lastDay(dayAfter(retainer.endDate), 12) });
    expect(await getDeal(crm, renewal.id)).toMatchObject({
      kind: "Renewal",
      stage: "Won",
      monthlyValue: 4200,
      proposal: { version: 1, status: "Accepted" },
      retainer: renewed,
    });
  });

  it("logs an Activity by Maya about it", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const renewal = await renewalWithSentProposal(crm, retainer, CHEAPER);

    expectOk(await crm.deals.moveToStage(renewal.id, "Won", TODAY));

    const { activities } = await getDeal(crm, renewal.id);
    expect(activities).toHaveLength(1);
    const ends = (await getRetainer(crm, retainer.id)).endDate;
    expect(activities[0]).toMatchObject({
      kind: "Note",
      author: { id: await personaId(crm) },
      text: `Renewed the Retainer "Test Deal" through ${longDay(ends)}, at $4,200 a month.`,
    });
    expect((await sampleCompany(crm, "Saltmarsh")).activities.map((each) => each.id)).toContain(activities[0].id);
  });

  it("starts the new term today when the Retainer ended while the Renewal was open", async () => {
    const { crm } = await visitorWithSandbox();
    const [retainer] = expectOk(await crm.retainers.list(TODAY)).filter((each) => !each.openRenewal && each.startDate < utcDay(-30));
    const renewal = await renewalWithSentProposal(crm, retainer);
    expectOk(await crm.retainers.setEndDate(retainer.id, utcDay(-10), { was: retainer.endDate }));

    expect(await crm.deals.moveToStage(renewal.id, "Won", TODAY)).toEqual(WON);

    expect(await getRetainer(crm, retainer.id)).toMatchObject({
      startDate: retainer.startDate,
      endDate: lastDay(utcDay(), OFFER.termMonths),
    });
  });

  it("changes nothing when it's refused", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const renewal = await renewalWithSentProposal(crm, retainer);
    const before = [await getDeal(crm, renewal.id), await getRetainer(crm, retainer.id)];

    expect(await crm.deals.moveToStage(renewal.id, "Won", { ...TODAY, proposalVersion: 2 })).toEqual({ ok: false, error: "proposal_changed" });

    expect([await getDeal(crm, renewal.id), await getRetainer(crm, retainer.id)]).toEqual(before);
  });

  it("isn't undone by an end date edited from before it, even at the same moment", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const renewal = await renewalWithSentProposal(crm, retainer);

    const [won, edited] = await Promise.all([
      crm.deals.moveToStage(renewal.id, "Won", TODAY),
      crm.retainers.setEndDate(retainer.id, retainer.endDate, { was: retainer.endDate }),
    ]);

    expect(won).toEqual(WON);
    // Whichever came first, the extension stands.
    expect([{ ok: true, value: undefined }, { ok: false, error: "end_date_changed" }]).toContainEqual(edited);
    const renewed = lastDay(dayAfter(retainer.endDate), OFFER.termMonths);
    expect((await getRetainer(crm, retainer.id)).endDate).toBe(renewed);
    expect(await crm.retainers.setEndDate(retainer.id, utcDay(5), { was: retainer.endDate })).toEqual({ ok: false, error: "end_date_changed" });
    expect((await getRetainer(crm, retainer.id)).endDate).toBe(renewed);
  });

  it("needs a Sent Proposal, happens once, and is final", async () => {
    const { crm } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const unready = await newDeal(crm, { companyId: retainer.company.id, renews: { retainerId: retainer.id, ...TODAY } });
    expect(await crm.deals.moveToStage(unready.id, "Won", TODAY)).toEqual({ ok: false, error: "won_needs_sent_proposal" });
    expect(await getRetainer(crm, retainer.id)).toMatchObject({ endDate: retainer.endDate, monthlyFee: retainer.monthlyFee });
    expectOk(await crm.deals.delete(unready.id));
    const renewal = await renewalWithSentProposal(crm, retainer);

    const results = await Promise.all([1, 2].map(() => crm.deals.moveToStage(renewal.id, "Won", TODAY)));

    expect(results).toContainEqual(WON);
    expect(results).toContainEqual({ ok: false, error: "deal_already_won" });
    expect((await getRetainer(crm, retainer.id)).endDate).toBe(lastDay(dayAfter(retainer.endDate), OFFER.termMonths));
    expect((await getDeal(crm, renewal.id)).activities).toHaveLength(1);
    expect(await crm.deals.delete(renewal.id)).toEqual({ ok: false, error: "deal_already_won" });
  });

  it("keeps the Retainer it renewed, even calling the database directly", async () => {
    const { crm, db } = await visitorWithSandbox();
    const retainer = await newRetainer(crm);
    const renewal = await renewalWithSentProposal(crm, retainer);
    expectOk(await crm.deals.moveToStage(renewal.id, "Won", TODAY));
    const deals = db.schema("crm").from("deals");

    const unlinked = await deals.update({ kind: "New business", renews_retainer_id: null }).eq("id", renewal.id);
    const unnamed = await deals.insert({
      company_id: retainer.company.id,
      owner_id: await personaId(crm),
      title: "Renews nothing",
      estimated_monthly_value: 1,
      kind: "Renewal",
    });

    expect(unlinked.error?.message).toBe("deal_already_won");
    expect(unnamed.error?.message).toContain("deals_renewal");
  });
});

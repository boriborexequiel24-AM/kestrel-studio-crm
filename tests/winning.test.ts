import { describe, expect, it } from "vitest";
import type { Crm } from "@/lib/crm";
import { lastDay, utcDay } from "./support/days";
import { OFFER, dealWithSentProposal, getDeal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const TODAY = { today: utcDay() };

const retainersFrom = async (crm: Crm, dealId: string) =>
  expectOk(await crm.retainers.list(TODAY)).filter((retainer) => retainer.deal.id === dealId);

describe("winning a Deal", () => {
  it("accepts the Proposal, moves the Deal to Won and starts the Retainer", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);

    expect(await crm.deals.moveToStage(deal.id, "Won", TODAY)).toEqual({ ok: true, value: undefined });

    const won = await getDeal(crm, deal.id);
    expect(won).toMatchObject({ stage: "Won", monthlyValue: 6800, proposal: { version: 1, status: "Accepted" } });
    expect(won.proposals).toMatchObject([{ version: 1, status: "Accepted" }]);
    expect(await retainersFrom(crm, deal.id)).toMatchObject([
      {
        company: { name: "Saltmarsh Skincare" },
        deal: { title: "Test Deal" },
        owner: { id: await personaId(crm) },
        monthlyFee: 6800,
        startDate: utcDay(),
        state: "Active",
      },
    ]);
  });

  it.each([1, 6, 12])("runs the Retainer from today for the Proposal's term: %i months", async (termMonths) => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm, { ...OFFER, termMonths });

    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));

    const [retainer] = await retainersFrom(crm, deal.id);
    expect(retainer).toMatchObject({ startDate: utcDay(), endDate: lastDay(utcDay(), termMonths) });
  });

  it("takes the Deal off the board and its offer out of Proposals out, into Won this month", async () => {
    const { crm } = await visitorWithSandbox();
    const board = async (owners: "everyone" | "mine" = "everyone") => expectOk(await crm.pipeline.board({ ...TODAY, owners }));
    const deal = await dealWithSentProposal(crm);
    const before = await board();

    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));

    const after = await board();
    expect(after.deals.map((card) => card.id)).not.toContain(deal.id);
    expect(after.kpis.openMonthlyValue).toBe(before.kpis.openMonthlyValue - 6800);
    expect(after.kpis.proposalsOut.deals).toBe(before.kpis.proposalsOut.deals - 1);
    expect(after.kpis.wonThisMonth).toEqual({
      deals: before.kpis.wonThisMonth.deals + 1,
      monthlyValue: before.kpis.wonThisMonth.monthlyValue + 6800,
    });
    expect((await board("mine")).kpis.wonThisMonth.deals).toBeGreaterThan(0);
  });

  it("counts in Won this month until the visitor's month turns", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));
    const [year, month] = utcDay().split("-").map(Number);
    const wonBy = async (today: string) => expectOk(await crm.pipeline.board({ today, owners: "everyone" })).kpis.wonThisMonth;

    const lastOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

    expect(await wonBy(lastOfMonth)).toEqual(await wonBy(utcDay()));
    expect(await wonBy(nextMonth)).toEqual({ deals: 0, monthlyValue: 0 });
  });

  it("accepts only the Proposal that was confirmed", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    const [first] = (await getDeal(crm, deal.id)).proposals;
    // Meanwhile, in another tab, the offer is declined and a cheaper one sent.
    expectOk(await crm.proposals.markDeclined(first.id));
    const revised = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(revised.id));

    expect(await crm.deals.moveToStage(deal.id, "Won", { ...TODAY, proposalVersion: 1 })).toEqual({ ok: false, error: "proposal_changed" });
    expect(await getDeal(crm, deal.id)).toMatchObject({ stage: "New", proposal: { version: 2, status: "Sent" } });

    expectOk(await crm.deals.moveToStage(deal.id, "Won", { ...TODAY, proposalVersion: 2 }));
  });

  it("needs a Sent Proposal", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const refused = { ok: false, error: "won_needs_sent_proposal" };

    expect(await crm.deals.moveToStage(deal.id, "Won", TODAY)).toEqual(refused);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expect(await crm.deals.moveToStage(deal.id, "Won", TODAY)).toEqual(refused);
    expectOk(await crm.proposals.markSent(draft.id));
    expectOk(await crm.proposals.markDeclined(draft.id));
    expect(await crm.deals.moveToStage(deal.id, "Won", TODAY)).toEqual(refused);

    expect((await getDeal(crm, deal.id)).stage).toBe("New");
    expect(await retainersFrom(crm, deal.id)).toEqual([]);
    expect(await crm.deals.moveToStage(crypto.randomUUID(), "Won", TODAY)).toEqual({ ok: false, error: "not_found" });
  });

  it("starts one Retainer, however many times it's confirmed", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);

    const results = await Promise.all([1, 2].map(() => crm.deals.moveToStage(deal.id, "Won", TODAY)));

    expect(results).toContainEqual({ ok: true, value: undefined });
    expect(results).toContainEqual({ ok: false, error: "deal_already_won" });
    expect(await retainersFrom(crm, deal.id)).toHaveLength(1);
  });

  it("can give a Company a second Retainer", async () => {
    const { crm } = await visitorWithSandbox();
    const saltmarsh = await sampleCompany(crm, "Saltmarsh");
    for (const title of ["First", "Second"]) {
      const deal = await dealWithSentProposal(crm, OFFER, { title });
      expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));
    }

    const theirs = expectOk(await crm.retainers.list(TODAY)).filter((retainer) => retainer.company.id === saltmarsh.id);
    expect(theirs.map((retainer) => retainer.deal.title).sort()).toEqual(["First", "Second"]);
  });
});

describe("a Won Deal", () => {
  it("is final: it can't move Stage, be deleted or take a new Proposal", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    const leftover = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));

    expect(await crm.deals.moveToStage(deal.id, "Negotiation", TODAY)).toEqual({ ok: false, error: "deal_already_won" });
    expect(await crm.deals.delete(deal.id)).toEqual({ ok: false, error: "deal_already_won" });
    expect(await crm.proposals.createDraft(deal.id, OFFER)).toEqual({ ok: false, error: "deal_already_won" });
    expect(await crm.proposals.markSent(leftover.id)).toEqual({ ok: false, error: "deal_already_won" });
    expect((await getDeal(crm, deal.id)).stage).toBe("Won");
  });

  it("can't be made by calling the database directly, nor can a Retainer", async () => {
    const { crm, db } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    const { proposals, company, owner } = await getDeal(crm, deal.id);
    const direct = db.schema("crm");

    const won = await direct.from("deals").update({ stage: "Won", closed_on: utcDay() }).eq("id", deal.id);
    const bornWon = await direct.from("deals").insert({
      company_id: company.id,
      owner_id: owner.id,
      title: "Born Won",
      estimated_monthly_value: 1,
      stage: "Won",
      closed_on: utcDay(),
    });
    const accepted = await direct.from("proposals").update({ status: "Accepted" }).eq("id", proposals[0].id);
    const retainer = await direct.from("retainers").insert({
      company_id: company.id,
      deal_id: deal.id,
      owner_id: owner.id,
      monthly_fee: 1,
      start_date: utcDay(),
      end_date: utcDay(30),
    });

    expect(won.error?.message).toBe("only_by_winning");
    expect(bornWon.error?.message).toBe("only_by_winning");
    expect(accepted.error?.message).toBe("only_by_winning");
    expect(retainer.error?.code).toBe("42501"); // permission denied
    expect(await getDeal(crm, deal.id)).toMatchObject({ stage: "New", proposal: { status: "Sent" } });
  });

  it("keeps its Proposal and the day it was Won, even calling the database directly", async () => {
    const { crm, db } = await visitorWithSandbox();
    const deal = await dealWithSentProposal(crm);
    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));
    const before = await getDeal(crm, deal.id);
    const proposalId = before.proposals[0].id;
    const direct = db.schema("crm");

    const refused = [
      await direct.from("deals").update({ closed_on: "2020-01-01" }).eq("id", deal.id),
      await direct.from("proposals").delete().eq("id", proposalId),
      await direct.from("proposals").update({ term_months: 1 }).eq("id", proposalId),
      await direct.from("proposal_line_items").update({ monthly_fee: 1 }).eq("proposal_id", proposalId),
      await direct.from("proposal_line_items").delete().eq("proposal_id", proposalId),
      await direct.from("proposal_line_items").insert({ proposal_id: proposalId, position: 9, service: "Extra", monthly_fee: 1 }),
    ];

    expect(refused.map((each) => each.error?.message)).toEqual(["deal_already_won", ...Array(5).fill("only_by_winning")]);
    expect(await getDeal(crm, deal.id)).toEqual(before);
  });

  it("goes with its Retainer when the Company is deleted", async () => {
    const { crm } = await visitorWithSandbox();
    const saltmarsh = await sampleCompany(crm, "Saltmarsh");
    const deal = await dealWithSentProposal(crm);
    expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));

    expectOk(await crm.companies.delete(saltmarsh.id));

    expect(await retainersFrom(crm, deal.id)).toEqual([]);
  });
});

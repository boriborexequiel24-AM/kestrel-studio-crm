import { describe, expect, it } from "vitest";
import type { ProposalInput } from "@/lib/crm";
import { utcDay } from "./support/days";
import { OFFER, getDeal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

describe("the sample Proposals", () => {
  it("give every Deal in Proposal sent and Negotiation a live offer, sent recently", async () => {
    const { crm } = await visitorWithSandbox();
    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));
    const offered = board.deals.filter((deal) => deal.stage === "Proposal sent" || deal.stage === "Negotiation");

    const deals = await Promise.all(offered.map((deal) => getDeal(crm, deal.id)));

    expect(deals).toHaveLength(10);
    for (const deal of deals) {
      const sent = deal.proposals.find((proposal) => proposal.status === "Sent")!;
      expect(deal.proposal).toEqual({ version: sent.version, status: "Sent" });
      expect(deal.monthlyValue).toBe(sent.lineItems.reduce((total, item) => total + item.monthlyFee, 0));
      const daysAgo = (Date.now() - sent.sentAt!.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysAgo).toBeGreaterThan(0);
      expect(daysAgo).toBeLessThan(30);
    }
  });

  it("include a Deal whose first Proposal was declined and revised", async () => {
    const { crm } = await visitorWithSandbox();
    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));
    const deals = await Promise.all(board.deals.map((deal) => getDeal(crm, deal.id)));

    expect(deals.map((deal) => deal.proposals.map(({ version, status }) => [version, status]))).toContainEqual([
      [2, "Sent"],
      [1, "Declined"],
    ]);
  });
});

describe("drafting a Proposal", () => {
  it("records the scope, term and line items, and works out the monthly total", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    const drafted = expectOk(await crm.proposals.createDraft(deal.id, { ...OFFER, scopeSummary: `  ${OFFER.scopeSummary} ` }));

    expect((await getDeal(crm, deal.id)).proposals).toEqual([
      {
        id: drafted.id,
        version: 1,
        status: "Draft",
        scopeSummary: OFFER.scopeSummary,
        termMonths: 6,
        lineItems: OFFER.lineItems,
        monthlyTotal: 6800,
        sentAt: null,
      },
    ]);
  });

  it("numbers each Proposal on a Deal, newest first, and each Deal on its own", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const other = await newDeal(crm, { title: "Another Deal" });

    expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.createDraft(other.id, OFFER));

    expect((await getDeal(crm, deal.id)).proposals.map((proposal) => proposal.version)).toEqual([2, 1]);
    expect((await getDeal(crm, other.id)).proposals.map((proposal) => proposal.version)).toEqual([1]);
  });

  it("gives two Drafts saved at the same moment different versions", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    const drafts = await Promise.all([1, 2, 3].map(() => crm.proposals.createDraft(deal.id, OFFER)));

    for (const draft of drafts) expectOk(draft);
    expect((await getDeal(crm, deal.id)).proposals.map((proposal) => proposal.version)).toEqual([3, 2, 1]);
  });

  it("can be edited while it's a Draft, keeping its version", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));

    const edited = await crm.proposals.editDraft(draft.id, {
      scopeSummary: "Paid social only.",
      termMonths: 12,
      lineItems: [{ service: "Paid social", monthlyFee: 5000 }],
    });

    expect(edited).toEqual({ ok: true, value: undefined });
    expect((await getDeal(crm, deal.id)).proposals).toMatchObject([
      {
        id: draft.id,
        version: 1,
        scopeSummary: "Paid social only.",
        termMonths: 12,
        lineItems: [{ service: "Paid social", monthlyFee: 5000 }],
        monthlyTotal: 5000,
      },
    ]);
  });

  it("needs a scope, a term in whole months, and line items with a service and a whole-dollar fee", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = (change: Partial<ProposalInput>) => crm.proposals.createDraft(deal.id, { ...OFFER, ...change });
    const item = (service: string, monthlyFee: number) => ({ lineItems: [{ service, monthlyFee }] });

    expect(await draft({ scopeSummary: " " })).toEqual({ ok: false, error: "scope_required" });
    for (const termMonths of [0, 1.5, 61, Number.NaN]) expect(await draft({ termMonths })).toEqual({ ok: false, error: "term_invalid" });
    expect(await draft({ lineItems: [] })).toEqual({ ok: false, error: "line_items_required" });
    expect(await draft(item(" ", 100))).toEqual({ ok: false, error: "service_required" });
    for (const fee of [-1, 10.5, Number.NaN, 99_999_999_999]) {
      expect(await draft(item("Search", fee))).toEqual({ ok: false, error: "fee_invalid" });
    }
    const tooMuch = { lineItems: [1, 2].map((n) => ({ service: `Part ${n}`, monthlyFee: 6_000_000 })) };
    expect(await draft(tooMuch)).toEqual({ ok: false, error: "total_too_large" });
    expect((await getDeal(crm, deal.id)).proposals).toEqual([]);
  });

  it("needs a Deal or a Draft that exists", async () => {
    const { crm } = await visitorWithSandbox();

    expect(await crm.proposals.createDraft(crypto.randomUUID(), OFFER)).toEqual({ ok: false, error: "not_found" });
    expect(await crm.proposals.createDraft("not-a-deal", OFFER)).toEqual({ ok: false, error: "not_found" });
    expect(await crm.proposals.editDraft(crypto.randomUUID(), OFFER)).toEqual({ ok: false, error: "not_found" });
  });

  it("goes when its Deal is deleted", async () => {
    const { crm, db } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));

    expectOk(await crm.deals.delete(deal.id));

    expect(await crm.proposals.editDraft(draft.id, OFFER)).toEqual({ ok: false, error: "not_found" });
    expect((await db.schema("crm").from("proposal_line_items").select("id").eq("proposal_id", draft.id)).data).toEqual([]);
  });
});

describe("sending a Proposal", () => {
  it("makes it the live offer: the Deal's Monthly value comes from its total", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expect(await getDeal(crm, deal.id)).toMatchObject({ monthlyValue: 5000, proposal: null });

    expect(await crm.proposals.markSent(draft.id)).toEqual({ ok: true, value: undefined });

    const after = await getDeal(crm, deal.id);
    expect(after).toMatchObject({ monthlyValue: 6800, proposal: { version: 1, status: "Sent" }, estimatedMonthlyValue: 5000, stage: "New" });
    expect(after.proposals[0].status).toBe("Sent");
    expect(Math.abs(Date.now() - after.proposals[0].sentAt!.getTime())).toBeLessThan(60_000);
  });

  it("counts the real offer in the Pipeline's totals and in Proposals out", async () => {
    const { crm } = await visitorWithSandbox();
    const board = async () => expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    const before = await board();

    expectOk(await crm.proposals.markSent(draft.id));

    const after = await board();
    expect(after.deals.find((card) => card.id === deal.id)).toMatchObject({ monthlyValue: 6800, proposal: { version: 1, status: "Sent" } });
    expect(after.kpis.openMonthlyValue - before.kpis.openMonthlyValue).toBe(1800);
    expect(after.kpis.proposalsOut).toEqual({
      deals: before.kpis.proposalsOut.deals + 1,
      monthlyValue: before.kpis.proposalsOut.monthlyValue + 6800,
    });
    const inNew = (view: typeof after) => view.stages.find((stage) => stage.stage === "New")!.monthlyValue;
    expect(inNew(after) - inNew(before)).toBe(1800);
    expect(after.owners[0].monthlyValue - before.owners[0].monthlyValue).toBe(1800);

    expectOk(await crm.proposals.markDeclined(draft.id));
    expect(await board()).toEqual(before);
  });

  it("allows one Sent Proposal at a time on a Deal", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const first = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    const second = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(first.id));

    expect(await crm.proposals.markSent(second.id)).toEqual({ ok: false, error: "another_proposal_sent" });

    expect((await getDeal(crm, deal.id)).proposals.map(({ version, status }) => [version, status])).toEqual([
      [2, "Draft"],
      [1, "Sent"],
    ]);
  });

  it("lets only one win when two are sent at the same moment", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const drafts = [
      expectOk(await crm.proposals.createDraft(deal.id, OFFER)),
      expectOk(await crm.proposals.createDraft(deal.id, OFFER)),
    ];

    const results = await Promise.all(drafts.map((draft) => crm.proposals.markSent(draft.id)));

    expect(results).toContainEqual({ ok: true, value: undefined });
    expect(results).toContainEqual({ ok: false, error: "another_proposal_sent" });
  });

  it("allows one Sent Proposal per Deal even for someone calling the database directly", async () => {
    const { crm, db } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const first = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    const second = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(first.id));

    const { error } = await db
      .schema("crm")
      .from("proposals")
      .update({ status: "Sent", sent_at: new Date().toISOString() })
      .eq("id", second.id);

    expect(error?.code).toBe("23505");
  });

  it("fixes the offer: a Sent Proposal can't be edited or sent again", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(draft.id));

    expect(await crm.proposals.editDraft(draft.id, OFFER)).toEqual({ ok: false, error: "proposal_not_draft" });
    expect(await crm.proposals.markSent(draft.id)).toEqual({ ok: false, error: "proposal_not_draft" });
    expect(await crm.proposals.markSent(crypto.randomUUID())).toEqual({ ok: false, error: "not_found" });
  });
});

describe("a Deal whose Proposal was sent", () => {
  it("keeps its Company, because the offer was made to that Company", async () => {
    const { crm } = await visitorWithSandbox();
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const deal = await newDeal(crm);
    const toHarbor = { companyId: harbor.id, ownerId: await personaId(crm), title: "Moved", estimatedMonthlyValue: 5000 };
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expect((await getDeal(crm, deal.id)).companyFixedBy).toBeNull();
    expectOk(await crm.proposals.markSent(draft.id));

    expect(await crm.deals.update(deal.id, toHarbor)).toEqual({ ok: false, error: "company_fixed_by_proposal" });
    expect((await getDeal(crm, deal.id)).companyFixedBy).toBe("Proposal");

    expectOk(await crm.proposals.markDeclined(draft.id));
    expect(await crm.deals.update(deal.id, toHarbor)).toEqual({ ok: false, error: "company_fixed_by_proposal" });
  });

  it("can still change Company while there is only a Draft", async () => {
    const { crm } = await visitorWithSandbox();
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const deal = await newDeal(crm);
    expectOk(await crm.proposals.createDraft(deal.id, OFFER));

    expectOk(
      await crm.deals.update(deal.id, {
        companyId: harbor.id,
        ownerId: await personaId(crm),
        title: "Moved",
        estimatedMonthlyValue: 5000,
      }),
    );

    expect((await getDeal(crm, deal.id)).company.id).toBe(harbor.id);
  });
});

describe("a declined Proposal", () => {
  it("leaves the Deal in its Stage, back on its estimate, with the version kept", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(draft.id));
    expectOk(await crm.deals.moveToStage(deal.id, "Negotiation", { today: utcDay() }));

    expect(await crm.proposals.markDeclined(draft.id)).toEqual({ ok: true, value: undefined });

    const after = await getDeal(crm, deal.id);
    expect(after).toMatchObject({ stage: "Negotiation", monthlyValue: 5000, proposal: null });
    expect(after.proposals).toMatchObject([{ version: 1, status: "Declined", monthlyTotal: 6800 }]);
  });

  it("makes room for a revised one", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const first = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(first.id));
    expectOk(await crm.proposals.markDeclined(first.id));
    const revised = expectOk(
      await crm.proposals.createDraft(deal.id, { ...OFFER, lineItems: [{ service: "Paid social", monthlyFee: 4200 }] }),
    );

    expectOk(await crm.proposals.markSent(revised.id));

    const after = await getDeal(crm, deal.id);
    expect(after).toMatchObject({ monthlyValue: 4200, proposal: { version: 2, status: "Sent" } });
    expect(after.proposals.map(({ version, status }) => [version, status])).toEqual([
      [2, "Sent"],
      [1, "Declined"],
    ]);
  });

  it("is final: it can't be sent, edited or declined again", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(draft.id));
    expectOk(await crm.proposals.markDeclined(draft.id));

    expect(await crm.proposals.markSent(draft.id)).toEqual({ ok: false, error: "proposal_not_draft" });
    expect(await crm.proposals.editDraft(draft.id, OFFER)).toEqual({ ok: false, error: "proposal_not_draft" });
    expect(await crm.proposals.markDeclined(draft.id)).toEqual({ ok: false, error: "proposal_not_sent" });
  });

  it("has to have been sent first", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));

    expect(await crm.proposals.markDeclined(draft.id)).toEqual({ ok: false, error: "proposal_not_sent" });
    expect(await crm.proposals.markDeclined(crypto.randomUUID())).toEqual({ ok: false, error: "not_found" });
  });
});

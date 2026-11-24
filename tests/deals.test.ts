import { describe, expect, it } from "vitest";
import { utcDay } from "./support/days";
import { newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const OPEN_STAGES = ["New", "Qualified", "Discovery", "Proposal sent", "Negotiation"];

describe("the Pipeline board", () => {
  it("shows the agency's open Deals across every open Stage and every Owner", async () => {
    const { crm } = await visitorWithSandbox();

    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));

    expect(board.deals.length).toBeGreaterThanOrEqual(20);
    expect(new Set(board.deals.map((deal) => deal.stage))).toEqual(new Set(OPEN_STAGES));
    expect(board.owners).toHaveLength(5);
    expect(board.owners[0].owner.firstName).toBe("Maya");
    for (const owner of board.owners) expect(board.deals.some((deal) => deal.owner.id === owner.owner.id)).toBe(true);
  });

  it("adds up Monthly values for the KPI strip, each Stage and each Owner", async () => {
    const { crm } = await visitorWithSandbox();

    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));

    const total = board.deals.reduce((sum, deal) => sum + deal.monthlyValue, 0);
    expect(board.kpis.openMonthlyValue).toBe(total);
    expect(board.kpis.openDeals).toBe(board.deals.length);
    expect(board.stages.map((stage) => stage.stage)).toEqual(OPEN_STAGES);
    expect(board.stages.reduce((sum, stage) => sum + stage.monthlyValue, 0)).toBe(total);
    expect(board.stages.reduce((sum, stage) => sum + stage.count, 0)).toBe(board.deals.length);
    expect(board.owners.reduce((sum, owner) => sum + owner.monthlyValue, 0)).toBe(total);
  });

  it("has Next steps that read as current: some overdue, some coming up", async () => {
    const { crm } = await visitorWithSandbox();

    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" }));

    const overdue = board.deals.filter((deal) => deal.nextStep?.overdue);
    expect(overdue.length).toBeGreaterThan(0);
    expect(board.kpis.overdueNextSteps).toBe(overdue.length);
    expect(board.deals.some((deal) => deal.nextStep && deal.nextStep.due! > utcDay())).toBe(true);
  });

  it("counts a Next step as overdue once its due day has passed in the visitor's calendar", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm, { nextStepDue: "2026-03-10" });

    const onTheDay = expectOk(await crm.pipeline.board({ today: "2026-03-10", owners: "mine" }));
    const dayAfter = expectOk(await crm.pipeline.board({ today: "2026-03-11", owners: "mine" }));

    expect(onTheDay.deals.find((d) => d.id === deal.id)?.nextStep?.overdue).toBe(false);
    expect(dayAfter.deals.find((d) => d.id === deal.id)?.nextStep?.overdue).toBe(true);
  });

  it("shows only Maya's Deals and row when filtered to Mine", async () => {
    const { crm } = await visitorWithSandbox();
    const maya = await personaId(crm);

    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "mine" }));

    expect(board.owners.map((owner) => owner.owner.id)).toEqual([maya]);
    expect(board.deals.length).toBeGreaterThan(0);
    expect(board.deals.every((deal) => deal.owner.id === maya)).toBe(true);
  });
});

describe("a Deal", () => {
  it("opens with its Company, the Company's Contacts and the Deal's Activities", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const deal = await newDeal(crm);
    const logged = expectOk(
      await crm.activities.log({ companyId: company.id, dealId: deal.id, kind: "Call", occurredAt: new Date(), text: "Talked scope." }),
    );

    const opened = expectOk(await crm.deals.get(deal.id, { today: utcDay() }));

    expect(opened).toMatchObject({
      title: "Test Deal",
      stage: "New",
      kind: "New business",
      monthlyValue: 5000,
      company: { id: company.id, name: "Saltmarsh Skincare", status: "Prospect" },
      nextStep: { text: "Send the deck", due: utcDay(3), overdue: false },
    });
    expect(opened.contacts.map((c) => c.id).sort()).toEqual(company.contacts.map((c) => c.id).sort());
    expect(opened.activities.map((a) => a.id)).toEqual([logged.id]);
    expect(expectOk(await crm.companies.get(company.id, { today: utcDay() })).activities.map((a) => a.id)).toContain(logged.id);
  });

  it("is not found when it doesn't exist", async () => {
    const { crm } = await visitorWithSandbox();

    expect(await crm.deals.get(crypto.randomUUID(), { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
    expect(await crm.deals.get("not-a-deal", { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
  });

  it("starts in New and can be edited", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const theo = expectOk(await crm.team.list()).find((owner) => owner.firstName === "Theo")!;

    const updated = await crm.deals.update(deal.id, {
      companyId: harbor.id,
      ownerId: theo.id,
      title: "  Retail signage ",
      estimatedMonthlyValue: 7200,
      nextStep: "",
      nextStepDue: null,
    });

    expect(updated).toEqual({ ok: true, value: undefined });
    expect(expectOk(await crm.deals.get(deal.id, { today: utcDay() }))).toMatchObject({
      title: "Retail signage",
      stage: "New",
      monthlyValue: 7200,
      company: { id: harbor.id },
      owner: { id: theo.id },
      nextStep: null,
    });
  });

  it("keeps its rules: a title, a whole-dollar value, a real Company, Owner and date", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const base = { companyId: company.id, ownerId: await personaId(crm), title: "Rules", estimatedMonthlyValue: 1000 };

    expect(await crm.deals.create({ ...base, title: " " })).toEqual({ ok: false, error: "title_required" });
    expect(await crm.deals.create({ ...base, estimatedMonthlyValue: -5 })).toEqual({ ok: false, error: "value_invalid" });
    expect(await crm.deals.create({ ...base, estimatedMonthlyValue: 10.5 })).toEqual({ ok: false, error: "value_invalid" });
    expect(await crm.deals.create({ ...base, estimatedMonthlyValue: 99_999_999_999 })).toEqual({ ok: false, error: "value_invalid" });
    expect(await crm.deals.create({ ...base, companyId: crypto.randomUUID() })).toEqual({ ok: false, error: "company_not_found" });
    expect(await crm.deals.create({ ...base, ownerId: crypto.randomUUID() })).toEqual({ ok: false, error: "owner_not_found" });
    expect(await crm.deals.create({ ...base, nextStep: "Call", nextStepDue: "next week" })).toEqual({
      ok: false,
      error: "date_invalid",
    });
  });

  it("keeps its Company once it has Activities, and says so", async () => {
    const { crm } = await visitorWithSandbox();
    const saltmarsh = await sampleCompany(crm, "Saltmarsh");
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const deal = await newDeal(crm);
    expectOk(
      await crm.activities.log({ companyId: saltmarsh.id, dealId: deal.id, kind: "Call", occurredAt: new Date(), text: "Scoping call." }),
    );
    const edit = { companyId: harbor.id, ownerId: await personaId(crm), title: "Test Deal", estimatedMonthlyValue: 5000 };

    expect(await crm.deals.update(deal.id, edit)).toEqual({ ok: false, error: "company_fixed_by_activities" });
    expect(await crm.deals.update(deal.id, { ...edit, companyId: saltmarsh.id, title: "Renamed" })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(expectOk(await crm.deals.get(deal.id, { today: utcDay() })).companyFixedBy).toBe("Activities");
  });

  it("can be deleted, keeping its Activities on the Company", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const deal = await newDeal(crm);
    const logged = expectOk(
      await crm.activities.log({ companyId: company.id, dealId: deal.id, kind: "Note", occurredAt: new Date(), text: "Keep me." }),
    );

    expect(await crm.deals.delete(deal.id)).toEqual({ ok: true, value: undefined });

    expect(await crm.deals.get(deal.id, { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
    expect(expectOk(await crm.companies.get(company.id, { today: utcDay() })).activities.map((a) => a.id)).toContain(logged.id);
    expect(await crm.deals.delete(deal.id)).toEqual({ ok: false, error: "not_found" });
  });

  it("only takes Activities about its own Company", async () => {
    const { crm } = await visitorWithSandbox();
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const deal = await newDeal(crm);

    const logged = await crm.activities.log({ companyId: harbor.id, dealId: deal.id, kind: "Note", occurredAt: new Date(), text: "Wrong." });

    expect(logged).toEqual({ ok: false, error: "deal_not_found" });
  });
});

describe("a Deal's Next step", () => {
  it("can be set and cleared on its own", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    expect(await crm.deals.setNextStep(deal.id, { text: " Book the kickoff ", due: utcDay(-1) })).toEqual({ ok: true, value: undefined });
    expect(expectOk(await crm.deals.get(deal.id, { today: utcDay() })).nextStep).toEqual({
      text: "Book the kickoff",
      due: utcDay(-1),
      overdue: true,
    });

    expectOk(await crm.deals.setNextStep(deal.id, { text: "", due: null }));
    expect(expectOk(await crm.deals.get(deal.id, { today: utcDay() })).nextStep).toBeNull();
  });

  it("needs a real date and an existing Deal", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    expect(await crm.deals.setNextStep(deal.id, { text: "Call", due: "2026-02-30" })).toEqual({ ok: false, error: "date_invalid" });
    expect(await crm.deals.setNextStep(crypto.randomUUID(), { text: "Call", due: null })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("moving a Deal between Stages", () => {
  it("moves among the open Stages and shows up in its new column", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    expect(await crm.deals.moveToStage(deal.id, "Discovery", { today: utcDay() })).toEqual({ ok: true, value: undefined });

    const board = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "mine" }));
    expect(board.deals.find((d) => d.id === deal.id)?.stage).toBe("Discovery");
  });

  it("can't move to Lost yet, or to a Stage that doesn't exist", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await newDeal(crm);

    expect(await crm.deals.moveToStage(deal.id, "Lost", { today: utcDay() })).toEqual({ ok: false, error: "stage_not_available" });
    expect(await crm.deals.moveToStage(deal.id, "Pending" as never, { today: utcDay() })).toEqual({ ok: false, error: "stage_unknown" });
    expect(await crm.deals.moveToStage(crypto.randomUUID(), "Qualified", { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
  });
});

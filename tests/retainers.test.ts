import { describe, expect, it } from "vitest";
import type { Crm } from "@/lib/crm";
import { lastDay, utcDay } from "./support/days";
import { dealWithSentProposal, getDeal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const TODAY = { today: utcDay() };

/** Saltmarsh Skincare, a Prospect in the sample data, with one Retainer just won. */
async function newClient(crm: Crm) {
  const company = await sampleCompany(crm, "Saltmarsh");
  const deal = await dealWithSentProposal(crm);
  expectOk(await crm.deals.moveToStage(deal.id, "Won", TODAY));
  const [retainer] = expectOk(await crm.retainers.list(TODAY)).filter((each) => each.deal.id === deal.id);
  return { company, deal, retainer };
}

const statusOf = async (crm: Crm, companyId: string, today = utcDay()) => expectOk(await crm.companies.get(companyId, { today })).status;

describe("the sample Retainers", () => {
  it("are all active, first to end first, several of them ending within 60 days", async () => {
    const { crm } = await visitorWithSandbox();

    const retainers = expectOk(await crm.retainers.list(TODAY));

    expect(retainers).toHaveLength(15);
    const ends = retainers.map((retainer) => retainer.endDate);
    expect(ends).toEqual([...ends].sort());
    expect(retainers.map((retainer) => retainer.state)).not.toContain("Ended");
    const soon = retainers.filter((retainer) => retainer.state === "Ends soon");
    expect(soon).toHaveLength(5);
    expect(soon.every((retainer) => retainer.endDate <= utcDay(60))).toBe(true);
    expect(retainers.filter((retainer) => retainer.endDate <= utcDay(60))).toHaveLength(5);
    expect(retainers.every((retainer) => retainer.startDate <= utcDay())).toBe(true);
  });

  it("each come from a Won Deal, at its Accepted Proposal's fee", async () => {
    const { crm } = await visitorWithSandbox();

    const retainers = expectOk(await crm.retainers.list(TODAY));
    expect(retainers).toHaveLength(15);
    for (const retainer of retainers) {
      const deal = await getDeal(crm, retainer.deal.id);
      expect(deal).toMatchObject({
        stage: "Won",
        monthlyValue: retainer.monthlyFee,
        proposal: { status: "Accepted" },
        company: { id: retainer.company.id },
        owner: { id: retainer.owner.id },
      });
    }
  });

  it.each([-1, 0, 1])("start the day their Deal was Won and run for its Proposal's term, for a visitor %i days from UTC", async (offset) => {
    const today = utcDay(offset);
    const { crm } = await visitorWithSandbox({ today });

    const retainers = expectOk(await crm.retainers.list({ today }));

    for (const retainer of retainers) {
      const { proposals } = expectOk(await crm.deals.get(retainer.deal.id, { today }));
      expect(retainer.endDate).toBe(lastDay(retainer.startDate, proposals[0].termMonths));
    }
    // The newest was won on the visitor's own today.
    expect(retainers.map((retainer) => retainer.startDate).sort().at(-1)).toBe(today);
  });

  it("have a history: Activities about the Deal that started each", async () => {
    const { crm } = await visitorWithSandbox();

    for (const retainer of expectOk(await crm.retainers.list(TODAY))) {
      expect((await getDeal(crm, retainer.deal.id)).activities.length).toBeGreaterThan(0);
    }
  });

  it("keep Won this month from ever being empty, for Maya too", async () => {
    const { crm } = await visitorWithSandbox();

    for (const owners of ["everyone", "mine"] as const) {
      const { kpis } = expectOk(await crm.pipeline.board({ ...TODAY, owners }));
      expect(kpis.wonThisMonth.deals).toBeGreaterThan(0);
    }
    const maya = expectOk(await crm.team.list()).find((owner) => owner.isPersona)!;
    const wonToday = expectOk(await crm.retainers.list(TODAY)).filter((retainer) => retainer.startDate === utcDay());
    expect(wonToday.map((retainer) => retainer.owner.id)).toContain(maya.id);
  });

  it("make 12 of the 40 Companies Clients, some with two Retainers", async () => {
    const { crm } = await visitorWithSandbox();

    expect(expectOk(await crm.companies.list({ ...TODAY, status: "Client" }))).toHaveLength(12);
    expect(expectOk(await crm.companies.list({ ...TODAY, status: "Prospect" }))).toHaveLength(28);
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    expect(harbor.retainers).toHaveLength(2);
  });
});

describe("a Company's status", () => {
  it("becomes Client when a Deal is won, everywhere the Company appears", async () => {
    const { crm } = await visitorWithSandbox();
    const prospect = await sampleCompany(crm, "Saltmarsh");
    expect(prospect.status).toBe("Prospect");

    const { deal } = await newClient(crm);

    expect(await statusOf(crm, prospect.id)).toBe("Client");
    const clients = expectOk(await crm.companies.list({ ...TODAY, status: "Client", search: "Saltmarsh" }));
    expect(clients.map((company) => [company.id, company.status])).toEqual([[prospect.id, "Client"]]);
    expect((await getDeal(crm, deal.id)).company.status).toBe("Client");
  });

  it("lasts through the Retainer's last day in the visitor's calendar, then goes back to Prospect", async () => {
    const { crm } = await visitorWithSandbox();
    const { company, retainer } = await newClient(crm);
    expectOk(await crm.retainers.setEndDate(retainer.id, utcDay(10)));

    expect(await statusOf(crm, company.id, utcDay(10))).toBe("Client");
    expect(await statusOf(crm, company.id, utcDay(11))).toBe("Prospect");
    const later = { today: utcDay(11) };
    expect(expectOk(await crm.companies.list({ ...later, status: "Client", search: "Saltmarsh" }))).toEqual([]);
  });

  it("stays Client while any of its Retainers is active", async () => {
    const { crm } = await visitorWithSandbox();
    const { company, retainer } = await newClient(crm);
    const second = await dealWithSentProposal(crm);
    expectOk(await crm.deals.moveToStage(second.id, "Won", TODAY));
    const ended = { today: utcDay(40) };
    expectOk(await crm.retainers.setEndDate(retainer.id, utcDay(30)));

    expect(await statusOf(crm, company.id, ended.today)).toBe("Client");
    expect(expectOk(await crm.companies.get(company.id, ended)).retainers.map((each) => each.state)).toContain("Ended");
  });
});

describe("a Retainer's end date", () => {
  it("can be corrected, and flags the Retainer from 60 days out", async () => {
    const { crm } = await visitorWithSandbox();
    const { retainer } = await newClient(crm);
    const stateWhenEnding = async (endDate: string) => {
      expect(await crm.retainers.setEndDate(retainer.id, endDate)).toEqual({ ok: true, value: undefined });
      const found = expectOk(await crm.retainers.list(TODAY)).find((each) => each.id === retainer.id)!;
      expect(found.endDate).toBe(endDate);
      return found.state;
    };

    expect(await stateWhenEnding(utcDay(61))).toBe("Active");
    expect(await stateWhenEnding(utcDay(60))).toBe("Ends soon");
    expect(await stateWhenEnding(utcDay(0))).toBe("Ends soon");
  });

  it("must be a real day, not before the Retainer starts", async () => {
    const { crm } = await visitorWithSandbox();
    const { retainer } = await newClient(crm);

    expect(await crm.retainers.setEndDate(retainer.id, "")).toEqual({ ok: false, error: "end_date_invalid" });
    expect(await crm.retainers.setEndDate(retainer.id, "2201-01-01")).toEqual({ ok: false, error: "end_date_too_far" });
    expect(await crm.retainers.setEndDate(retainer.id, "infinity")).toEqual({ ok: false, error: "end_date_invalid" });
    expect(await crm.retainers.setEndDate(retainer.id, "2026-02-30")).toEqual({ ok: false, error: "end_date_invalid" });
    expect(await crm.retainers.setEndDate(retainer.id, utcDay(-1))).toEqual({ ok: false, error: "end_before_start" });
    expect(await crm.retainers.setEndDate(crypto.randomUUID(), utcDay(1))).toEqual({ ok: false, error: "not_found" });
    expect(await crm.retainers.setEndDate("not-a-retainer", utcDay(1))).toEqual({ ok: false, error: "not_found" });
  });

  it("is the only thing a visitor can change, even calling the database directly", async () => {
    const { crm, db } = await visitorWithSandbox();
    const { retainer } = await newClient(crm);
    const direct = db.schema("crm").from("retainers");

    const changed = await direct.update({ monthly_fee: 1 }).eq("id", retainer.id);
    const endless = await direct.update({ end_date: "infinity" }).eq("id", retainer.id);
    const deleted = await direct.delete().eq("id", retainer.id);

    expect(changed.error?.code).toBe("42501"); // permission denied
    expect(deleted.error?.code).toBe("42501");
    expect(endless.error?.message).toContain("retainers_dates");
    expect(expectOk(await crm.retainers.list(TODAY)).find((each) => each.id === retainer.id)?.monthlyFee).toBe(6800);
  });
});

describe("a Company's page", () => {
  it("shows its Deals, open ones first, and its Retainers", async () => {
    const { crm } = await visitorWithSandbox();
    const { company, deal, retainer } = await newClient(crm);
    const open = await newDeal(crm, { title: "Next campaign" });

    const page = expectOk(await crm.companies.get(company.id, TODAY));

    const titles = page.deals.map((each) => [each.title, each.stage]);
    expect(titles.at(-1)).toEqual(["Test Deal", "Won"]);
    expect(titles).toContainEqual(["Next campaign", "New"]);
    expect(page.deals.map((each) => each.id)).toEqual(expect.arrayContaining([deal.id, open.id]));
    expect(page.retainers).toEqual([retainer]);
    expect((await getDeal(crm, deal.id)).retainer).toEqual(retainer);
    expect((await getDeal(crm, open.id)).retainer).toBeNull();
  });
});

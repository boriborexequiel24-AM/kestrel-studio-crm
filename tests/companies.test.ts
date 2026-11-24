import { describe, expect, it } from "vitest";
import { utcDay } from "./support/days";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const DAY = 24 * 60 * 60 * 1000;

describe("the Companies list", () => {
  it("shows Kestrel Studio's sample Companies, by name, each with an Owner from the team", async () => {
    const { crm } = await visitorWithSandbox();

    const companies = expectOk(await crm.companies.list({ today: utcDay() }));
    const team = expectOk(await crm.team.list());

    const names = companies.map((company) => company.name);
    expect(names).toEqual(expect.arrayContaining(["Harbor & Pine Coffee", "Saltmarsh Skincare"]));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const teamIds = team.map((owner) => owner.id);
    for (const company of companies) expect(teamIds).toContain(company.owner.id);
  });

  it("has sample dates that read as current, whenever the Sandbox is opened", async () => {
    const { crm } = await visitorWithSandbox();

    const companies = expectOk(await crm.companies.list({ today: utcDay() }));

    const now = Date.now();
    const newest = Math.max(...companies.map((company) => company.addedAt.getTime()));
    expect(newest).toBeLessThanOrEqual(now);
    // The Template's newest Company was added a few days before its anchor.
    expect(now - newest).toBeLessThan(7 * DAY);
  });
});

describe("keeping Companies up to date", () => {
  it("adds a new Company, owned by whoever Maya picks, added today", async () => {
    const { crm } = await visitorWithSandbox();
    const ownerId = await personaId(crm);

    const created = expectOk(
      await crm.companies.create({ name: "  Tamsin Rowe Ceramics ", industry: "Ceramics studio", city: "Tucson, AZ", ownerId }),
    );

    const listed = expectOk(await crm.companies.list({ today: utcDay() })).find((company) => company.id === created.id);
    expect(listed).toMatchObject({ name: "Tamsin Rowe Ceramics", industry: "Ceramics studio", city: "Tucson, AZ" });
    expect(listed?.owner.id).toBe(ownerId);
    expect(Date.now() - listed!.addedAt.getTime()).toBeLessThan(DAY);
  });
});

describe("Company rules", () => {
  it("needs a name", async () => {
    const { crm } = await visitorWithSandbox();

    const created = await crm.companies.create({ name: "   ", ownerId: await personaId(crm) });

    expect(created).toEqual({ ok: false, error: "name_required" });
  });

  it("needs an Owner from the team", async () => {
    const { crm } = await visitorWithSandbox();

    const created = await crm.companies.create({ name: "Nobody's Co.", ownerId: crypto.randomUUID() });

    expect(created).toEqual({ ok: false, error: "owner_not_found" });
  });
});

describe("finding a Company", () => {
  it("filters by any part of the name, ignoring case", async () => {
    const { crm } = await visitorWithSandbox();
    await crm.companies.create({ name: "Zephyrine Glassworks", ownerId: await personaId(crm) });

    const found = expectOk(await crm.companies.list({ today: utcDay(), search: "  zephyr " }));

    expect(found.map((company) => company.name)).toEqual(["Zephyrine Glassworks"]);
  });

  it("treats filter text literally, even characters with special meaning to the database", async () => {
    const { crm } = await visitorWithSandbox();

    for (const search of ["%", "_", "*", ",", "(", "a,name.eq.x", "\\"]) {
      expect(expectOk(await crm.companies.list({ today: utcDay(), search }))).toEqual([]);
    }
  });

  it("filters by Owner", async () => {
    const { crm } = await visitorWithSandbox();
    const theo = expectOk(await crm.team.list()).find((owner) => owner.firstName === "Theo")!;

    const found = expectOk(await crm.companies.list({ today: utcDay(), ownerId: theo.id }));

    expect(found.length).toBeGreaterThan(0);
    expect(found.every((company) => company.owner.id === theo.id)).toBe(true);
  });
});

describe("a Company's page", () => {
  it("shows the Company with its Contacts and its Activity timeline, newest first", async () => {
    const { crm } = await visitorWithSandbox();

    const company = await sampleCompany(crm, "Harbor & Pine");

    expect(company).toMatchObject({ name: "Harbor & Pine Coffee", status: "Client" });
    expect(company.contacts.length).toBeGreaterThan(0);
    expect(company.contacts[0]).toMatchObject({ name: expect.any(String), jobTitle: expect.any(String) });
    expect(company.activities.length).toBeGreaterThan(0);
    const times = company.activities.map((activity) => activity.occurredAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    for (const activity of company.activities) {
      expect(["Email", "Call", "Meeting", "Note"]).toContain(activity.kind);
      expect(activity.author.firstName).toEqual(expect.any(String));
      expect(activity.text).not.toBe("");
    }
  });

  it("has Activity dates that read as current", async () => {
    const { crm } = await visitorWithSandbox();

    const company = await sampleCompany(crm, "Harbor & Pine");

    const newest = company.activities[0].occurredAt.getTime();
    expect(newest).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - newest).toBeLessThan(30 * DAY);
  });

  it("is not found for an unknown Company", async () => {
    const { crm } = await visitorWithSandbox();

    expect(await crm.companies.get(crypto.randomUUID(), { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
    expect(await crm.companies.get("not-a-company", { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
  });

  it("can be edited", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const theo = expectOk(await crm.team.list()).find((owner) => owner.firstName === "Theo")!;

    const updated = await crm.companies.update(company.id, {
      name: "Harbor & Pine Roasters",
      industry: "Coffee roaster, 15 cafes",
      city: "Tacoma, WA",
      ownerId: theo.id,
    });

    expect(updated.ok).toBe(true);
    expect(expectOk(await crm.companies.get(company.id, { today: utcDay() }))).toMatchObject({
      name: "Harbor & Pine Roasters",
      industry: "Coffee roaster, 15 cafes",
      city: "Tacoma, WA",
      owner: { id: theo.id },
    });
  });

  it("keeps the edit rules: a name is required", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");

    const updated = await crm.companies.update(company.id, { name: "", ownerId: company.owner.id });

    expect(updated).toEqual({ ok: false, error: "name_required" });
  });

  it("can be deleted, with its Contacts, Activities, Deals and Retainers", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const retainers = expectOk(await crm.retainers.list({ today: utcDay() }));

    expect(await crm.companies.delete(company.id)).toEqual({ ok: true, value: undefined });

    expect(await crm.companies.get(company.id, { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
    expect(await crm.deals.get(company.deals[0].id, { today: utcDay() })).toEqual({ ok: false, error: "not_found" });
    expect(expectOk(await crm.retainers.list({ today: utcDay() }))).toEqual(retainers.filter((each) => each.company.id !== company.id));
    expect(await crm.companies.delete(company.id)).toEqual({ ok: false, error: "not_found" });
  });
});

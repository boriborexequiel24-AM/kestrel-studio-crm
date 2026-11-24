import { describe, expect, it } from "vitest";
import { utcDay } from "./support/days";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { newVisitor, sandboxRowCounts, templateRowCounts, visitorWithSandbox } from "./support/visitors";

describe("a new Sandbox", () => {
  it("holds a full copy of every Template table", async () => {
    const { sandbox } = await visitorWithSandbox();

    expect(await sandboxRowCounts(sandbox.id)).toEqual(await templateRowCounts());
  });
});

describe("Start over", () => {
  it("puts back the sample data: what Maya added goes, what she deleted returns", async () => {
    const { crm } = await visitorWithSandbox();
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    await crm.companies.create({ name: "Added Before Start Over", ownerId: await personaId(crm) });
    await crm.companies.delete(harbor.id);

    expect(await crm.sandbox.startOver({ today: utcDay() })).toEqual({ ok: true, value: undefined });

    const names = expectOk(await crm.companies.list({ today: utcDay() })).map((company) => company.name);
    expect(names).toContain("Harbor & Pine Coffee");
    expect(names).not.toContain("Added Before Start Over");
    expect(expectOk(await crm.companies.get(harbor.id, { today: utcDay() })).activities).toHaveLength(harbor.activities.length);
  });

  it("resets every Sandbox table to the Template", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    const saltmarsh = await sampleCompany(crm, "Saltmarsh");
    await crm.contacts.create(saltmarsh.id, { name: "Extra Contact" });
    await crm.activities.log({ companyId: saltmarsh.id, kind: "Note", occurredAt: new Date(), text: "Extra note." });
    await crm.contacts.delete(saltmarsh.contacts[0].id);

    expectOk(await crm.sandbox.startOver({ today: utcDay() }));

    expect(await sandboxRowCounts(sandbox.id)).toEqual(await templateRowCounts());
  });

  it("works however many times it's pressed at once", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    await crm.companies.create({ name: "Added Before Start Over", ownerId: await personaId(crm) });

    const results = await Promise.all(Array.from({ length: 6 }, () => crm.sandbox.startOver({ today: utcDay() })));

    expect(results).toEqual(results.map(() => ({ ok: true, value: undefined })));
    expect(await sandboxRowCounts(sandbox.id)).toEqual(await templateRowCounts());
  });

  it("works while something is being saved, which is either part of the old Sandbox or the new one", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    const ownerId = await personaId(crm);
    const template = await templateRowCounts();

    for (let each = 0; each < 5; each++) {
      const [startedOver, ...created] = await Promise.all([
        crm.sandbox.startOver({ today: utcDay() }),
        ...Array.from({ length: 4 }, (_, index) => crm.companies.create({ name: `Meanwhile ${index}`, ownerId })),
      ]);

      expect(startedOver).toEqual({ ok: true, value: undefined });
      expect(created.every((result) => result.ok)).toBe(true);
      const { companies, ...rest } = await sandboxRowCounts(sandbox.id);
      expect(companies).toBeGreaterThanOrEqual(template.companies);
      expect(companies).toBeLessThanOrEqual(template.companies + created.length);
      expect({ ...rest, companies: template.companies }).toEqual(template);
    }
  });

  it("and a save that has already locked a Deal never block each other", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    const deals = expectOk(await crm.pipeline.board({ today: utcDay(), owners: "everyone" })).deals.slice(0, 12);
    const offer = { scopeSummary: "Meanwhile", termMonths: 12, lineItems: [{ service: "Paid search", monthlyFee: 1000 }] };
    const template = await templateRowCounts();

    for (let each = 0; each < 8; each++) {
      const [startedOver, ...drafted] = await Promise.all([
        crm.sandbox.startOver({ today: utcDay() }),
        ...deals.map((deal) => crm.proposals.createDraft(deal.id, offer)),
      ]);

      expect(startedOver).toEqual({ ok: true, value: undefined });
      for (const result of drafted) expect(result.ok || result.error).toSatisfy((was) => was === true || was === "not_found");
      const { companies, deals: dealCount } = await sandboxRowCounts(sandbox.id);
      expect({ companies, deals: dealCount }).toEqual({ companies: template.companies, deals: template.deals });
    }
  }, 60_000);

  it("keeps the same Sandbox and the same expiry time", async () => {
    const { crm } = await visitorWithSandbox();
    const before = await crm.sandbox.status();

    expectOk(await crm.sandbox.startOver({ today: utcDay() }));

    expect(await crm.sandbox.status()).toEqual(before);
  });

  it("leaves everyone else's Sandbox alone", async () => {
    const mine = await visitorWithSandbox();
    const theirs = await visitorWithSandbox();
    await theirs.crm.companies.create({ name: "Theirs To Keep", ownerId: await personaId(theirs.crm) });

    expectOk(await mine.crm.sandbox.startOver({ today: utcDay() }));

    expect(expectOk(await theirs.crm.companies.list({ today: utcDay() })).map((company) => company.name)).toContain("Theirs To Keep");
  });

  it("needs a live Sandbox", async () => {
    const { crm } = newVisitor();

    expect(await crm.sandbox.startOver({ today: utcDay() })).toEqual({ ok: false, error: "no_sandbox" });
  });
});

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

    const names = expectOk(await crm.companies.list()).map((company) => company.name);
    expect(names).toContain("Harbor & Pine Coffee");
    expect(names).not.toContain("Added Before Start Over");
    expect(expectOk(await crm.companies.get(harbor.id)).activities).toHaveLength(harbor.activities.length);
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

    expect(expectOk(await theirs.crm.companies.list()).map((company) => company.name)).toContain("Theirs To Keep");
  });

  it("needs a live Sandbox", async () => {
    const { crm } = newVisitor();

    expect(await crm.sandbox.startOver({ today: utcDay() })).toEqual({ ok: false, error: "no_sandbox" });
  });
});

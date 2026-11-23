import { describe, expect, it } from "vitest";
import { expectOk } from "./support/results";
import { sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

describe("a Company's Contacts", () => {
  it("can be added, with whatever details Maya has", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");

    const added = expectOk(
      await crm.contacts.create(company.id, { name: " Imogen Faraday ", jobTitle: "Head of Growth", email: "imogen@example.com" }),
    );

    const contacts = expectOk(await crm.companies.get(company.id)).contacts;
    expect(contacts).toContainEqual({ id: added.id, name: "Imogen Faraday", jobTitle: "Head of Growth", email: "imogen@example.com", phone: "" });
  });

  it("need a name", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");

    expect(await crm.contacts.create(company.id, { name: "" })).toEqual({ ok: false, error: "name_required" });
  });

  it("can only be added to a Company that exists", async () => {
    const { crm } = await visitorWithSandbox();

    expect(await crm.contacts.create(crypto.randomUUID(), { name: "Lost Soul" })).toEqual({
      ok: false,
      error: "company_not_found",
    });
  });

  it("can be edited", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const contact = company.contacts[0];

    const updated = await crm.contacts.update(contact.id, { name: "Rosa Delgado-Park", jobTitle: "VP Marketing", phone: "(206) 555-0199" });

    expect(updated.ok).toBe(true);
    expect(expectOk(await crm.companies.get(company.id)).contacts).toContainEqual({
      id: contact.id,
      name: "Rosa Delgado-Park",
      jobTitle: "VP Marketing",
      email: "",
      phone: "(206) 555-0199",
    });
    expect(await crm.contacts.update(contact.id, { name: " " })).toEqual({ ok: false, error: "name_required" });
    expect(await crm.contacts.update(crypto.randomUUID(), { name: "Nobody" })).toEqual({ ok: false, error: "not_found" });
  });

  it("can be deleted, and their Activities stay on the Company's timeline", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const contact = company.contacts.find((candidate) =>
      company.activities.some((activity) => activity.contact?.id === candidate.id),
    )!;
    const theirActivities = company.activities.filter((activity) => activity.contact?.id === contact.id).map((a) => a.id);

    expect(await crm.contacts.delete(contact.id)).toEqual({ ok: true, value: undefined });

    const after = expectOk(await crm.companies.get(company.id));
    expect(after.contacts.map((c) => c.id)).not.toContain(contact.id);
    for (const id of theirActivities) {
      expect(after.activities.find((activity) => activity.id === id)?.contact).toBeNull();
    }
    expect(await crm.contacts.delete(contact.id)).toEqual({ ok: false, error: "not_found" });
  });
});

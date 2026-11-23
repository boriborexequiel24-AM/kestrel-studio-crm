import { describe, expect, it } from "vitest";
import { expectOk } from "./support/results";
import { sampleCompany } from "./support/sample";
import { visitorWithSandbox } from "./support/visitors";

const DAY = 24 * 60 * 60 * 1000;

describe("logging an Activity", () => {
  it("adds it to the Company's timeline, written by Maya", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const occurredAt = new Date(Date.now() - 60_000);

    const logged = expectOk(
      await crm.activities.log({ companyId: company.id, kind: "Call", occurredAt, text: " Intro call. They want a spring launch. " }),
    );

    const [newest] = expectOk(await crm.companies.get(company.id)).activities;
    expect(newest).toMatchObject({
      id: logged.id,
      kind: "Call",
      text: "Intro call. They want a spring launch.",
      author: { firstName: "Maya" },
      contact: null,
    });
    expect(newest.occurredAt.getTime()).toBe(occurredAt.getTime());
  });

  it("can name one of the Company's Contacts", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const contact = company.contacts[0];

    const logged = expectOk(
      await crm.activities.log({ companyId: company.id, contactId: contact.id, kind: "Email", occurredAt: new Date(), text: "Sent the brief." }),
    );

    const activity = expectOk(await crm.companies.get(company.id)).activities.find((a) => a.id === logged.id);
    expect(activity?.contact).toEqual({ id: contact.id, name: contact.name });
  });

  it("can't name a Contact from another Company", async () => {
    const { crm } = await visitorWithSandbox();
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const saltmarsh = await sampleCompany(crm, "Saltmarsh");

    const logged = await crm.activities.log({
      companyId: saltmarsh.id,
      contactId: harbor.contacts[0].id,
      kind: "Email",
      occurredAt: new Date(),
      text: "Wrong person.",
    });

    expect(logged).toEqual({ ok: false, error: "contact_not_found" });
  });

  it("needs text, a known kind and a Company that exists", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const base = { companyId: company.id, kind: "Note" as const, occurredAt: new Date(), text: "Fine." };

    expect(await crm.activities.log({ ...base, text: "  " })).toEqual({ ok: false, error: "text_required" });
    expect(await crm.activities.log({ ...base, kind: "Fax" as never })).toEqual({ ok: false, error: "kind_unknown" });
    expect(await crm.activities.log({ ...base, companyId: crypto.randomUUID() })).toEqual({
      ok: false,
      error: "company_not_found",
    });
  });

  it("can't be dated in the future", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");

    const logged = await crm.activities.log({
      companyId: company.id,
      kind: "Meeting",
      occurredAt: new Date(Date.now() + 2 * DAY),
      text: "Not yet.",
    });

    expect(logged).toEqual({ ok: false, error: "date_in_future" });
  });
});

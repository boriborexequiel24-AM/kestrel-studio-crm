import { describe, expect, it } from "vitest";
import { utcDay } from "./support/days";
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

    const [newest] = expectOk(await crm.companies.get(company.id, { today: utcDay() })).activities;
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

    const activity = expectOk(await crm.companies.get(company.id, { today: utcDay() })).activities.find((a) => a.id === logged.id);
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

describe("correcting an Activity", () => {
  it("can change its kind, date, Contact and text, keeping its author", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const activity = company.activities.find((a) => a.author.firstName !== "Maya")!;
    const ben = company.contacts.find((c) => c.name === "Ben Okafor")!;
    const occurredAt = new Date(Date.now() - 3 * DAY);

    const updated = await crm.activities.update(activity.id, {
      kind: "Meeting",
      occurredAt,
      contactId: ben.id,
      text: " Met Ben at the roastery instead. ",
    });

    expect(updated).toEqual({ ok: true, value: undefined });
    const after = expectOk(await crm.companies.get(company.id, { today: utcDay() })).activities.find((a) => a.id === activity.id);
    expect(after).toMatchObject({
      kind: "Meeting",
      text: "Met Ben at the roastery instead.",
      contact: { id: ben.id, name: "Ben Okafor" },
      author: { id: activity.author.id },
    });
    expect(after?.occurredAt.getTime()).toBe(occurredAt.getTime());
  });

  it("keeps the same rules as logging one", async () => {
    const { crm } = await visitorWithSandbox();
    const harbor = await sampleCompany(crm, "Harbor & Pine");
    const saltmarsh = await sampleCompany(crm, "Saltmarsh");
    const activity = harbor.activities[0];
    const base = { kind: activity.kind, occurredAt: activity.occurredAt, contactId: null, text: activity.text };

    expect(await crm.activities.update(activity.id, { ...base, text: "" })).toEqual({ ok: false, error: "text_required" });
    expect(await crm.activities.update(activity.id, { ...base, kind: "Fax" as never })).toEqual({ ok: false, error: "kind_unknown" });
    expect(await crm.activities.update(activity.id, { ...base, occurredAt: new Date(Date.now() + 2 * DAY) })).toEqual({
      ok: false,
      error: "date_in_future",
    });
    expect(await crm.activities.update(activity.id, { ...base, contactId: saltmarsh.contacts[0].id })).toEqual({
      ok: false,
      error: "contact_not_found",
    });
    expect(await crm.activities.update(crypto.randomUUID(), base)).toEqual({ ok: false, error: "not_found" });
  });

  it("can be deleted", async () => {
    const { crm } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Harbor & Pine");
    const activity = company.activities[0];

    expect(await crm.activities.delete(activity.id)).toEqual({ ok: true, value: undefined });

    const after = expectOk(await crm.companies.get(company.id, { today: utcDay() })).activities;
    expect(after.map((a) => a.id)).not.toContain(activity.id);
    expect(after).toHaveLength(company.activities.length - 1);
    expect(await crm.activities.delete(activity.id)).toEqual({ ok: false, error: "not_found" });
  });
});

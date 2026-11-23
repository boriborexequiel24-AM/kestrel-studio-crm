import { beforeEach, describe, expect, it } from "vitest";
import { visitorWithSandbox } from "./support/visitors";

// Required test (spec, Testing Decisions): one visitor can never read, change
// or delete another visitor's Sandbox data. Each attack below uses the
// visitor's own session straight against the database API, so it proves the
// database enforces isolation, not just the CRM module.
// Later tickets add each new Sandbox-owned table here.

type Visitor = Awaited<ReturnType<typeof visitorWithSandbox>>;

describe("Sandbox isolation", () => {
  let mine: Visitor;
  let theirs: Visitor;
  const theirCompanyName = "Only In Their Sandbox Ltd";

  beforeEach(async () => {
    [mine, theirs] = await Promise.all([visitorWithSandbox(), visitorWithSandbox()]);
    const { error } = await theirs.db
      .schema("crm")
      .from("companies")
      .insert({ name: theirCompanyName, owner_id: await personaId(theirs) });
    expect(error).toBeNull();
  });

  async function listCompanies(visitor: Visitor) {
    const companies = await visitor.crm.companies.list();
    if (!companies.ok) throw new Error(companies.error);
    return companies.value;
  }

  async function theirCompanyNames() {
    return (await listCompanies(theirs)).map((company) => company.name);
  }

  async function companyIds(visitor: Visitor) {
    return (await listCompanies(visitor)).map((company) => company.id);
  }

  async function personaId(visitor: Visitor) {
    const { data, error } = await visitor.db.schema("crm").from("teammates").select("id").eq("is_persona", true).single();
    if (error) throw error;
    return data.id;
  }

  it("gives each visitor a different Sandbox", () => {
    expect(mine.sandbox.id).not.toBe(theirs.sandbox.id);
  });

  it("never lists another Sandbox's Companies", async () => {
    const companies = await mine.crm.companies.list();

    expect(companies.ok).toBe(true);
    if (!companies.ok) return;
    expect(companies.value.map((company) => company.name)).not.toContain(theirCompanyName);
  });

  it("can't read another Sandbox's Companies, Teammates or Sandbox row", async () => {
    const crm = mine.db.schema("crm");

    const companies = await crm.from("companies").select("id").eq("sandbox_id", theirs.sandbox.id);
    const teammates = await crm.from("teammates").select("id").eq("sandbox_id", theirs.sandbox.id);
    const sandboxes = await crm.from("sandboxes").select("id").eq("id", theirs.sandbox.id);

    expect(companies.data).toEqual([]);
    expect(teammates.data).toEqual([]);
    expect(sandboxes.data).toEqual([]);
  });

  it("can't change another Sandbox's Companies", async () => {
    const before = await theirCompanyNames();

    await mine.db.schema("crm").from("companies").update({ name: "Hacked" }).eq("sandbox_id", theirs.sandbox.id);

    expect(await theirCompanyNames()).toEqual(before);
  });

  it("can't delete another Sandbox's Companies", async () => {
    const before = await theirCompanyNames();

    await mine.db.schema("crm").from("companies").delete().eq("sandbox_id", theirs.sandbox.id);

    expect(await theirCompanyNames()).toEqual(before);
  });

  it("can't move one of their own Companies into another Sandbox", async () => {
    const [myCompanyId] = await companyIds(mine);
    const theirsBefore = await theirCompanyNames();

    const { error } = await mine.db
      .schema("crm")
      .from("companies")
      .update({ sandbox_id: theirs.sandbox.id })
      .eq("id", myCompanyId);

    expect(error).not.toBeNull();
    expect(await theirCompanyNames()).toEqual(theirsBefore);
    expect(await companyIds(mine)).toContain(myCompanyId);
  });

  it("can't run the Sandbox builder against any Sandbox", async () => {
    const { error } = await mine.db.schema("crm").rpc("fill_sandbox", { target: theirs.sandbox.id });

    expect(error?.code).toBe("42501"); // permission denied
  });

  it("can't add a Company to another Sandbox", async () => {
    const { error } = await mine.db
      .schema("crm")
      .from("companies")
      .insert({ sandbox_id: theirs.sandbox.id, name: "Planted Co.", owner_id: await personaId(theirs) });

    expect(error).not.toBeNull();
    expect(await theirCompanyNames()).not.toContain("Planted Co.");
  });
});

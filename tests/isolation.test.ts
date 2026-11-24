import { beforeEach, describe, expect, it } from "vitest";
import { utcDay } from "./support/days";
import { dealWithSentProposal } from "./support/deals";
import { expectOk } from "./support/results";
import { visitorWithSandbox } from "./support/visitors";

// Required test (spec, Testing Decisions): one visitor can never read, change
// or delete another visitor's Sandbox data. Each attack below uses the
// visitor's own session straight against the database API, so it proves the
// database enforces isolation, not just the CRM module.
// Later tickets add each new Sandbox-owned table here. What Ask the pipeline
// looks up is held to the visitor's own records in ask.test.ts.

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
    const companies = await visitor.crm.companies.list({ today: utcDay() });
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
    const companies = await mine.crm.companies.list({ today: utcDay() });

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
    const { error } = await mine.db.schema("crm").rpc("fill_sandbox", { target: theirs.sandbox.id, today: utcDay() });

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

  describe("for Contacts, Activities, Deals, Proposals and Retainers", () => {
    const tables = ["contacts", "activities", "deals", "proposals", "proposal_line_items", "retainers"] as const;

    async function theirRows(table: (typeof tables)[number]) {
      const { data, error } = await theirs.db.schema("crm").from(table).select("*").order("id");
      if (error) throw error;
      return data;
    }

    it("can't read another Sandbox's Contacts, Activities, Deals, Proposals or Retainers", async () => {
      for (const table of tables) {
        const { data } = await mine.db.schema("crm").from(table).select("id").eq("sandbox_id", theirs.sandbox.id);
        expect(data, table).toEqual([]);
      }
    });

    it("can't change another Sandbox's Contacts, Activities, Deals, Proposals or Retainers", async () => {
      const before = {
        contacts: await theirRows("contacts"),
        activities: await theirRows("activities"),
        deals: await theirRows("deals"),
        proposals: await theirRows("proposals"),
        lineItems: await theirRows("proposal_line_items"),
        retainers: await theirRows("retainers"),
      };
      for (const rows of Object.values(before)) expect(rows.length).toBeGreaterThan(0);

      await mine.db.schema("crm").from("contacts").update({ name: "Hacked" }).eq("sandbox_id", theirs.sandbox.id);
      await mine.db.schema("crm").from("activities").update({ text: "Hacked" }).eq("sandbox_id", theirs.sandbox.id);
      await mine.db.schema("crm").from("deals").update({ title: "Hacked" }).eq("sandbox_id", theirs.sandbox.id);
      await mine.db.schema("crm").from("proposals").update({ scope_summary: "Hacked" }).eq("sandbox_id", theirs.sandbox.id);
      await mine.db.schema("crm").from("proposal_line_items").update({ service: "Hacked" }).eq("sandbox_id", theirs.sandbox.id);
      await mine.db.schema("crm").from("retainers").update({ end_date: "2999-01-01" }).eq("sandbox_id", theirs.sandbox.id);

      expect(await theirRows("contacts")).toEqual(before.contacts);
      expect(await theirRows("activities")).toEqual(before.activities);
      expect(await theirRows("deals")).toEqual(before.deals);
      expect(await theirRows("proposals")).toEqual(before.proposals);
      expect(await theirRows("proposal_line_items")).toEqual(before.lineItems);
      expect(await theirRows("retainers")).toEqual(before.retainers);
    });

    it("can't delete another Sandbox's Contacts, Activities, Deals, Proposals or Retainers", async () => {
      for (const table of tables) {
        const before = await theirRows(table);

        await mine.db.schema("crm").from(table).delete().eq("sandbox_id", theirs.sandbox.id);

        expect(await theirRows(table), table).toEqual(before);
      }
    });

    it("can't link one of their own Activities to another Sandbox's Deal", async () => {
      const [theirCompany] = await listCompanies(theirs);
      const theirDeal = expectOk(
        await theirs.crm.deals.create({
          companyId: theirCompany.id,
          ownerId: await personaId(theirs),
          title: "Only In Their Sandbox",
          estimatedMonthlyValue: 1000,
        }),
      );

      const logged = await mine.crm.activities.log({
        companyId: theirCompany.id,
        dealId: theirDeal.id,
        kind: "Note",
        occurredAt: new Date(),
        text: "Trying to reach across Sandboxes.",
      });

      expect(logged).toEqual({ ok: false, error: "deal_not_found" });
    });

    it("can't draft, edit, send or decline a Proposal on another Sandbox's Deal", async () => {
      const [theirCompany] = await listCompanies(theirs);
      const theirDeal = expectOk(
        await theirs.crm.deals.create({
          companyId: theirCompany.id,
          ownerId: await personaId(theirs),
          title: "Only In Their Sandbox",
          estimatedMonthlyValue: 1000,
        }),
      );
      const offer = { scopeSummary: "Reach across", termMonths: 6, lineItems: [{ service: "Search", monthlyFee: 100 }] };
      const theirDraft = expectOk(await theirs.crm.proposals.createDraft(theirDeal.id, offer));

      expect(await mine.crm.proposals.createDraft(theirDeal.id, offer)).toEqual({ ok: false, error: "not_found" });
      expect(await mine.crm.proposals.editDraft(theirDraft.id, offer)).toEqual({ ok: false, error: "not_found" });
      expect(await mine.crm.proposals.markSent(theirDraft.id)).toEqual({ ok: false, error: "not_found" });
      expect(await mine.crm.proposals.markDeclined(theirDraft.id)).toEqual({ ok: false, error: "not_found" });
    });

    it("can't win another Sandbox's Deal, or correct a Retainer only they have", async () => {
      const today = utcDay();
      const theirDeal = await dealWithSentProposal(theirs.crm);
      expect(await mine.crm.deals.moveToStage(theirDeal.id, "Won", { today })).toEqual({ ok: false, error: "not_found" });

      expectOk(await theirs.crm.deals.moveToStage(theirDeal.id, "Won", { today }));
      const theirRetainer = expectOk(await theirs.crm.retainers.list({ today })).find((each) => each.deal.id === theirDeal.id)!;

      expect(await mine.crm.retainers.setEndDate(theirRetainer.id, today)).toEqual({ ok: false, error: "not_found" });
      expect(expectOk(await mine.crm.retainers.list({ today })).map((each) => each.id)).not.toContain(theirRetainer.id);
    });

    it("can't read, change or use up another Sandbox's AI actions or summaries", async () => {
      const today = utcDay();
      const [company] = await companyIds(theirs);
      const written = expectOk(await theirs.crm.ai.summarize(company, { today }));
      const crm = mine.db.schema("crm");
      const usage = await theirs.db.schema("crm").from("ai_usage").select("*").single();
      const theirSummary = () => theirs.db.schema("crm").from("ai_summaries").select("*").single();
      const before = (await theirSummary()).data;

      const rows = [
        await crm.from("ai_usage").select("id").eq("sandbox_id", theirs.sandbox.id),
        await crm.from("ai_summaries").select("company_id").eq("sandbox_id", theirs.sandbox.id),
      ];
      await crm.from("ai_summaries").update({ lines: ["Hacked"] }).eq("sandbox_id", theirs.sandbox.id);
      await crm.from("ai_summaries").delete().eq("sandbox_id", theirs.sandbox.id);
      const added = await crm
        .from("ai_summaries")
        .insert({ sandbox_id: theirs.sandbox.id, company_id: (await companyIds(theirs))[1], lines: ["Hacked"], activities_seen: "" });
      await crm.rpc("finish_ai_action", { action: usage.data!.id, input_tokens: 9, output_tokens: 9, cost_usd: 9 });
      expectOk(await mine.crm.ai.summarize((await companyIds(mine))[2], { today }));

      expect(rows.map((each) => each.data)).toEqual([[], []]);
      expect(added.error).not.toBeNull();
      expect((await theirSummary()).data).toEqual(before);
      expect((await theirs.db.schema("crm").from("ai_usage").select("*").single()).data).toEqual(usage.data);
      expect(expectOk(await theirs.crm.ai.actionsLeft()).left).toBe(29);
      expect(expectOk(await mine.crm.ai.actionsLeft()).left).toBe(29);
      // The Company has the same id in both Sandboxes, but not the same summary.
      expect(expectOk(await mine.crm.companies.get(company, { today })).summary).toBeNull();
      expect(expectOk(await theirs.crm.companies.get(company, { today })).summary?.lines).toEqual(written.lines);
    });

    it("can't draft about or log on a Deal only another Sandbox has", async () => {
      const theirDeal = await dealWithSentProposal(theirs.crm);

      const drafted = await mine.crm.ai.draftFollowUp(theirDeal.id, { today: utcDay() });
      const logged = await mine.crm.ai.logAsSent(theirDeal.id, { text: "Not mine to send.", contactId: null });

      expect([drafted, logged]).toEqual([
        { ok: false, error: "not_found" },
        { ok: false, error: "not_found" },
      ]);
      expect(mine.ai.requests).toHaveLength(0);
      expect(expectOk(await theirs.crm.deals.get(theirDeal.id, { today: utcDay() })).activities).toEqual([]);
    });

    it("can't finish another Sandbox's AI action while it runs", async () => {
      const begin = await theirs.db.schema("crm").rpc("begin_ai_action", { feature: "ask", sandbox_limit: 30, daily_cap: 10_000 });

      await mine.db.schema("crm").rpc("finish_ai_action", { action: begin.data!, input_tokens: 9, output_tokens: 9, cost_usd: 9 });

      const { data } = await theirs.db.schema("crm").from("ai_usage").select("finished_at, cost_usd").eq("id", begin.data!).single();
      expect(data).toEqual({ finished_at: null, cost_usd: null });
    });

    it("can't see another Sandbox's Deals on the Pipeline, open or closed", async () => {
      const view = { today: utcDay(), owners: "everyone" as const };
      const open = await dealWithSentProposal(theirs.crm);
      const lost = await dealWithSentProposal(theirs.crm);
      expectOk(await theirs.crm.deals.moveToStage(lost.id, "Lost", { ...view, lostReason: "Price" }));

      const mineOpen = expectOk(await mine.crm.pipeline.board(view)).deals.map((deal) => deal.id);
      const mineClosed = expectOk(await mine.crm.pipeline.closed(view)).map((deal) => deal.id);

      expect(mineOpen).not.toContain(open.id);
      expect(mineClosed).not.toContain(lost.id);
      expect(await mine.crm.deals.moveToStage(open.id, "Lost", { ...view, lostReason: "Price" })).toEqual({ ok: false, error: "not_found" });
    });

    it("can't renew a Retainer only another Sandbox has", async () => {
      const today = utcDay();
      const theirDeal = await dealWithSentProposal(theirs.crm);
      expectOk(await theirs.crm.deals.moveToStage(theirDeal.id, "Won", { today }));
      const theirRetainer = expectOk(await theirs.crm.retainers.list({ today })).find((each) => each.deal.id === theirDeal.id)!;

      const renewal = await mine.crm.deals.create({
        companyId: theirRetainer.company.id, // the same id in every Sandbox
        renews: { retainerId: theirRetainer.id, today },
        ownerId: theirRetainer.owner.id,
        title: "Not mine to renew",
        estimatedMonthlyValue: 1,
      });

      expect(renewal).toEqual({ ok: false, error: "retainer_not_found" });
    });

    it("can't add a Proposal or line item to another Sandbox", async () => {
      const [theirProposal] = await theirs.db.schema("crm").from("proposals").select("id, deal_id").then(({ data }) => data!);
      const before = { proposals: await theirRows("proposals"), lineItems: await theirRows("proposal_line_items") };
      const crm = mine.db.schema("crm");

      const proposal = await crm.from("proposals").insert({
        sandbox_id: theirs.sandbox.id,
        deal_id: theirProposal.deal_id,
        version: 99,
        scope_summary: "Planted",
        term_months: 1,
      });
      const lineItem = await crm.from("proposal_line_items").insert({
        sandbox_id: theirs.sandbox.id,
        proposal_id: theirProposal.id,
        position: 99,
        service: "Planted",
        monthly_fee: 1,
      });

      expect(proposal.error?.code).toBe("42501"); // row-level security
      expect(lineItem.error?.code).toBe("42501");
      expect(await theirRows("proposals")).toEqual(before.proposals);
      expect(await theirRows("proposal_line_items")).toEqual(before.lineItems);
    });

    it("can't add a Deal to another Sandbox", async () => {
      const [theirCompany] = await listCompanies(theirs);

      const { error } = await mine.db.schema("crm").from("deals").insert({
        sandbox_id: theirs.sandbox.id,
        company_id: theirCompany.id,
        owner_id: await personaId(theirs),
        title: "Planted Deal",
        estimated_monthly_value: 1,
      });

      expect(error).not.toBeNull();
      const theirDeals = await theirs.db.schema("crm").from("deals").select("title");
      expect(theirDeals.data!.map((row) => row.title)).not.toContain("Planted Deal");
    });

    it("can't link one of their own Activities to another Sandbox's Contact", async () => {
      const [theirCompany] = await listCompanies(theirs);
      const theirContact = expectOk(await theirs.crm.contacts.create(theirCompany.id, { name: "Only In Their Sandbox" }));

      // Same Company id exists in both Sandboxes (copied from the Template); the Contact doesn't.
      const logged = await mine.crm.activities.log({
        companyId: theirCompany.id,
        contactId: theirContact.id,
        kind: "Note",
        occurredAt: new Date(),
        text: "Trying to reach across Sandboxes.",
      });

      expect(logged).toEqual({ ok: false, error: "contact_not_found" });
    });

    it("can't add a Contact or Activity to another Sandbox", async () => {
      const [theirCompany] = await listCompanies(theirs);
      const crm = mine.db.schema("crm");

      const contact = await crm
        .from("contacts")
        .insert({ sandbox_id: theirs.sandbox.id, company_id: theirCompany.id, name: "Planted Person" });
      const activity = await crm.from("activities").insert({
        sandbox_id: theirs.sandbox.id,
        company_id: theirCompany.id,
        author_id: await personaId(theirs),
        kind: "Note",
        text: "Planted note",
      });

      expect(contact.error).not.toBeNull();
      expect(activity.error).not.toBeNull();
      const theirContacts = await theirs.db.schema("crm").from("contacts").select("name");
      const theirActivities = await theirs.db.schema("crm").from("activities").select("text");
      expect(theirContacts.data!.map((row) => row.name)).not.toContain("Planted Person");
      expect(theirActivities.data!.map((row) => row.text)).not.toContain("Planted note");
    });
  });
});

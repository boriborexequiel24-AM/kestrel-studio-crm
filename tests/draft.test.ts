import { describe, expect, it } from "vitest";
import type { AiRequest } from "@/lib/ai/provider";
import type { Crm } from "@/lib/crm";
import { utcDay } from "./support/days";
import { OFFER, getDeal, newDeal } from "./support/deals";
import { expectOk } from "./support/results";
import { personaId, sampleCompany } from "./support/sample";
import { expireSandbox, visitorWithSandbox } from "./support/visitors";

const TODAY = { today: utcDay() };
const DASH = "\u2014"; // an em dash
const EMAIL = "Subject: Next steps\n\nHi Frank,\n\nCould we talk on Tuesday?\n\nBest,\nMaya";

const sentText = (request: AiRequest) => request.input.map((item) => (item.type === "message" ? item.content : "")).join("\n");

/** A sample Deal in Negotiation, with Activities and a Next step. */
async function tidebrook(crm: Crm) {
  const company = await sampleCompany(crm, "Tidebrook");
  return getDeal(crm, company.deals[0].id);
}

describe("a drafted follow-up", () => {
  it("is an email to edit, for one AI action, and changes nothing by itself", async () => {
    const { crm, ai, db } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    ai.script({ text: EMAIL });

    const draft = expectOk(await crm.ai.draftFollowUp(deal.id, TODAY));

    expect(draft.text).toBe(EMAIL);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(29);
    const { data } = await db.schema("crm").from("ai_usage").select("feature");
    expect(data).toEqual([{ feature: "draft" }]);
    expect(await getDeal(crm, deal.id)).toEqual(deal);
  });

  it("is written from the Deal's Stage, Next step, last Activities, main Contact and the instruction", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);

    const draft = expectOk(await crm.ai.draftFollowUp(deal.id, { ...TODAY, instruction: "Mention the search case study" }));

    const sent = sentText(ai.requests[0]);
    expect(sent).toContain(deal.title);
    expect(sent).toContain(deal.company.name);
    expect(sent).toContain(deal.stage);
    expect(sent).toContain(deal.nextStep!.text);
    for (const activity of deal.activities.slice(0, 5)) expect(sent).toContain(activity.text);
    expect(sent).toContain("Mention the search case study");
    expect(sent).toContain("Maya Brandt");
    // Frank is in the latest Activity about the Deal.
    expect(draft.contact).toMatchObject({ name: "Frank Delacroix" });
    expect(sent).toContain("Frank Delacroix");
  });

  it("covers the Deal's last five Activities", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const deal = await newDeal(crm);
    for (let each = 1; each <= 7; each++) {
      const occurredAt = new Date(Date.now() - each * 86_400_000);
      expectOk(await crm.activities.log({ companyId: company.id, dealId: deal.id, kind: "Note", occurredAt, text: `Note number ${each}.` }));
    }

    expectOk(await crm.ai.draftFollowUp(deal.id, TODAY));

    const sent = sentText(ai.requests[0]);
    const covered = [1, 2, 3, 4, 5, 6, 7].filter((each) => sent.includes(`Note number ${each}.`));
    expect(covered).toEqual([1, 2, 3, 4, 5]);
  });

  it("knows a Proposal was declined, not just whether one is live", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await newDeal(crm);
    const draft = expectOk(await crm.proposals.createDraft(deal.id, OFFER));
    expectOk(await crm.proposals.markSent(draft.id));
    expectOk(await crm.proposals.markDeclined(draft.id));

    expectOk(await crm.ai.draftFollowUp(deal.id, TODAY));

    expect(sentText(ai.requests[0])).toContain("Declined");
  });

  it("is for open Deals, and spends nothing on a closed one", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    expectOk(await crm.deals.moveToStage(deal.id, "Lost", { ...TODAY, lostReason: "Price" }));

    expect(await crm.ai.draftFollowUp(deal.id, TODAY)).toEqual({ ok: false, error: "deal_closed" });
    expect(ai.requests).toHaveLength(0);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(30);
  });

  it("goes to the Contact of the Deal's latest Activity that names one, or else the Company's first", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const company = await sampleCompany(crm, "Saltmarsh");
    const deal = await newDeal(crm);
    const contactOf = async () => expectOk(await crm.ai.draftFollowUp(deal.id, TODAY)).contact;
    expect(await contactOf()).toEqual({ id: company.contacts[0].id, name: company.contacts[0].name });
    // No Activity names them, so this is who the email is to.
    expect(sentText(ai.requests[0])).toContain(company.contacts[0].name);

    const about = { companyId: company.id, dealId: deal.id, kind: "Call" as const, text: "Talked." };
    const second = company.contacts[1];
    expectOk(await crm.activities.log({ ...about, contactId: second.id, occurredAt: new Date(Date.now() - 60_000) }));
    expectOk(await crm.activities.log({ ...about, occurredAt: new Date() }));

    expect(await contactOf()).toEqual({ id: second.id, name: second.name });
  });

  it("works without a Next step, Activities or Contacts", async () => {
    const { crm } = await visitorWithSandbox();
    const bare = expectOk(await crm.companies.create({ name: "Brand New Co", ownerId: await personaId(crm) }));
    const deal = await newDeal(crm, { companyId: bare.id, nextStep: "", nextStepDue: null });

    expect(expectOk(await crm.ai.draftFollowUp(deal.id, TODAY)).contact).toBeNull();
  });

  it("is kept to plain text, however the answer is laid out", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    ai.script({ text: "\n**Subject:** Hello\u2014again\n\n\n\nHi Frank,\u0000\n  Best \u{1F680}\n" });

    expect(expectOk(await crm.ai.draftFollowUp(deal.id, TODAY)).text).toBe("Subject: Hello, again\n\nHi Frank,\nBest \u{1F680}");
  });

  it.each([
    [`Great ${DASH}, ok`, "Great, ok"],
    [`${DASH} Maya`, "Maya"],
    [`One${DASH}two ${DASH} three`, "One, two, three"],
    [`Done. ${DASH} Maya`, "Done. Maya"],
    ["- A point\r", "- A point"],
  ])("tidies a line such as %j", async (line, tidied) => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    ai.script({ text: line });

    expect(expectOk(await crm.ai.draftFollowUp(deal.id, TODAY)).text).toBe(tidied);
  });

  it("is cut to a fair length", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    ai.script({ text: "word ".repeat(5_000) });

    expect(expectOk(await crm.ai.draftFollowUp(deal.id, TODAY)).text.length).toBeLessThanOrEqual(4_000);
  });

  it("isn't held up by a huge instruction, limit or no limit", async () => {
    const { crm } = await visitorWithSandbox({ aiActionsPerSandbox: 0 });
    const deal = await tidebrook(crm);
    const instruction = `a${" ".repeat(100_000)}\u{1F680}`;
    const started = performance.now();

    expect(await crm.ai.draftFollowUp(deal.id, { ...TODAY, instruction })).toEqual({ ok: false, error: "ai_sandbox_limit_reached" });

    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it.each([
    ["empty", { text: " \n " }],
    ["cut off", { text: EMAIL, complete: false }],
  ])("is refused when the answer is %s, though the action counts", async (_how, answer) => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    ai.script(answer);

    expect(await crm.ai.draftFollowUp(deal.id, TODAY)).toEqual({ ok: false, error: "ai_unavailable" });
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(29);
  });

  it("holds what a visitor can paste in to a fair size", async () => {
    const { crm, ai } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    const long = "\u{1F680}".repeat(20_000);
    for (let each = 0; each < 8; each++) {
      expectOk(
        await crm.activities.log({ companyId: deal.company.id, dealId: deal.id, kind: "Note", occurredAt: new Date(), text: long }),
      );
    }

    expectOk(await crm.ai.draftFollowUp(deal.id, { ...TODAY, instruction: long }));

    const sent = sentText(ai.requests[0]);
    expect([...sent].length).toBeLessThanOrEqual(6_000);
    expect(sent.isWellFormed()).toBe(true);
    expect(ai.requests[0].maxOutputTokens).toBeLessThanOrEqual(2000);
  });

  it("stops at the AI limit, without calling the provider", async () => {
    const { crm, ai } = await visitorWithSandbox({ aiActionsPerSandbox: 1 });
    const deal = await tidebrook(crm);
    expectOk(await crm.ai.draftFollowUp(deal.id, TODAY));

    expect(await crm.ai.draftFollowUp(deal.id, TODAY)).toEqual({ ok: false, error: "ai_sandbox_limit_reached" });
    expect(ai.requests).toHaveLength(1);
  });

  it("stops at the demo-wide limit too", async () => {
    const { crm, ai } = await visitorWithSandbox({ aiActionsPerDay: 0 });
    const deal = await tidebrook(crm);

    expect(await crm.ai.draftFollowUp(deal.id, TODAY)).toEqual({ ok: false, error: "ai_daily_cap_reached" });
    expect(ai.requests).toHaveLength(0);
  });

  it("needs a Deal in a live Sandbox, and spends nothing without one", async () => {
    const { crm, ai, sandbox } = await visitorWithSandbox();
    const deal = await tidebrook(crm);

    expect(await crm.ai.draftFollowUp(crypto.randomUUID(), TODAY)).toEqual({ ok: false, error: "not_found" });
    expect(await crm.ai.draftFollowUp("not-a-deal", TODAY)).toEqual({ ok: false, error: "not_found" });
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(30);
    await expireSandbox(sandbox.id);
    expect(await crm.ai.draftFollowUp(deal.id, TODAY)).toEqual({ ok: false, error: "sandbox_expired" });
    expect(ai.requests).toHaveLength(0);
  });
});

describe("Log as sent", () => {
  it("records the edited draft as an Email by Maya, on the Deal and its Company, spending no AI action", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    const contact = deal.contacts[0];

    const logged = expectOk(await crm.ai.logAsSent(deal.id, { text: " Edited by Maya. ", contactId: contact.id }));

    const [latest] = (await getDeal(crm, deal.id)).activities;
    expect(latest).toMatchObject({
      id: logged.id,
      kind: "Email",
      text: "Edited by Maya.",
      author: { id: await personaId(crm) },
      contact: { id: contact.id },
      deal: { id: deal.id },
    });
    expect(Date.now() - latest.occurredAt.getTime()).toBeLessThan(60_000);
    const company = expectOk(await crm.companies.get(deal.company.id, TODAY));
    expect(company.activities[0]).toEqual(latest);
    expect(expectOk(await crm.ai.actionsLeft()).left).toBe(30);
  });

  it("puts the Company's summary out of date", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    expectOk(await crm.ai.summarize(deal.company.id, TODAY));

    expectOk(await crm.ai.logAsSent(deal.id, { text: EMAIL, contactId: null }));

    expect((await getDeal(crm, deal.id)).summary?.upToDate).toBe(false);
  });

  it("is logged without its Contact if they're no longer at the Deal's Company", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await tidebrook(crm);
    const contact = expectOk(await crm.contacts.create(deal.company.id, { name: "Gone Soon" }));
    expectOk(await crm.contacts.delete(contact.id));

    expectOk(await crm.ai.logAsSent(deal.id, { text: EMAIL, contactId: contact.id }));

    expect((await getDeal(crm, deal.id)).activities[0]).toMatchObject({ text: EMAIL, contact: null });
  });

  it("needs some text and a Deal", async () => {
    const { crm } = await visitorWithSandbox();
    const deal = await tidebrook(crm);

    expect(await crm.ai.logAsSent(deal.id, { text: "  ", contactId: null })).toEqual({ ok: false, error: "draft_empty" });
    expect(await crm.ai.logAsSent(crypto.randomUUID(), { text: EMAIL, contactId: null })).toEqual({ ok: false, error: "not_found" });
    expect(await crm.ai.logAsSent("not-a-deal", { text: EMAIL, contactId: null })).toEqual({ ok: false, error: "not_found" });
    expect((await getDeal(crm, deal.id)).activities).toHaveLength(deal.activities.length);
  });
});

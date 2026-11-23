import { describe, expect, it } from "vitest";
import { newVisitor, operator, visitorWithSandbox } from "./support/visitors";

const HOUR = 60 * 60 * 1000;

describe("opening the demo", () => {
  it("gives a new visitor a live Sandbox that lasts 24 hours", async () => {
    const { crm } = newVisitor();

    const opened = await crm.sandbox.open();

    expect(opened.ok).toBe(true);
    const status = await crm.sandbox.status();
    expect(status.state).toBe("live");
    if (status.state !== "live") return;
    const hoursLeft = (status.sandbox.expiresAt.getTime() - Date.now()) / HOUR;
    expect(hoursLeft).toBeGreaterThan(23.9);
    expect(hoursLeft).toBeLessThanOrEqual(24);
  });

  it("gives a returning visitor the same Sandbox, not a new one", async () => {
    const { crm, sandbox } = await visitorWithSandbox();

    const again = await crm.sandbox.open();

    expect(again).toEqual({ ok: true, value: sandbox });
  });

  it("gives one Sandbox when the visitor clicks twice at once", async () => {
    const { crm, db } = newVisitor();
    await db.auth.signInAnonymously();

    const [first, second] = await Promise.all([crm.sandbox.open(), crm.sandbox.open()]);

    expect(first).toEqual(second);
  });

  it("puts the visitor at Maya's desk, with 4 Teammates", async () => {
    const { crm } = await visitorWithSandbox();

    const team = await crm.team.list();

    expect(team.ok).toBe(true);
    if (!team.ok) return;
    const persona = team.value.filter((owner) => owner.isPersona);
    expect(persona).toEqual([expect.objectContaining({ firstName: "Maya", role: "Account Director", initials: "MB" })]);
    expect(team.value.filter((owner) => !owner.isPersona)).toHaveLength(4);
  });
});

describe("without a live Sandbox", () => {
  it("a visitor who hasn't opened the demo has no Sandbox and no data", async () => {
    const { crm } = newVisitor();

    expect(await crm.sandbox.status()).toEqual({ state: "none" });
    expect(await crm.companies.list()).toEqual({ ok: false, error: "no_sandbox" });
    expect(await crm.team.list()).toEqual({ ok: false, error: "no_sandbox" });
  });

  it("a visitor whose Sandbox ran out sees it as expired, with no data", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    await expireSandbox(sandbox.id);

    expect(await crm.sandbox.status()).toEqual({ state: "expired" });
    expect(await crm.companies.list()).toEqual({ ok: false, error: "sandbox_expired" });
  });

  it("a visitor whose Sandbox ran out can open a fresh one", async () => {
    const { crm, sandbox } = await visitorWithSandbox();
    await expireSandbox(sandbox.id);

    const reopened = await crm.sandbox.open();

    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.id).not.toBe(sandbox.id);
    expect((await crm.sandbox.status()).state).toBe("live");
    const companies = await crm.companies.list();
    expect(companies.ok && companies.value.length).toBeGreaterThan(0);
  });

  it("a visitor whose anonymous user was removed, with a token still in hand, can open a fresh one", async () => {
    const { crm, db, sandbox } = await visitorWithSandbox();
    const { data } = await db.auth.getUser();
    await operator().auth.admin.deleteUser(data.user!.id);

    const reopened = await crm.sandbox.open();

    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.id).not.toBe(sandbox.id);
    expect((await crm.sandbox.status()).state).toBe("live");
  });
});

async function expireSandbox(id: string) {
  const { error } = await operator()
    .schema("crm")
    .from("sandboxes")
    .update({ created_at: new Date(Date.now() - 25 * HOUR).toISOString(), expires_at: new Date(Date.now() - HOUR).toISOString() })
    .eq("id", id);
  if (error) throw error;
}

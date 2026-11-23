import { describe, expect, it } from "vitest";
import { expectOk } from "./support/results";
import { expireSandbox, operator, sandboxRowCounts, templateRowCounts, visitorWithSandbox } from "./support/visitors";

async function cleanUp() {
  const { error } = await operator().schema("crm").rpc("clean_up_expired_sandboxes");
  if (error) throw error;
}

async function userExists(id: string) {
  const { data } = await operator().auth.admin.getUserById(id);
  return Boolean(data.user);
}

describe("the hourly cleanup", () => {
  it("removes expired Sandboxes with every row they own and their anonymous users", async () => {
    const { db, sandbox } = await visitorWithSandbox();
    const userId = (await db.auth.getUser()).data.user!.id;
    await expireSandbox(sandbox.id);

    await cleanUp();

    const counts = await sandboxRowCounts(sandbox.id);
    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
    const { data } = await operator().schema("crm").from("sandboxes").select("id").eq("id", sandbox.id);
    expect(data).toEqual([]);
    expect(await userExists(userId)).toBe(false);
  });

  it("leaves live Sandboxes and the Template alone", async () => {
    const live = await visitorWithSandbox();
    const expired = await visitorWithSandbox();
    await expireSandbox(expired.sandbox.id);

    await cleanUp();

    const template = await templateRowCounts();
    expect(Object.values(template).some((count) => count > 0)).toBe(true);
    expect(await sandboxRowCounts(live.sandbox.id)).toEqual(template);
    expect((await live.crm.sandbox.status()).state).toBe("live");
  });

  it("leaves a returning visitor with no Sandbox, free to open a new one", async () => {
    const { crm, ip, sandbox } = await visitorWithSandbox();
    await expireSandbox(sandbox.id);
    await cleanUp();

    expect(await crm.sandbox.status()).toEqual({ state: "none" });
    const reopened = expectOk(await crm.sandbox.open({ ip }));
    expect(reopened.id).not.toBe(sandbox.id);
  });

  it("forgets network records older than a day", async () => {
    const crm = operator().schema("crm");
    const stale = `stale-${crypto.randomUUID()}`;
    const recent = `recent-${crypto.randomUUID()}`;
    const { error } = await crm.from("sandbox_openings").insert([
      { ip_hash: stale, opened_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { ip_hash: recent, opened_at: new Date().toISOString() },
    ]);
    expect(error).toBeNull();

    await cleanUp();

    const { data } = await crm.from("sandbox_openings").select("ip_hash").in("ip_hash", [stale, recent]);
    expect(data!.map((row) => row.ip_hash)).toEqual([recent]);
  });
});

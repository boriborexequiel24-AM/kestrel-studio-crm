import { describe, expect, it } from "vitest";
import { expectOk } from "./support/results";
import { newVisitor, operator, visitorWithSandbox } from "./support/visitors";

describe("the daily Sandbox limit per network", () => {
  it("lets one network open up to the limit, then says the limit is reached", async () => {
    const ip = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) await visitorWithSandbox({ ip, sandboxesPerIpPerDay: 3 });

    const fourth = newVisitor({ ip, sandboxesPerIpPerDay: 3 });

    expect(await fourth.crm.sandbox.open({ ip })).toEqual({ ok: false, error: "sandbox_limit_reached" });
    expect(await fourth.crm.sandbox.status()).not.toMatchObject({ state: "live" });
  });

  it("counts each network on its own", async () => {
    const ip = `test-${crypto.randomUUID()}`;
    await visitorWithSandbox({ ip, sandboxesPerIpPerDay: 1 });

    const elsewhere = newVisitor({ sandboxesPerIpPerDay: 1 });

    expect((await elsewhere.crm.sandbox.open({ ip: elsewhere.ip })).ok).toBe(true);
  });

  it("never stops a visitor going back to their own live Sandbox", async () => {
    const { crm, ip, sandbox } = await visitorWithSandbox({ sandboxesPerIpPerDay: 1 });

    expect(expectOk(await crm.sandbox.open({ ip }))).toEqual(sandbox);
  });

  it("keeps only a salted hash of the network address", async () => {
    const { ip } = await visitorWithSandbox();

    const { data, error } = await operator().schema("crm").from("sandbox_openings").select("*");

    expect(error).toBeNull();
    expect(JSON.stringify(data)).not.toContain(ip);
  });
});

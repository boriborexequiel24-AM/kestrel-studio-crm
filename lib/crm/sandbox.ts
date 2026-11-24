import "server-only";
import { createHash } from "node:crypto";
import { fail, ok, unexpected, type CrmDb, type CrmSupabaseClient, type InLiveSandbox, type Result } from "./core";
import type { Day } from "./terms";

export type SandboxInfo = { id: string; expiresAt: Date };
export type SandboxStatus = { state: "none" } | { state: "expired" } | { state: "live"; sandbox: SandboxInfo };

/** How many Sandboxes one network may open in 24 hours, and the salt for hashing its address. */
export type SandboxLimits = { sandboxesPerIpPerDay: number; ipHashSalt: string };

export function sandboxArea(supabase: CrmSupabaseClient, db: CrmDb, limits: SandboxLimits) {
  /** A fresh anonymous session, dropping any old one. */
  async function signInAnonymously() {
    await supabase.auth.signOut({ scope: "local" });
    // Tagged so the cleanup job can tell this app's users from other demos' in the shared project.
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { app: "kestrel-crm" } } });
    if (error) throw error;
  }

  /**
   * Makes sure the visitor has a session whose user still exists. A token can
   * outlive its anonymous user (the cleanup job deletes expired ones), so this
   * asks the Auth server rather than only checking the token's signature.
   */
  async function ensureLiveUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) await signInAnonymously();
  }

  async function status(): Promise<SandboxStatus> {
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims.sub;
    if (!userId) return { state: "none" };
    const { data, error } = await db.from("sandboxes").select("id, expires_at").eq("user_id", userId).maybeSingle();
    if (error) unexpected(error);
    if (!data) return { state: "none" };
    const sandbox = toSandboxInfo(data);
    if (sandbox.expiresAt.getTime() <= Date.now()) return { state: "expired" };
    return { state: "live", sandbox };
  }

  // RLS already hides every row without a live Sandbox; this turns that into
  // a result the UI can explain.
  const inLiveSandbox: InLiveSandbox = async (work) => {
    const current = await status();
    if (current.state === "none") return fail("no_sandbox");
    if (current.state === "expired") return fail("sandbox_expired");
    return work();
  };

  const area = {
    /**
     * "Open the demo": signs in anonymously if needed and returns the visitor's
     * live Sandbox, building one unless their network has hit the daily limit.
     * Sample due dates are set from the visitor's own `today`.
     */
    async open(visitor: { ip: string; today: Day }): Promise<Result<SandboxInfo, "sandbox_limit_reached">> {
      if (!limits.ipHashSalt) throw new Error("IP_HASH_SALT is not set. See .env.example.");
      await ensureLiveUser();

      const args = {
        ip_hash: createHash("sha256").update(`${limits.ipHashSalt}:${visitor.ip}`).digest("hex"),
        daily_limit: limits.sandboxesPerIpPerDay,
        today: visitor.today,
      };
      let { data, error } = await db.rpc("open_sandbox", args);
      if (error?.message === "sandbox_expired") {
        // This visitor's Sandbox ran out: start over as a new anonymous visitor.
        await signInAnonymously();
        ({ data, error } = await db.rpc("open_sandbox", args));
      }
      if (error?.message === "sandbox_limit_reached") return fail("sandbox_limit_reached");
      if (error) unexpected(error);
      if (!data) throw new Error("open_sandbox returned nothing");
      return ok(toSandboxInfo(data));
    },

    /** Replaces the Sandbox's data with a fresh copy of the Template. Same Sandbox, same expiry. */
    startOver: (visitor: { today: Day }) =>
      inLiveSandbox(async () => {
        const { error } = await db.rpc("start_over", { today: visitor.today });
        if (error) unexpected(error);
        return ok(undefined);
      }),

    status,
  };

  return { area, inLiveSandbox };
}

function toSandboxInfo(row: { id: string; expires_at: string | null }): SandboxInfo {
  // Only the Template has no expiry, and RLS never shows the Template.
  return { id: row.id, expiresAt: new Date(row.expires_at!) };
}

import "server-only";
import { ok, unexpected, type CrmDb, type CrmSupabaseClient, type Result } from "./core";

export type SandboxInfo = { id: string; expiresAt: Date };
export type SandboxStatus = { state: "none" } | { state: "expired" } | { state: "live"; sandbox: SandboxInfo };

export function sandboxArea(supabase: CrmSupabaseClient, db: CrmDb) {
  /** A fresh anonymous session, dropping any old one. */
  async function signInAnonymously() {
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.signInAnonymously();
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

  return {
    /** "Open the demo": signs in anonymously if needed and returns the visitor's live Sandbox. */
    async open(): Promise<Result<SandboxInfo, never>> {
      await ensureLiveUser();

      let { data, error } = await db.rpc("open_sandbox");
      if (error?.message === "sandbox_expired") {
        // This visitor's Sandbox ran out: start over as a new anonymous visitor.
        await signInAnonymously();
        ({ data, error } = await db.rpc("open_sandbox"));
      }
      if (error) unexpected(error);
      if (!data) throw new Error("open_sandbox returned nothing");
      return ok(toSandboxInfo(data));
    },

    async status(): Promise<SandboxStatus> {
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims.sub;
      if (!userId) return { state: "none" };
      const { data, error } = await db.from("sandboxes").select("id, expires_at").eq("user_id", userId).maybeSingle();
      if (error) unexpected(error);
      if (!data) return { state: "none" };
      const sandbox = toSandboxInfo(data);
      if (sandbox.expiresAt.getTime() <= Date.now()) return { state: "expired" };
      return { state: "live", sandbox };
    },
  };
}

function toSandboxInfo(row: { id: string; expires_at: string | null }): SandboxInfo {
  // Only the Template has no expiry, and RLS never shows the Template.
  return { id: row.id, expiresAt: new Date(row.expires_at!) };
}

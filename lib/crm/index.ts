import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiProvider } from "@/lib/ai/provider";
import type { Database } from "@/lib/database.types";

/**
 * The CRM module: the one seam every page, form action and route handler uses
 * for data. It works through the visitor's own Supabase session, so the
 * database's RLS enforces Sandbox isolation even if code here has a bug.
 */

export type CrmSupabaseClient = SupabaseClient<Database>;
export type CrmDeps = { ai?: AiProvider };

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

/** Returned by every read or write when the visitor has no live Sandbox. */
export type NoLiveSandbox = "no_sandbox" | "sandbox_expired";

export type SandboxInfo = { id: string; expiresAt: Date };
export type SandboxStatus = { state: "none" } | { state: "expired" } | { state: "live"; sandbox: SandboxInfo };

/** The Persona or a Teammate, as shown wherever someone owns a record. */
export type OwnerRef = { id: string; firstName: string; lastName: string; initials: string };

/** A member of the Kestrel Studio team: the Persona or a Teammate. */
export type Owner = OwnerRef & { role: string; isPersona: boolean };

export type CompanyListItem = {
  id: string;
  name: string;
  industry: string;
  city: string;
  owner: OwnerRef;
  addedAt: Date;
};

export function createCrm(supabase: CrmSupabaseClient, deps: CrmDeps = {}) {
  void deps;
  const db = supabase.schema("crm");

  async function signedInUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getClaims();
    return data?.claims.sub ?? null;
  }

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

  async function status(): Promise<SandboxStatus> {
    const userId = await signedInUserId();
    if (!userId) return { state: "none" };
    const { data, error } = await db.from("sandboxes").select("id, expires_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return { state: "none" };
    const sandbox = toSandboxInfo(data);
    if (sandbox.expiresAt.getTime() <= Date.now()) return { state: "expired" };
    return { state: "live", sandbox };
  }

  /**
   * Runs `work` only for a visitor with a live Sandbox. RLS already hides
   * every row otherwise; this turns that into a result the UI can explain.
   */
  async function inLiveSandbox<T>(work: () => Promise<T>): Promise<Result<T, NoLiveSandbox>> {
    const current = await status();
    if (current.state === "none") return { ok: false, error: "no_sandbox" };
    if (current.state === "expired") return { ok: false, error: "sandbox_expired" };
    return { ok: true, value: await work() };
  }

  return {
    sandbox: {
      /** "Open the demo": signs in anonymously if needed and returns the visitor's live Sandbox. */
      async open(): Promise<Result<SandboxInfo, never>> {
        await ensureLiveUser();

        let { data, error } = await db.rpc("open_sandbox");
        if (error?.message === "sandbox_expired") {
          // This visitor's Sandbox ran out: start over as a new anonymous visitor.
          await signInAnonymously();
          ({ data, error } = await db.rpc("open_sandbox"));
        }
        if (error || !data) throw error ?? new Error("open_sandbox returned nothing");
        return { ok: true, value: toSandboxInfo(data) };
      },

      status,
    },

    team: {
      /** The Persona first, then Teammates by first name. */
      list: () =>
        inLiveSandbox(async (): Promise<Owner[]> => {
          const { data, error } = await db
            .from("teammates")
            .select("id, first_name, last_name, role, initials, is_persona")
            .order("is_persona", { ascending: false })
            .order("first_name");
          if (error) throw error;
          return data.map((row) => ({ ...toOwnerRef(row), role: row.role, isPersona: row.is_persona }));
        }),
    },

    companies: {
      /** Every Company in the Sandbox, by name. */
      list: () =>
        inLiveSandbox(async (): Promise<CompanyListItem[]> => {
          const { data, error } = await db
            .from("companies")
            .select("id, name, industry, city, added_at, owner:teammates!inner(id, first_name, last_name, initials)")
            .order("name");
          if (error) throw error;
          return data.map((row) => ({
            id: row.id,
            name: row.name,
            industry: row.industry,
            city: row.city,
            addedAt: new Date(row.added_at),
            owner: toOwnerRef(row.owner),
          }));
        }),
    },
  };
}

export type Crm = ReturnType<typeof createCrm>;

function toSandboxInfo(row: { id: string; expires_at: string | null }): SandboxInfo {
  // Only the Template has no expiry, and RLS never shows the Template.
  return { id: row.id, expiresAt: new Date(row.expires_at!) };
}

function toOwnerRef(row: { id: string; first_name: string; last_name: string; initials: string }): OwnerRef {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, initials: row.initials };
}

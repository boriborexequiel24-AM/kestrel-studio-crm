import "server-only";
import type { AiProvider } from "@/lib/ai/provider";
import { activitiesArea } from "./activities";
import { companiesArea } from "./companies";
import { contactsArea } from "./contacts";
import { fail, type CrmContext, type CrmSupabaseClient, type InLiveSandbox } from "./core";
import { sandboxArea } from "./sandbox";
import { teamArea } from "./team";

/**
 * The CRM module: the one seam every page, form action and route handler uses
 * for data. It works through the visitor's own Supabase session, so the
 * database's RLS enforces Sandbox isolation even if code here has a bug.
 */

export type { CrmSupabaseClient, NoLiveSandbox, OwnerRef, Result } from "./core";
export type { SandboxInfo, SandboxStatus } from "./sandbox";
export type { Owner } from "./team";
export type {
  Activity,
  CompanyDetail,
  CompanyFilter,
  CompanyInput,
  CompanyListItem,
  Contact,
} from "./companies";
export { ACTIVITY_KINDS, COMPANY_STATUSES, type ActivityKind, type CompanyStatus } from "./terms";
export type { ContactInput } from "./contacts";
export type { ActivityInput } from "./activities";

export type CrmDeps = { ai?: AiProvider };

export function createCrm(supabase: CrmSupabaseClient, deps: CrmDeps = {}) {
  void deps;
  const db = supabase.schema("crm");
  const sandbox = sandboxArea(supabase, db);

  // RLS already hides every row without a live Sandbox; this turns that into
  // a result the UI can explain.
  const inLiveSandbox: InLiveSandbox = async (work) => {
    const current = await sandbox.status();
    if (current.state === "none") return fail("no_sandbox");
    if (current.state === "expired") return fail("sandbox_expired");
    return work();
  };

  const context: CrmContext = { db, inLiveSandbox };
  return {
    sandbox,
    team: teamArea(context),
    companies: companiesArea(context),
    contacts: contactsArea(context),
    activities: activitiesArea(context),
  };
}

export type Crm = ReturnType<typeof createCrm>;

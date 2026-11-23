import "server-only";
import type { AiProvider } from "@/lib/ai/provider";
import { activitiesArea } from "./activities";
import { companiesArea } from "./companies";
import { contactsArea } from "./contacts";
import type { CrmContext, CrmSupabaseClient } from "./core";
import { sandboxArea, type SandboxLimits } from "./sandbox";
import { teamArea } from "./team";

/**
 * The CRM module: the one seam every page, form action and route handler uses
 * for data. It works through the visitor's own Supabase session, so the
 * database's RLS enforces Sandbox isolation even if code here has a bug.
 */

export type { CrmSupabaseClient, NoLiveSandbox, OwnerRef, Result } from "./core";
export type { SandboxInfo, SandboxLimits, SandboxStatus } from "./sandbox";
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
export type { ActivityFields, ActivityInput } from "./activities";

export type CrmDeps = { ai?: AiProvider; limits: SandboxLimits };

export function createCrm(supabase: CrmSupabaseClient, deps: CrmDeps) {
  const db = supabase.schema("crm");
  const { area: sandbox, inLiveSandbox } = sandboxArea(supabase, db, deps.limits);

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

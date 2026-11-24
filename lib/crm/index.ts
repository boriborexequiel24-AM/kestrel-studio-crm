import "server-only";
import type { AiProvider } from "@/lib/ai/provider";
import { activitiesArea } from "./activities";
import { aiArea, type AiLimits } from "./ai";
import { companiesArea } from "./companies";
import { contactsArea } from "./contacts";
import { dealsArea, pipelineArea } from "./deals";
import type { CrmContext, CrmSupabaseClient } from "./core";
import { homeArea } from "./home";
import { proposalsArea } from "./proposals";
import { retainersArea } from "./retainers";
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
export type { Activity } from "./activities";
export type { Contact } from "./contacts";
export type { DealCard, DealDetail, DealInput, DealTotals, NextStep, PipelineBoard } from "./deals";
export type {
  CompanyDetail,
  CompanyFilter,
  CompanyInput,
  CompanyListItem,
} from "./companies";
export {
  ACTIVITY_KINDS,
  COMPANY_STATUSES,
  CLOSED_STAGES,
  DEAL_STAGES,
  LOST_REASONS,
  MAX_MONTHLY_DOLLARS,
  MAX_TERM_MONTHS,
  OPEN_STAGES,
  isOpenStage,
  type ActivityKind,
  type ClosedStage,
  type CompanyStatus,
  type Day,
  type DealKind,
  type DealStage,
  type LostReason,
  type OpenStage,
  type ProposalStatus,
  type RetainerState,
} from "./terms";
export type { ContactInput } from "./contacts";
export type { LineItem, Proposal, ProposalInput } from "./proposals";
export type { Retainer } from "./retainers";
export type { HomeOverview } from "./home";
export type { AiActionsLeft, AiLimits, AiRefusal, Answer, ChatMessage, FollowUpDraft } from "./ai";
export type { Summary } from "./summaries";
export type { ActivityFields, ActivityInput } from "./activities";

export type CrmDeps = { ai: AiProvider; limits: SandboxLimits & AiLimits };

export function createCrm(supabase: CrmSupabaseClient, deps: CrmDeps) {
  const db = supabase.schema("crm");
  const { area: sandbox, inLiveSandbox } = sandboxArea(supabase, db, deps.limits);

  const context: CrmContext = { db, inLiveSandbox };
  const pipeline = pipelineArea(context);
  const retainers = retainersArea(context);
  const companies = companiesArea(context);
  const deals = dealsArea(context);
  const activities = activitiesArea(context);
  const team = teamArea(context);
  return {
    sandbox,
    team,
    companies,
    contacts: contactsArea(context),
    activities,
    deals,
    pipeline,
    proposals: proposalsArea(context),
    retainers,
    home: homeArea({ pipeline, retainers }),
    ai: aiArea(context, { provider: deps.ai, limits: deps.limits, companies, deals, pipeline, retainers, activities, team }),
  };
}

export type Crm = ReturnType<typeof createCrm>;

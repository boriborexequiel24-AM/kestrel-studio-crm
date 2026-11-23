import "server-only";
import { ACTIVITY_COLUMNS, toActivity, type Activity } from "./activities";
import { companyStatus } from "./companies";
import { CONTACT_COLUMNS, toContact, type Contact } from "./contacts";
import {
  OWNER_REF_COLUMNS,
  clean,
  fail,
  isId,
  isMissingReference,
  ok,
  toOwnerRef,
  unexpected,
  type CrmContext,
  type OwnerRef,
} from "./core";
import { listTeam, type Owner } from "./team";
import type { PostgrestError } from "@supabase/supabase-js";
import { DEAL_STAGES, OPEN_STAGES, isOpenStage, type CompanyStatus, type DealKind, type DealStage, type OpenStage } from "./terms";

/** A calendar day, "2026-11-24". Due dates are days, compared with the visitor's own today. */
export type Day = string;

export type NextStep = { text: string; due: Day | null; overdue: boolean };

/** What a Deal card on the board shows. */
export type DealCard = {
  id: string;
  title: string;
  kind: DealKind;
  stage: DealStage;
  /** USD a month: the estimate until a Proposal is sent (ticket 06). */
  monthlyValue: number;
  company: { id: string; name: string };
  owner: OwnerRef;
  nextStep: NextStep | null;
};

/** A Deal with everything its panel shows. */
export type DealDetail = DealCard & {
  company: { id: string; name: string; status: CompanyStatus };
  estimatedMonthlyValue: number;
  contacts: Contact[];
  activities: Activity[];
  /** Once a Deal has Activities, its Company can't change. */
  hasActivities: boolean;
};

export type PipelineBoard = {
  kpis: { openMonthlyValue: number; openDeals: number; overdueNextSteps: number };
  stages: { stage: OpenStage; count: number; monthlyValue: number }[];
  owners: { owner: Owner; monthlyValue: number }[];
  deals: DealCard[];
};

export type DealInput = {
  companyId: string;
  ownerId: string;
  title: string;
  estimatedMonthlyValue: number;
  nextStep?: string;
  nextStepDue?: Day | null;
};

const DEAL_COLUMNS = `id, title, kind, stage, estimated_monthly_value, next_step, next_step_due,
  company:companies!inner(id, name), owner:teammates!inner(${OWNER_REF_COLUMNS})`;

export function dealsArea({ db, inLiveSandbox }: CrmContext) {
  async function findDeal(id: string) {
    const { data, error } = await db.from("deals").select(DEAL_COLUMNS).eq("id", id).maybeSingle();
    if (error) unexpected(error);
    return data;
  }

  return {
    /** One Deal with its Company, the Company's Contacts and the Deal's Activities (newest first). */
    get: (id: string, view: { today: Day }) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const deal = await findDeal(id);
        if (!deal) return fail("not_found");
        const [contacts, activities] = await Promise.all([
          db.from("contacts").select(CONTACT_COLUMNS).eq("company_id", deal.company.id).order("name"),
          db.from("activities").select(ACTIVITY_COLUMNS).eq("deal_id", id).order("occurred_at", { ascending: false }),
        ]);
        if (contacts.error) unexpected(contacts.error);
        if (activities.error) unexpected(activities.error);
        const card = toCard(deal, view.today);
        return ok<DealDetail>({
          ...card,
          company: { ...card.company, status: companyStatus() },
          estimatedMonthlyValue: deal.estimated_monthly_value,
          contacts: contacts.data.map(toContact),
          activities: activities.data.map(toActivity),
          hasActivities: activities.data.length > 0,
        });
      }),

    /** A new Deal starts in New. */
    create: (input: DealInput) =>
      inLiveSandbox(async () => {
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        const { data, error } = await db.from("deals").insert(fields.value).select("id").single();
        if (error) return referenceFailure(error);
        return ok({ id: data.id });
      }),

    /** Edits a Deal. Its Company stays fixed once the Deal has Activities about it. */
    update: (id: string, input: DealInput) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        const { data, error } = await db.from("deals").update(fields.value).eq("id", id).select("id");
        if (error) return referenceFailure(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    /** Deletes the Deal. Its Activities stay on the Company, unlinked. */
    delete: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("deals").delete().eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    /** Sets or clears just the Next step. Empty text clears it. */
    setNextStep: (id: string, next: { text: string; due: Day | null }) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const due = checkDue(next.due);
        if (!due.ok) return due;
        const { data, error } = await db
          .from("deals")
          .update({ next_step: clean(next.text), next_step_due: due.value })
          .eq("id", id)
          .select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    /** Moves a Deal among the open Stages. Won and Lost come with Proposals and Lost reasons. */
    moveToStage: (id: string, stage: DealStage) =>
      inLiveSandbox(async () => {
        if (!DEAL_STAGES.includes(stage)) return fail("stage_unknown");
        if (!isOpenStage(stage)) return fail("stage_not_available");
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("deals").update({ stage }).eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),
  };
}

export function pipelineArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Open Deals in an Owner x Stage grid, with totals. "mine" keeps only the Persona's. */
    board: (view: { today: Day; owners: "everyone" | "mine" }) =>
      inLiveSandbox(async () => {
        const [team, deals] = await Promise.all([
          listTeam(db),
          db
            .from("deals")
            .select(DEAL_COLUMNS)
            .in("stage", [...OPEN_STAGES])
            .order("next_step_due", { ascending: true, nullsFirst: false })
            .order("title"),
        ]);
        if (deals.error) unexpected(deals.error);

        const owners = team.filter((owner) => view.owners === "everyone" || owner.isPersona);
        const ownerIds = new Set(owners.map((owner) => owner.id));
        const cards = deals.data.map((row) => toCard(row, view.today)).filter((card) => ownerIds.has(card.owner.id));
        const sum = (list: DealCard[]) => list.reduce((total, card) => total + card.monthlyValue, 0);

        return ok<PipelineBoard>({
          kpis: {
            openMonthlyValue: sum(cards),
            openDeals: cards.length,
            overdueNextSteps: cards.filter((card) => card.nextStep?.overdue).length,
          },
          stages: OPEN_STAGES.map((stage) => {
            const inStage = cards.filter((card) => card.stage === stage);
            return { stage, count: inStage.length, monthlyValue: sum(inStage) };
          }),
          owners: owners.map((owner) => ({ owner, monthlyValue: sum(cards.filter((card) => card.owner.id === owner.id)) })),
          deals: cards,
        });
      }),
  };
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whether text is a real calendar day such as "2026-02-28". */
function isDay(text: string): boolean {
  if (!DAY_PATTERN.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

/** A Next step's due day: empty means none; anything else must be a real day. */
function checkDue(due: Day | null | undefined) {
  if (!due) return ok(null);
  return isDay(due) ? ok(due) : fail("date_invalid");
}

function checkFields(input: DealInput) {
  const title = clean(input.title);
  if (!title) return fail("title_required");
  const value = input.estimatedMonthlyValue;
  if (!Number.isInteger(value) || value < 0) return fail("value_invalid");
  if (!isId(input.companyId)) return fail("company_not_found");
  if (!isId(input.ownerId)) return fail("owner_not_found");
  const due = checkDue(input.nextStepDue);
  if (!due.ok) return due;
  return ok({
    company_id: input.companyId,
    owner_id: input.ownerId,
    title,
    estimated_monthly_value: value,
    next_step: clean(input.nextStep),
    next_step_due: due.value,
  });
}

/** Why a Deal insert or update broke a link: its Company is fixed by its Activities, or a Company or Owner is missing. */
function referenceFailure(error: PostgrestError) {
  if (!isMissingReference(error)) unexpected(error);
  // Named in the migration: each Activity's Deal must be about the Activity's Company.
  if (error.message.includes("activities_deal_at_company")) return fail("company_fixed_by_activities");
  return error.message.includes("owner_id") ? fail("owner_not_found") : fail("company_not_found");
}

type DealRow = {
  id: string;
  title: string;
  kind: DealKind;
  stage: DealStage;
  estimated_monthly_value: number;
  next_step: string;
  next_step_due: string | null;
  company: { id: string; name: string };
  owner: { id: string; first_name: string; last_name: string; initials: string };
};

function toCard(row: DealRow, today: Day): DealCard {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    stage: row.stage,
    monthlyValue: row.estimated_monthly_value,
    company: row.company,
    owner: toOwnerRef(row.owner),
    nextStep: row.next_step
      ? { text: row.next_step, due: row.next_step_due, overdue: row.next_step_due !== null && row.next_step_due < today }
      : null,
  };
}

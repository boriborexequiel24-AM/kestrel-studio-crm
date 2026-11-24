import "server-only";
import { ACTIVITY_COLUMNS, toActivity, type Activity } from "./activities";
import { CONTACT_COLUMNS, toContact, type Contact } from "./contacts";
import {
  OWNER_REF_COLUMNS,
  clean,
  fail,
  isDay,
  isId,
  isMissingReference,
  isWholeDollars,
  ok,
  ruleBroken,
  toOwnerRef,
  unexpected,
  type CrmContext,
  type OwnerRef,
} from "./core";
import { PROPOSAL_COLUMNS, monthlyTotal, toProposal, type Proposal } from "./proposals";
import { RETAINER_COLUMNS, companyStatus, toRetainer, type Retainer } from "./retainers";
import { SEEN_COLUMNS, SUMMARY_COLUMNS, toSeen, toSummary, type Summary } from "./summaries";
import { listTeam, type Owner } from "./team";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  CLOSED_STAGES,
  DEAL_STAGES,
  LOST_REASONS,
  OPEN_STAGES,
  isOpenStage,
  type CompanyStatus,
  type Day,
  type DealKind,
  type DealStage,
  type LostReason,
  type OpenStage,
  type ProposalStatus,
} from "./terms";

export type NextStep = { text: string; due: Day | null; overdue: boolean };

/** What a Deal card on the board shows. */
export type DealCard = {
  id: string;
  title: string;
  kind: DealKind;
  stage: DealStage;
  /** USD a month: the Accepted or Sent Proposal's total, or the estimate when there is neither. */
  monthlyValue: number;
  /** The Proposal the Monthly value comes from; null means it's the estimate. */
  proposal: { version: number; status: "Sent" | "Accepted"; sentAt: Date | null } | null;
  company: { id: string; name: string };
  owner: OwnerRef;
  nextStep: NextStep | null;
  /** Why it was Lost; null unless it was. */
  lostReason: LostReason | null;
  /** The day it was Won or Lost, in the visitor's calendar; null while it's open. */
  closedOn: Day | null;
};

/** A Deal with everything its panel shows. */
export type DealDetail = DealCard & {
  company: { id: string; name: string; status: CompanyStatus };
  estimatedMonthlyValue: number;
  contacts: Contact[];
  activities: Activity[];
  /** Newest version first. */
  proposals: Proposal[];
  /** The Retainer a Renewal renews, or the one this Deal started, once it's Won. */
  retainer: Retainer | null;
  /** What the AI last wrote about its Company, if anything. */
  summary: Summary | null;
  /** Why the Deal's Company can't change: it renews that Company's Retainer, has Activities, or a Proposal was sent. */
  companyFixedBy: "Renewal" | "Activities" | "Proposal" | null;
};

export type DealTotals = { deals: number; monthlyValue: number };

export type PipelineBoard = {
  kpis: {
    openMonthlyValue: number;
    openDeals: number;
    overdueNextSteps: number;
    /** Deals with a Sent Proposal, and what those offers add up to a month. */
    proposalsOut: DealTotals;
    /** Deals won since the first of the visitor's month. */
    wonThisMonth: DealTotals;
  };
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

/** A new Deal is New business, unless it names the Retainer it renews. */
export type NewDealInput = DealInput & { renews?: { retainerId: string; today: Day } };

/** What a move to another Stage needs: Won the Proposal version confirmed, Lost its reason. */
export type StageMove = { today: Day; proposalVersion?: number; lostReason?: LostReason };

export const DEAL_COLUMNS = `id, title, kind, renews_retainer_id, stage, estimated_monthly_value, next_step, next_step_due, lost_reason, closed_on,
  company:companies!inner(id, name), owner:teammates!inner(${OWNER_REF_COLUMNS}),
  proposals(version, status, sent_at, line_items:proposal_line_items(monthly_fee))`;

export function dealsArea({ db, inLiveSandbox }: CrmContext) {
  async function findDeal(id: string) {
    const { data, error } = await db.from("deals").select(DEAL_COLUMNS).eq("id", id).maybeSingle();
    if (error) unexpected(error);
    return data;
  }

  async function win(id: string, { today, proposalVersion }: { today: Day; proposalVersion?: number }) {
    const { error } = await db.rpc("win_deal", { deal: id, today, proposal_version: proposalVersion });
    if (!error) return ok(undefined);
    const rule = ruleBroken(error, "not_found", "deal_already_won", "won_needs_sent_proposal", "proposal_changed", "renewal_already_open");
    return rule ? fail(rule) : unexpected(error);
  }

  /** Moves a Deal to an open Stage. A Lost one loses its reason. */
  async function open(id: string, stage: OpenStage) {
    const { data, error } = await db.from("deals").update({ stage, lost_reason: null, closed_on: null }).eq("id", id).select("id");
    if (error?.message.includes("deals_one_open_renewal")) return fail("renewal_already_open");
    if (error) return fail(ruleBroken(error, "deal_already_won") ?? unexpected(error));
    return data.length ? ok(undefined) : fail("not_found");
  }

  async function lose(id: string, { today, lostReason }: StageMove) {
    if (!lostReason || !LOST_REASONS.includes(lostReason)) return fail("lost_reason_required");
    const { data, error } = await db
      .from("deals")
      .update({ stage: "Lost", lost_reason: lostReason, closed_on: today })
      .eq("id", id)
      .neq("stage", "Lost")
      .select("id");
    if (error) return fail(ruleBroken(error, "deal_already_won") ?? unexpected(error));
    if (data.length) return ok(undefined);
    return fail((await findDeal(id)) ? "deal_already_lost" : "not_found");
  }

  /** What makes a new Deal a Renewal, if it is one. Its Company is checked by the database. */
  async function checkRenewal(renews: NewDealInput["renews"]) {
    if (!renews) return ok({});
    if (!isId(renews.retainerId)) return fail("retainer_not_found");
    const { data, error } = await db.from("retainers").select("end_date").eq("id", renews.retainerId).maybeSingle();
    if (error) unexpected(error);
    if (!data) return fail("retainer_not_found");
    if (data.end_date < renews.today) return fail("retainer_ended");
    return ok({ kind: "Renewal" as const, renews_retainer_id: renews.retainerId });
  }

  /** Whether a Proposal on this Deal was already sent to a Company other than this one. */
  async function offeredToAnotherCompany(id: string, companyId: string) {
    const { data, error } = await db.from("deals").select("company_id, proposals(sent_at)").eq("id", id).maybeSingle();
    if (error) unexpected(error);
    return data !== null && data.company_id !== companyId && data.proposals.some((proposal) => proposal.sent_at !== null);
  }

  return {
    /** One Deal with its Company, the Company's Contacts, the Deal's Proposals and Activities (newest first), and its Retainer. */
    get: (id: string, view: { today: Day }) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const deal = await findDeal(id);
        if (!deal) return fail("not_found");
        const [contacts, activities, proposals, retainers, summary, seen] = await Promise.all([
          db.from("contacts").select(CONTACT_COLUMNS).eq("company_id", deal.company.id).order("name"),
          db.from("activities").select(ACTIVITY_COLUMNS).eq("deal_id", id).order("occurred_at", { ascending: false }),
          db.from("proposals").select(PROPOSAL_COLUMNS).eq("deal_id", id).order("version", { ascending: false }),
          db.from("retainers").select(RETAINER_COLUMNS).eq("company_id", deal.company.id),
          db.from("ai_summaries").select(SUMMARY_COLUMNS).eq("company_id", deal.company.id).maybeSingle(),
          db.from("activities").select(SEEN_COLUMNS).eq("company_id", deal.company.id),
        ]);
        if (contacts.error) unexpected(contacts.error);
        if (activities.error) unexpected(activities.error);
        if (proposals.error) unexpected(proposals.error);
        if (retainers.error) unexpected(retainers.error);
        if (summary.error) unexpected(summary.error);
        if (seen.error) unexpected(seen.error);
        const card = toCard(deal, view.today);
        const retainer = retainers.data.find((each) => each.id === deal.renews_retainer_id || each.deal.id === id);
        return ok<DealDetail>({
          ...card,
          company: { ...card.company, status: companyStatus(retainers.data, view.today) },
          estimatedMonthlyValue: deal.estimated_monthly_value,
          contacts: contacts.data.map(toContact),
          activities: activities.data.map(toActivity),
          proposals: proposals.data.map(toProposal),
          retainer: retainer ? toRetainer(retainer, view.today) : null,
          summary: toSummary(summary.data, seen.data.map(toSeen)),
          companyFixedBy: companyFixedBy(deal.kind, activities.data.length > 0, proposals.data.some((each) => each.sent_at !== null)),
        });
      }),

    /** A new Deal starts in New. A Renewal starts before its Retainer ends, and a Retainer has one open at a time. */
    create: (input: NewDealInput) =>
      inLiveSandbox(async () => {
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        const renewal = await checkRenewal(input.renews);
        if (!renewal.ok) return renewal;
        const { data, error } = await db.from("deals").insert({ ...fields.value, ...renewal.value }).select("id").single();
        if (error?.message.includes("deals_renews_retainer")) return fail("retainer_not_found");
        if (error?.message.includes("deals_one_open_renewal")) return fail("renewal_already_open");
        if (error) return referenceFailure(error);
        return ok({ id: data.id });
      }),

    /** Edits a Deal. Its Company stays fixed if it's a Renewal, has Activities or a Proposal was sent. */
    update: (id: string, input: DealInput) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        if (await offeredToAnotherCompany(id, input.companyId)) return fail("company_fixed_by_proposal");
        const { data, error } = await db.from("deals").update(fields.value).eq("id", id).select("id");
        if (error) return referenceFailure(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    /** Deletes the Deal, unless it's Won. Its Activities stay on the Company, unlinked. */
    delete: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("deals").delete().eq("id", id).select("id");
        if (error) return fail(ruleBroken(error, "deal_already_won") ?? unexpected(error));
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

    /**
     * Moves a Deal to a Stage. Won accepts its Sent Proposal and starts the
     * Retainer (or extends it, for a Renewal), all in one step, and is final:
     * pass the Proposal version that was confirmed, and any other is refused.
     * Lost needs a Lost reason, and can be undone by moving to an open Stage.
     */
    moveToStage: (id: string, stage: DealStage, move: StageMove) =>
      inLiveSandbox(async () => {
        if (!DEAL_STAGES.includes(stage)) return fail("stage_unknown");
        if (!isId(id)) return fail("not_found");
        if (stage === "Won") return win(id, move);
        return isOpenStage(stage) ? open(id, stage) : lose(id, move);
      }),
  };
}

/** Whose work a view shows, the Persona's or the whole team's, on the visitor's own today. */
export type PipelineScope = { today: Day; owners: "everyone" | "mine" };

/** The Owners a view covers: the Persona, or the whole team. */
export const inScope = (team: Owner[], { owners }: PipelineScope) => team.filter((owner) => owners === "everyone" || owner.isPersona);

export function pipelineArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Open Deals in an Owner x Stage grid, with totals. "mine" keeps only the Persona's. */
    board: (view: PipelineScope) =>
      inLiveSandbox(async () => {
        const [team, deals, won] = await Promise.all([
          listTeam(db),
          db
            .from("deals")
            .select(DEAL_COLUMNS)
            .in("stage", [...OPEN_STAGES])
            .order("next_step_due", { ascending: true, nullsFirst: false })
            .order("title"),
          db.from("deals").select(DEAL_COLUMNS).eq("stage", "Won").gte("closed_on", firstOfMonth(view.today)).lte("closed_on", view.today),
        ]);
        if (deals.error) unexpected(deals.error);
        if (won.error) unexpected(won.error);

        const owners = inScope(team, view);
        const ownerIds = new Set(owners.map((owner) => owner.id));
        const toCards = (rows: typeof deals.data) =>
          rows.map((row) => toCard(row, view.today)).filter((card) => ownerIds.has(card.owner.id));
        const cards = toCards(deals.data);
        const sum = (list: DealCard[]) => list.reduce((total, card) => total + card.monthlyValue, 0);
        const totals = (list: DealCard[]): DealTotals => ({ deals: list.length, monthlyValue: sum(list) });

        return ok<PipelineBoard>({
          kpis: {
            openMonthlyValue: sum(cards),
            openDeals: cards.length,
            overdueNextSteps: cards.filter((card) => card.nextStep?.overdue).length,
            proposalsOut: totals(cards.filter((card) => card.proposal?.status === "Sent")),
            wonThisMonth: totals(toCards(won.data)),
          },
          stages: OPEN_STAGES.map((stage) => {
            const inStage = cards.filter((card) => card.stage === stage);
            return { stage, count: inStage.length, monthlyValue: sum(inStage) };
          }),
          owners: owners.map((owner) => ({ owner, monthlyValue: sum(cards.filter((card) => card.owner.id === owner.id)) })),
          deals: cards,
        });
      }),

    /** Won and Lost Deals, the latest first. "mine" keeps only the Persona's. */
    closed: (view: PipelineScope) =>
      inLiveSandbox(async () => {
        const [team, deals] = await Promise.all([
          listTeam(db),
          db.from("deals").select(DEAL_COLUMNS).in("stage", [...CLOSED_STAGES]).order("closed_on", { ascending: false }).order("title").order("id"),
        ]);
        if (deals.error) unexpected(deals.error);
        const ownerIds = new Set(inScope(team, view).map((owner) => owner.id));
        return ok(deals.data.map((row) => toCard(row, view.today)).filter((card) => ownerIds.has(card.owner.id)));
      }),
  };
}

/** "2026-11-24" to "2026-11-01". */
function firstOfMonth(day: Day): Day {
  return `${day.slice(0, 8)}01`;
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
  if (!isWholeDollars(value)) return fail("value_invalid");
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

function companyFixedBy(kind: DealKind, hasActivities: boolean, proposalSent: boolean): DealDetail["companyFixedBy"] {
  if (kind === "Renewal") return "Renewal";
  if (hasActivities) return "Activities";
  return proposalSent ? "Proposal" : null;
}

/** Why a Deal insert or update broke a link: its Company is fixed by its Activities, or a Company or Owner is missing. */
function referenceFailure(error: PostgrestError) {
  if (!isMissingReference(error)) unexpected(error);
  // Named in the migrations: a Renewal is at its Retainer's Company, and each
  // Activity's Deal is about the Activity's Company.
  if (error.message.includes("deals_renews_retainer")) return fail("company_fixed_by_renewal");
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
  lost_reason: LostReason | null;
  closed_on: string | null;
  company: { id: string; name: string };
  owner: { id: string; first_name: string; last_name: string; initials: string };
  proposals: { version: number; status: ProposalStatus; sent_at: string | null; line_items: { monthly_fee: number }[] }[];
};

/** The offer a Deal's Monthly value comes from. A Deal never has both a Sent and an Accepted Proposal. */
function liveProposal(row: DealRow) {
  for (const { version, status, sent_at, line_items } of row.proposals) {
    if (status === "Sent" || status === "Accepted") return { version, status, sentAt: sent_at === null ? null : new Date(sent_at), line_items };
  }
  return null;
}

export function toCard(row: DealRow, today: Day): DealCard {
  const offer = liveProposal(row);
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    stage: row.stage,
    monthlyValue: offer ? monthlyTotal(offer.line_items) : row.estimated_monthly_value,
    proposal: offer && { version: offer.version, status: offer.status, sentAt: offer.sentAt },
    company: row.company,
    owner: toOwnerRef(row.owner),
    nextStep: row.next_step
      ? {
          text: row.next_step,
          due: row.next_step_due,
          overdue: isOpenStage(row.stage) && row.next_step_due !== null && row.next_step_due < today,
        }
      : null,
    lostReason: row.lost_reason,
    closedOn: row.closed_on,
  };
}

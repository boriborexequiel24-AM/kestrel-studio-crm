import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { clean, fail, isId, isWholeDollars, ok, ruleBroken, unexpected, type CrmContext } from "./core";
import { MAX_TERM_MONTHS, type ProposalStatus } from "./terms";

export type LineItem = { service: string; monthlyFee: number };

export type Proposal = {
  id: string;
  version: number;
  status: ProposalStatus;
  scopeSummary: string;
  termMonths: number;
  lineItems: LineItem[];
  /** The sum of the line items. */
  monthlyTotal: number;
  sentAt: Date | null;
};

/** What Maya sets on a Draft. */
export type ProposalInput = { scopeSummary: string; termMonths: number; lineItems: LineItem[] };

export const PROPOSAL_COLUMNS =
  "id, version, status, scope_summary, term_months, sent_at, line_items:proposal_line_items(position, service, monthly_fee)";

export function proposalsArea({ db, inLiveSandbox }: CrmContext) {
  /** Moves a Proposal from one status to the next, or says it isn't in the first one. */
  async function moveStatus<E extends string>(
    id: string,
    from: ProposalStatus,
    change: { status: ProposalStatus; sent_at?: string },
    wrongStatus: E,
  ) {
    if (!isId(id)) return fail("not_found");
    const { data, error } = await db.from("proposals").update(change).eq("id", id).eq("status", from).select("id");
    if (error) return fail(isSecondSent(error) ? "another_proposal_sent" : (ruleBroken(error, "deal_already_won") ?? unexpected(error)));
    if (data.length) return ok(undefined);
    const existing = await db.from("proposals").select("id").eq("id", id).maybeSingle();
    if (existing.error) unexpected(existing.error);
    return existing.data ? fail(wrongStatus) : fail("not_found");
  }

  return {
    /** A new Draft on a Deal, with the Deal's next version number. */
    createDraft: (dealId: string, input: ProposalInput) =>
      inLiveSandbox(async () => {
        if (!isId(dealId)) return fail("not_found");
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        const { data, error } = await db.rpc("draft_proposal", { deal: dealId, ...fields.value });
        if (error) return fail(ruleBroken(error, "not_found", "deal_already_won") ?? unexpected(error));
        return ok({ id: data });
      }),

    /** Replaces a Draft's scope, term and line items. */
    editDraft: (id: string, input: ProposalInput) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        const { error } = await db.rpc("edit_proposal_draft", { proposal: id, ...fields.value });
        if (error?.message === "not_found") return fail("not_found");
        if (error?.message === "proposal_not_draft") return fail("proposal_not_draft");
        if (error) unexpected(error);
        return ok(undefined);
      }),

    /** Makes a Draft the Deal's live offer. Nothing is really sent. The Deal's Stage stays as it is. */
    markSent: (id: string) =>
      inLiveSandbox(() => moveStatus(id, "Draft", { status: "Sent", sent_at: new Date().toISOString() }, "proposal_not_draft")),

    /** Records that the Company turned the offer down. The Deal stays open, in its Stage. */
    markDeclined: (id: string) => inLiveSandbox(() => moveStatus(id, "Sent", { status: "Declined" }, "proposal_not_sent")),
  };
}

/** Named in the migration: at most one Sent Proposal per Deal. */
function isSecondSent(error: PostgrestError): boolean {
  return error.code === "23505" && error.message.includes("proposals_one_sent");
}

/** The rules for a Draft: what to write, or the rule it breaks. */
function checkFields(input: ProposalInput) {
  const scope = clean(input.scopeSummary);
  if (!scope) return fail("scope_required");
  const term = input.termMonths;
  if (!Number.isInteger(term) || term < 1 || term > MAX_TERM_MONTHS) return fail("term_invalid");
  if (!input.lineItems.length) return fail("line_items_required");
  const items = input.lineItems.map((item) => ({ service: clean(item.service), monthly_fee: item.monthlyFee }));
  if (items.some((item) => !item.service)) return fail("service_required");
  if (!items.every((item) => isWholeDollars(item.monthly_fee))) return fail("fee_invalid");
  // The total becomes the Retainer's fee, so it has the same limit.
  if (!isWholeDollars(monthlyTotal(items))) return fail("total_too_large");
  return ok({ scope, term, items });
}

/** A Proposal's monthly total always comes from its line items. */
export function monthlyTotal(lineItems: { monthly_fee: number }[]): number {
  return lineItems.reduce((total, item) => total + item.monthly_fee, 0);
}

export function toProposal(row: {
  id: string;
  version: number;
  status: ProposalStatus;
  scope_summary: string;
  term_months: number;
  sent_at: string | null;
  line_items: { position: number; service: string; monthly_fee: number }[];
}): Proposal {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    scopeSummary: row.scope_summary,
    termMonths: row.term_months,
    lineItems: row.line_items
      .toSorted((a, b) => a.position - b.position)
      .map((item) => ({ service: item.service, monthlyFee: item.monthly_fee })),
    monthlyTotal: monthlyTotal(row.line_items),
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
  };
}

// Domain terms shared with client components, so no server-only import here.

export type ActivityKind = "Email" | "Call" | "Meeting" | "Note";
export const ACTIVITY_KINDS: readonly ActivityKind[] = ["Email", "Call", "Meeting", "Note"];

/** A calendar day, "2026-11-24". Due dates are days, compared with the visitor's own today. */
export type Day = string;

/** Whole days from one calendar day to another: "2026-11-24" to "2026-11-26" is 2. */
export function daysFrom(from: Day, to: Day): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}

export type DealStage = "New" | "Qualified" | "Discovery" | "Proposal sent" | "Negotiation" | "Won" | "Lost";
export const DEAL_STAGES: readonly DealStage[] = ["New", "Qualified", "Discovery", "Proposal sent", "Negotiation", "Won", "Lost"];
export type ClosedStage = "Won" | "Lost";
export const CLOSED_STAGES: readonly ClosedStage[] = ["Won", "Lost"];
export type OpenStage = Exclude<DealStage, ClosedStage>;
export const OPEN_STAGES: readonly OpenStage[] = ["New", "Qualified", "Discovery", "Proposal sent", "Negotiation"];
export const isOpenStage = (stage: DealStage): stage is OpenStage => (OPEN_STAGES as readonly string[]).includes(stage);

/** Why a Deal was Lost. */
export type LostReason = "Price" | "Timing" | "Chose another agency" | "Went in-house" | "No response" | "Other";
export const LOST_REASONS: readonly LostReason[] = ["Price", "Timing", "Chose another agency", "Went in-house", "No response", "Other"];

export type DealKind = "New business" | "Renewal";

/** Monthly values and fees are whole US dollars, up to this. */
export const MAX_MONTHLY_DOLLARS = 10_000_000;
export const MAX_TERM_MONTHS = 60;

export type ProposalStatus = "Draft" | "Sent" | "Accepted" | "Declined";

/** Where a Retainer is, by the visitor's calendar. "Ends soon" ones are still active. */
export type RetainerState = "Active" | "Ends soon" | "Ended";

/** Derived, never stored: a Client has an active Retainer, a Prospect doesn't. */
export type CompanyStatus = "Client" | "Prospect";
export const COMPANY_STATUSES: readonly CompanyStatus[] = ["Client", "Prospect"];

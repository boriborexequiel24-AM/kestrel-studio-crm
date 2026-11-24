// Domain terms shared with client components, so no server-only import here.

export type ActivityKind = "Email" | "Call" | "Meeting" | "Note";
export const ACTIVITY_KINDS: readonly ActivityKind[] = ["Email", "Call", "Meeting", "Note"];

/** A calendar day, "2026-11-24". Due dates are days, compared with the visitor's own today. */
export type Day = string;

export type DealStage = "New" | "Qualified" | "Discovery" | "Proposal sent" | "Negotiation" | "Won" | "Lost";
export const DEAL_STAGES: readonly DealStage[] = ["New", "Qualified", "Discovery", "Proposal sent", "Negotiation", "Won", "Lost"];
export type OpenStage = Exclude<DealStage, "Won" | "Lost">;
export const OPEN_STAGES: readonly OpenStage[] = ["New", "Qualified", "Discovery", "Proposal sent", "Negotiation"];
export const isOpenStage = (stage: DealStage): stage is OpenStage => (OPEN_STAGES as readonly string[]).includes(stage);

export type DealKind = "New business" | "Renewal";

/** Derived, never stored: a Client has an active Retainer, a Prospect doesn't. */
export type CompanyStatus = "Client" | "Prospect";
export const COMPANY_STATUSES: readonly CompanyStatus[] = ["Client", "Prospect"];

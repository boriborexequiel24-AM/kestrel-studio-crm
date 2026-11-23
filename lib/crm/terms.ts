// Domain terms shared with client components, so no server-only import here.

export type ActivityKind = "Email" | "Call" | "Meeting" | "Note";
export const ACTIVITY_KINDS: readonly ActivityKind[] = ["Email", "Call", "Meeting", "Note"];

/** Derived, never stored: a Client has an active Retainer, a Prospect doesn't. */
export type CompanyStatus = "Client" | "Prospect";
export const COMPANY_STATUSES: readonly CompanyStatus[] = ["Client", "Prospect"];

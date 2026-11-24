import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/form-state";
import type { NoLiveSandbox, Result } from "@/lib/crm";
import { landingFor } from "@/lib/crm/server";
import { MAX_MONTHLY_DOLLARS, MAX_TERM_MONTHS } from "@/lib/crm/terms";
import { usd } from "@/lib/format";

// What each rule the CRM module can report means to Maya, and which form field it belongs to.
const MESSAGES: Record<string, { message: string; field?: string }> = {
  name_required: { message: "Add a name.", field: "name" },
  title_required: { message: "Give the Deal a title.", field: "title" },
  owner_not_found: { message: "Pick an Owner from the team.", field: "ownerId" },
  not_found: { message: "This record no longer exists. Reload the page." },
  company_not_found: { message: "Pick a Company that still exists.", field: "companyId" },
  company_fixed_by_activities: {
    message: "This Deal already has Activities about its Company, so its Company can't change.",
    field: "companyId",
  },
  contact_not_found: { message: "That Contact doesn't work at this Company.", field: "contactId" },
  deal_not_found: { message: "That Deal isn't about this Company." },
  company_fixed_by_proposal: {
    message: "A Proposal was already sent to this Deal's Company, so its Company can't change.",
    field: "companyId",
  },
  text_required: { message: "Write what happened.", field: "text" },
  kind_unknown: { message: "Pick Email, Call, Meeting or Note.", field: "kind" },
  date_required: { message: "Pick a date.", field: "date" },
  date_in_future: { message: "An Activity can't be dated in the future.", field: "date" },
  date_invalid: { message: "Pick a real date.", field: "nextStepDue" },
  value_invalid: { message: `Enter the Monthly value in whole dollars, from 0 to ${usd(MAX_MONTHLY_DOLLARS)}.`, field: "estimatedMonthlyValue" },
  scope_required: { message: "Say what the Proposal covers.", field: "scopeSummary" },
  term_invalid: { message: `Enter a term from 1 to ${MAX_TERM_MONTHS} months.`, field: "termMonths" },
  line_items_required: { message: "Add at least one line item.", field: "lineItems" },
  service_required: { message: "Name the service on every line item.", field: "service" },
  fee_invalid: { message: `Enter each monthly fee in whole dollars, from 0 to ${usd(MAX_MONTHLY_DOLLARS)}.`, field: "monthlyFee" },
  total_too_large: { message: `Keep the line items' total to ${usd(MAX_MONTHLY_DOLLARS)} a month or less.`, field: "monthlyFee" },
  another_proposal_sent: { message: "Another Proposal is already Sent on this Deal. Mark it as Declined first." },
  proposal_not_draft: { message: "This Proposal is no longer a Draft. Reload the page." },
  proposal_not_sent: { message: "Only a Sent Proposal can be declined. Reload the page." },
  stage_unknown: { message: "Pick one of the Pipeline's Stages.", field: "stage" },
  won_needs_sent_proposal: { message: "Won needs a Sent Proposal. Mark one as Sent first.", field: "stage" },
  proposal_changed: { message: "The Sent Proposal changed while you were deciding. Reload the page to see the new one." },
  deal_already_won: { message: "This Deal is already Won, and Won is final. Reload the page." },
  retainer_not_found: { message: "That Retainer isn't at this Company anymore. Reload the page." },
  renewal_already_open: { message: "This Retainer already has an open Renewal. Reload the page to see it." },
  company_fixed_by_renewal: { message: "A Renewal stays at the Company whose Retainer it renews.", field: "companyId" },
  end_date_invalid: { message: "Pick a real end date.", field: "endDate" },
  end_date_too_far: { message: "Pick an end date no later than the year 2200.", field: "endDate" },
  end_date_changed: { message: "This Retainer's end date changed while you were editing. Reload the page to see it.", field: "endDate" },
  retainer_ended: { message: "This Retainer has ended. Start a new Deal instead." },
  end_before_start: { message: "A Retainer can't end before it starts.", field: "endDate" },
  stage_not_available: { message: "That Stage isn't available for this Deal yet.", field: "stage" },
};

/**
 * Turns a CRM result into what a form shows: saved (and the page refreshes),
 * or the rule it broke with what was typed. A lost Sandbox goes to the landing page.
 */
export function toFormState<E extends string>(result: Result<unknown, E | NoLiveSandbox>, form: FormData): FormState {
  if (result.ok) {
    refresh();
    return { status: "saved", at: Date.now() };
  }
  const error: string = result.error;
  if (error === "no_sandbox" || error === "sandbox_expired") redirect(landingFor(error));
  const known = MESSAGES[error] ?? { message: "Something went wrong. Try again." };
  const values = Object.fromEntries([...form].map(([name, value]) => [name, String(value)]));
  return { status: "error", ...known, values, at: Date.now() };
}

/** A form field as text ("" when missing). */
export function formText(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/form-state";
import type { NoLiveSandbox, Result } from "@/lib/crm";
import { landingFor } from "@/lib/crm/server";

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
  text_required: { message: "Write what happened.", field: "text" },
  kind_unknown: { message: "Pick Email, Call, Meeting or Note.", field: "kind" },
  date_required: { message: "Pick a date.", field: "date" },
  date_in_future: { message: "An Activity can't be dated in the future.", field: "date" },
  date_invalid: { message: "Pick a real date.", field: "nextStepDue" },
  value_invalid: { message: "Enter the Monthly value in whole dollars, 0 or more.", field: "estimatedMonthlyValue" },
  stage_unknown: { message: "Pick one of the Pipeline's Stages.", field: "stage" },
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

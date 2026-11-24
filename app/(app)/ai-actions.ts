"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/forms/form-state";
import type { FollowUpDraft } from "@/lib/crm";
import { getCrm } from "@/lib/crm/server";
import { formText as text, toFormState } from "@/lib/form-results";
import { visitorToday } from "@/lib/visitor-day";

/** A failed action still counts, and a spent limit may be news, so the number left on the page is old. */
function refreshActionsLeft(result: { ok: boolean; error?: string }) {
  if (!result.ok && result.error?.startsWith("ai_")) refresh();
}

export async function summarizeCompany(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const written = await crm.ai.summarize(text(form, "companyId"), { today: await visitorToday() });
  refreshActionsLeft(written);
  return toFormState(written, form);
}

/** A draft comes back with the report: it lives only in the page. */
export type DraftState = FormState & { draft?: FollowUpDraft };

export async function draftFollowUp(_state: DraftState, form: FormData): Promise<DraftState> {
  const crm = await getCrm();
  const drafted = await crm.ai.draftFollowUp(text(form, "dealId"), {
    today: await visitorToday(),
    instruction: text(form, "instruction"),
  });
  refreshActionsLeft(drafted);
  const report = toFormState(drafted, form);
  return drafted.ok ? { ...report, draft: drafted.value } : report;
}

/** Nothing is sent: this records an Email Activity. */
export async function logDraftAsSent(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(
    await crm.ai.logAsSent(text(form, "dealId"), { text: text(form, "text"), contactId: text(form, "contactId") || null }),
    form,
  );
}

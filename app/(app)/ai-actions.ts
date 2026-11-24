"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/form-state";
import type { Answer, ChatMessage, FollowUpDraft } from "@/lib/crm";
import { getCrm, landingFor } from "@/lib/crm/server";
import { formText as text, messageFor, toFormState } from "@/lib/form-results";
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

export type AskReport = { ok: true; answer: Answer } | { ok: false; message: string };

/** The chat comes along each time: it lives in the visitor's tab and nowhere else. */
export async function askPipeline(messages: ChatMessage[]): Promise<AskReport> {
  const crm = await getCrm();
  const asked = await crm.ai.ask({ today: await visitorToday(), messages });
  if (!asked.ok && (asked.error === "no_sandbox" || asked.error === "sandbox_expired")) redirect(landingFor(asked.error));
  // Answered or not, the number of actions left on the page is old.
  refresh();
  return asked.ok ? { ok: true, answer: asked.value } : { ok: false, message: messageFor(asked.error).message };
}

/** Nothing is sent: this records an Email Activity. */
export async function logDraftAsSent(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(
    await crm.ai.logAsSent(text(form, "dealId"), { text: text(form, "text"), contactId: text(form, "contactId") || null }),
    form,
  );
}

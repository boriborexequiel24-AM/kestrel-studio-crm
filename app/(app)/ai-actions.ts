"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/forms/form-state";
import { getCrm } from "@/lib/crm/server";
import { formText as text, toFormState } from "@/lib/form-results";
import { visitorToday } from "@/lib/visitor-day";

export async function summarizeCompany(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const written = await crm.ai.summarize(text(form, "companyId"), { today: await visitorToday() });
  // A failed action still counts, and a spent limit may be news, so the number left on the page is old.
  if (!written.ok && written.error.startsWith("ai_")) refresh();
  return toFormState(written, form);
}

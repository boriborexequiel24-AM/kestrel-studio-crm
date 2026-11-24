"use server";

import type { FormState } from "@/components/forms/form-state";
import { getCrm } from "@/lib/crm/server";
import { formText as text, toFormState } from "@/lib/form-results";

export async function setRetainerEndDate(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.retainers.setEndDate(text(form, "retainerId"), text(form, "endDate")), form);
}

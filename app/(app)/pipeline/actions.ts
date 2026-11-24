"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/form-state";
import { choiceQuery, readChoice } from "@/components/pipeline/pipeline-choice";
import type { DealStage, LostReason } from "@/lib/crm";
import { getCrm } from "@/lib/crm/server";
import { formText as text, toFormState } from "@/lib/form-results";
import { visitorToday } from "@/lib/visitor-day";

/** Keeps what the Pipeline was showing across a redirect. */
function pipelineQuery(form: FormData) {
  return choiceQuery(readChoice((name) => text(form, name)));
}

/** Empty or non-numeric text becomes NaN, which the CRM module refuses with the right message. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function dealFields(form: FormData) {
  return {
    companyId: text(form, "companyId"),
    ownerId: text(form, "ownerId"),
    title: text(form, "title"),
    estimatedMonthlyValue: toNumber(text(form, "estimatedMonthlyValue")),
    nextStep: text(form, "nextStep"),
    nextStepDue: text(form, "nextStepDue") || null,
  };
}

export async function createDeal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const retainerId = text(form, "renewsRetainerId");
  const renews = retainerId ? { retainerId, today: await visitorToday() } : undefined;
  const created = await crm.deals.create({ ...dealFields(form), renews });
  if (created.ok) redirect(`/deals/${created.value.id}${pipelineQuery(form)}`);
  return toFormState(created, form);
}

export async function updateDeal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.deals.update(text(form, "dealId"), dealFields(form)), form);
}

export async function deleteDeal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const deleted = await crm.deals.delete(text(form, "dealId"));
  if (deleted.ok || deleted.error === "not_found") redirect(`/pipeline${pipelineQuery(form)}`);
  return toFormState(deleted, form);
}

export async function moveDeal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const move = {
    today: await visitorToday(),
    proposalVersion: Number(text(form, "proposalVersion")) || undefined,
    lostReason: (text(form, "lostReason") || undefined) as LostReason | undefined,
  };
  return toFormState(await crm.deals.moveToStage(text(form, "dealId"), text(form, "stage") as DealStage, move), form);
}

export async function setNextStep(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(
    await crm.deals.setNextStep(text(form, "dealId"), { text: text(form, "nextStep"), due: text(form, "nextStepDue") || null }),
    form,
  );
}

function proposalFields(form: FormData) {
  const fees = form.getAll("monthlyFee");
  return {
    scopeSummary: text(form, "scopeSummary"),
    termMonths: toNumber(text(form, "termMonths")),
    lineItems: form.getAll("service").map((service, index) => ({
      service: String(service),
      monthlyFee: toNumber(String(fees[index] ?? "")),
    })),
  };
}

export async function createProposal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.proposals.createDraft(text(form, "dealId"), proposalFields(form)), form);
}

export async function editProposal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.proposals.editDraft(text(form, "proposalId"), proposalFields(form)), form);
}

export async function sendProposal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.proposals.markSent(text(form, "proposalId")), form);
}

export async function declineProposal(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.proposals.markDeclined(text(form, "proposalId")), form);
}

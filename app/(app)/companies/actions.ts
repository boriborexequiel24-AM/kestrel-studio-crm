"use server";

import { redirect } from "next/navigation";
import type { ActivityKind } from "@/lib/crm";
import { getCrm } from "@/lib/crm/server";
import type { FormState } from "@/components/forms/form-state";
import { formText as text, toFormState } from "@/lib/form-results";

function companyFields(form: FormData) {
  return {
    name: text(form, "name"),
    industry: text(form, "industry"),
    city: text(form, "city"),
    ownerId: text(form, "ownerId"),
  };
}

export async function createCompany(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const created = await crm.companies.create(companyFields(form));
  if (created.ok) redirect(`/companies/${created.value.id}`);
  return toFormState(created, form);
}

export async function updateCompany(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.companies.update(text(form, "companyId"), companyFields(form)), form);
}

export async function deleteCompany(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const deleted = await crm.companies.delete(text(form, "companyId"));
  if (deleted.ok || deleted.error === "not_found") redirect("/companies");
  return toFormState(deleted, form);
}

function contactFields(form: FormData) {
  return { name: text(form, "name"), jobTitle: text(form, "jobTitle"), email: text(form, "email"), phone: text(form, "phone") };
}

export async function saveContact(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  const contactId = text(form, "contactId");
  const saved = contactId
    ? await crm.contacts.update(contactId, contactFields(form))
    : await crm.contacts.create(text(form, "companyId"), contactFields(form));
  return toFormState(saved, form);
}

export async function deleteContact(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.contacts.delete(text(form, "contactId")), form);
}

function activityFields(form: FormData) {
  // The browser sends "now" for today, or a moment in the visitor's time zone.
  const when = text(form, "occurredAt");
  return {
    contactId: text(form, "contactId") || null,
    kind: text(form, "kind") as ActivityKind,
    occurredAt: when === "now" ? new Date() : new Date(when),
    text: text(form, "text"),
  };
}

export async function logActivity(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(
    await crm.activities.log({
      ...activityFields(form),
      companyId: text(form, "companyId"),
      dealId: text(form, "dealId") || null,
    }),
    form,
  );
}

export async function updateActivity(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.activities.update(text(form, "activityId"), activityFields(form)), form);
}

export async function deleteActivity(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.activities.delete(text(form, "activityId")), form);
}

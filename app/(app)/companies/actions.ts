"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActivityKind, NoLiveSandbox, Result } from "@/lib/crm";
import { getCrm } from "@/lib/crm/server";
import type { FormState } from "@/components/forms/form-state";

// What each rule the CRM module can report means to Maya, and which field it belongs to.
const MESSAGES: Record<string, { message: string; field?: string }> = {
  name_required: { message: "Add a name.", field: "name" },
  owner_not_found: { message: "Pick an Owner from the team.", field: "ownerId" },
  not_found: { message: "This record no longer exists. Reload the page." },
  company_not_found: { message: "This Company no longer exists. Reload the page." },
  contact_not_found: { message: "That Contact doesn't work at this Company.", field: "contactId" },
  text_required: { message: "Write what happened.", field: "text" },
  kind_unknown: { message: "Pick Email, Call, Meeting or Note.", field: "kind" },
  date_required: { message: "Pick a date.", field: "date" },
  date_in_future: { message: "An Activity can't be dated in the future.", field: "date" },
};

/** Turns a CRM result into form state; a lost Sandbox goes back to the landing page. */
function toFormState<E extends string>(result: Result<unknown, E | NoLiveSandbox>, form: FormData): FormState {
  if (result.ok) {
    refresh();
    return { status: "saved", at: Date.now() };
  }
  if (result.error === "no_sandbox" || result.error === "sandbox_expired") redirect("/");
  const known = MESSAGES[result.error] ?? { message: "Something went wrong. Try again." };
  const values = Object.fromEntries([...form].map(([name, value]) => [name, String(value)]));
  return { status: "error", ...known, values, at: Date.now() };
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

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
  return toFormState(await crm.activities.log({ ...activityFields(form), companyId: text(form, "companyId") }), form);
}

export async function updateActivity(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.activities.update(text(form, "activityId"), activityFields(form)), form);
}

export async function deleteActivity(_state: FormState, form: FormData): Promise<FormState> {
  const crm = await getCrm();
  return toFormState(await crm.activities.delete(text(form, "activityId")), form);
}

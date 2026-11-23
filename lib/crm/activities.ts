import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  OWNER_REF_COLUMNS,
  clean,
  fail,
  isId,
  isMissingReference,
  ok,
  toOwnerRef,
  unexpected,
  type CrmContext,
  type OwnerRef,
} from "./core";
import { ACTIVITY_KINDS, type ActivityKind } from "./terms";

export type Activity = {
  id: string;
  kind: ActivityKind;
  occurredAt: Date;
  text: string;
  author: OwnerRef;
  contact: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
};

export const ACTIVITY_COLUMNS = `id, kind, occurred_at, text, author:teammates!inner(${OWNER_REF_COLUMNS}), contact:contacts(id, name), deal:deals(id, title)`;

export function toActivity(row: {
  id: string;
  kind: ActivityKind;
  occurred_at: string;
  text: string;
  author: { id: string; first_name: string; last_name: string; initials: string };
  contact: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
}): Activity {
  return {
    id: row.id,
    kind: row.kind,
    occurredAt: new Date(row.occurred_at),
    text: row.text,
    author: toOwnerRef(row.author),
    contact: row.contact,
    deal: row.deal,
  };
}

/** What Maya can set on an Activity. Its Company, Deal and author never change. */
export type ActivityFields = {
  contactId?: string | null;
  kind: ActivityKind;
  occurredAt: Date;
  text: string;
};

export type ActivityInput = ActivityFields & { companyId: string; dealId?: string | null };

// Visitors pick a date in their own time zone; allow for clocks a little ahead.
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;

/** The rules for logging and editing: the row to write, or the rule it breaks. */
function checkFields(input: ActivityFields) {
  const text = clean(input.text);
  if (!text) return fail("text_required");
  if (!ACTIVITY_KINDS.includes(input.kind)) return fail("kind_unknown");
  if (Number.isNaN(input.occurredAt.getTime())) return fail("date_required");
  if (input.occurredAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return fail("date_in_future");
  const contactId = input.contactId || null;
  if (contactId && !isId(contactId)) return fail("contact_not_found");
  return ok({ contact_id: contactId, kind: input.kind, occurred_at: input.occurredAt.toISOString(), text });
}

/** Named in the migrations: an Activity's Contact and Deal must belong to its Company. */
function isContactElsewhere(error: PostgrestError): boolean {
  return isMissingReference(error) && error.message.includes("activities_contact_at_company");
}

function isDealElsewhere(error: PostgrestError): boolean {
  return isMissingReference(error) && error.message.includes("activities_deal_at_company");
}

export function activitiesArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Records an Activity against a Company, written by the Persona. */
    log: (input: ActivityInput) =>
      inLiveSandbox(async () => {
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        if (!isId(input.companyId)) return fail("company_not_found");
        const dealId = input.dealId || null;
        if (dealId && !isId(dealId)) return fail("deal_not_found");

        const persona = await db.from("teammates").select("id").eq("is_persona", true).single();
        if (persona.error) unexpected(persona.error);

        const { data, error } = await db
          .from("activities")
          .insert({ ...fields.value, company_id: input.companyId, deal_id: dealId, author_id: persona.data.id })
          .select("id")
          .single();
        if (error) {
          if (isContactElsewhere(error)) return fail("contact_not_found");
          if (isDealElsewhere(error)) return fail("deal_not_found");
          return isMissingReference(error) ? fail("company_not_found") : unexpected(error);
        }
        return ok({ id: data.id });
      }),

    /** Corrects an Activity. It stays on its Company and keeps its author. */
    update: (id: string, input: ActivityFields) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        const { data, error } = await db.from("activities").update(fields.value).eq("id", id).select("id");
        if (error) return isContactElsewhere(error) ? fail("contact_not_found") : unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    delete: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("activities").delete().eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),
  };
}

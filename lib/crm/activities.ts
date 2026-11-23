import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { clean, fail, isId, isMissingReference, ok, unexpected, type CrmContext } from "./core";
import { ACTIVITY_KINDS, type ActivityKind } from "./terms";

/** What Maya can set on an Activity. Its Company and author never change. */
export type ActivityFields = {
  contactId?: string | null;
  kind: ActivityKind;
  occurredAt: Date;
  text: string;
};

export type ActivityInput = ActivityFields & { companyId: string };

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

/** Named in the migration: an Activity's Contact must work at its Company. */
function isContactElsewhere(error: PostgrestError): boolean {
  return isMissingReference(error) && error.message.includes("activities_contact_at_company");
}

export function activitiesArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Records an Activity against a Company, written by the Persona. */
    log: (input: ActivityInput) =>
      inLiveSandbox(async () => {
        const fields = checkFields(input);
        if (!fields.ok) return fields;
        if (!isId(input.companyId)) return fail("company_not_found");

        const persona = await db.from("teammates").select("id").eq("is_persona", true).single();
        if (persona.error) unexpected(persona.error);

        const { data, error } = await db
          .from("activities")
          .insert({ ...fields.value, company_id: input.companyId, author_id: persona.data.id })
          .select("id")
          .single();
        if (error) {
          if (isContactElsewhere(error)) return fail("contact_not_found");
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

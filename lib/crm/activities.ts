import "server-only";
import { ACTIVITY_KINDS, type ActivityKind } from "./terms";
import { clean, fail, isId, isMissingReference, ok, unexpected, type CrmContext } from "./core";

export type ActivityInput = {
  companyId: string;
  contactId?: string | null;
  kind: ActivityKind;
  occurredAt: Date;
  text: string;
};

// Visitors pick a date in their own time zone; allow for clocks a little ahead.
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;

export function activitiesArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Records an Activity against a Company, written by the Persona. */
    log: (input: ActivityInput) =>
      inLiveSandbox(async () => {
        const text = clean(input.text);
        if (!text) return fail("text_required");
        if (!ACTIVITY_KINDS.includes(input.kind)) return fail("kind_unknown");
        if (Number.isNaN(input.occurredAt.getTime())) return fail("date_required");
        if (input.occurredAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return fail("date_in_future");
        if (!isId(input.companyId)) return fail("company_not_found");
        const contactId = input.contactId || null;
        if (contactId && !isId(contactId)) return fail("contact_not_found");

        const persona = await db.from("teammates").select("id").eq("is_persona", true).single();
        if (persona.error) unexpected(persona.error);

        const { data, error } = await db
          .from("activities")
          .insert({
            company_id: input.companyId,
            contact_id: contactId,
            author_id: persona.data.id,
            kind: input.kind,
            occurred_at: input.occurredAt.toISOString(),
            text,
          })
          .select("id")
          .single();
        if (error) {
          if (!isMissingReference(error)) unexpected(error);
          // Named in the migration: the Contact must work at this Company.
          return error.message.includes("activities_contact_at_company") ? fail("contact_not_found") : fail("company_not_found");
        }
        return ok({ id: data.id });
      }),
  };
}

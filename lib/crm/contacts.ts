import "server-only";
import { clean, fail, isId, isMissingReference, ok, unexpected, type CrmContext } from "./core";

export type Contact = { id: string; name: string; jobTitle: string; email: string; phone: string };

export const CONTACT_COLUMNS = "id, name, job_title, email, phone";

export function toContact(row: { id: string; name: string; job_title: string; email: string; phone: string }): Contact {
  return { id: row.id, name: row.name, jobTitle: row.job_title, email: row.email, phone: row.phone };
}

/** Everything but the name is optional. An edit replaces every field. */
export type ContactInput = { name: string; jobTitle?: string; email?: string; phone?: string };

export function contactsArea({ db, inLiveSandbox }: CrmContext) {
  return {
    create: (companyId: string, input: ContactInput) =>
      inLiveSandbox(async () => {
        if (!isId(companyId)) return fail("company_not_found");
        const fields = toFields(input);
        if (!fields.name) return fail("name_required");
        const { data, error } = await db
          .from("contacts")
          .insert({ ...fields, company_id: companyId })
          .select("id")
          .single();
        if (error) return isMissingReference(error) ? fail("company_not_found") : unexpected(error);
        return ok({ id: data.id });
      }),

    update: (id: string, input: ContactInput) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const fields = toFields(input);
        if (!fields.name) return fail("name_required");
        const { data, error } = await db.from("contacts").update(fields).eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    /** Deletes the Contact. Their Activities stay on the Company, unlinked. */
    delete: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("contacts").delete().eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),
  };
}

function toFields(input: ContactInput) {
  return {
    name: clean(input.name),
    job_title: clean(input.jobTitle),
    email: clean(input.email),
    phone: clean(input.phone),
  };
}

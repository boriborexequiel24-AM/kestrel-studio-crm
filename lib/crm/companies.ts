import "server-only";
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
import type { ActivityKind, CompanyStatus } from "./terms";

export type CompanyListItem = {
  id: string;
  name: string;
  industry: string;
  city: string;
  status: CompanyStatus;
  owner: OwnerRef;
  addedAt: Date;
};

export type Contact = { id: string; name: string; jobTitle: string; email: string; phone: string };

export type Activity = {
  id: string;
  kind: ActivityKind;
  occurredAt: Date;
  text: string;
  author: OwnerRef;
  contact: { id: string; name: string } | null;
};

/** A Company with everything its page shows. */
export type CompanyDetail = CompanyListItem & { contacts: Contact[]; activities: Activity[] };

export type CompanyFilter = { search?: string; ownerId?: string; status?: CompanyStatus };

export type CompanyInput = { name: string; industry?: string; city?: string; ownerId: string };

export function companiesArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Companies in the Sandbox, by name, optionally filtered. */
    list: (filter: CompanyFilter = {}) =>
      inLiveSandbox(async () => {
        let query = db
          .from("companies")
          .select(COMPANY_COLUMNS)
          .order("name");
        if (filter.ownerId) query = query.eq("owner_id", filter.ownerId);
        const { data, error } = await query;
        if (error) unexpected(error);

        const companies = data.map(toListItem);
        // A Sandbox holds about 40 Companies, so the text filter runs here,
        // which also keeps the visitor's text away from query syntax.
        const search = clean(filter.search).toLocaleLowerCase();
        return ok(
          companies.filter(
            (company) =>
              (!search || company.name.toLocaleLowerCase().includes(search)) &&
              (!filter.status || company.status === filter.status),
          ),
        );
      }),

    /** One Company with its Contacts (by name) and Activity timeline (newest first). */
    get: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const [company, contacts, activities] = await Promise.all([
          db.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle(),
          db.from("contacts").select("id, name, job_title, email, phone").eq("company_id", id).order("name"),
          db
            .from("activities")
            .select(`id, kind, occurred_at, text, author:teammates!inner(${OWNER_REF_COLUMNS}), contact:contacts(id, name)`)
            .eq("company_id", id)
            .order("occurred_at", { ascending: false }),
        ]);
        for (const { error } of [company, contacts, activities]) if (error) unexpected(error);
        if (!company.data) return fail("not_found");
        return ok<CompanyDetail>({
          ...toListItem(company.data),
          contacts: contacts.data!.map((row) => ({
            id: row.id,
            name: row.name,
            jobTitle: row.job_title,
            email: row.email,
            phone: row.phone,
          })),
          activities: activities.data!.map((row) => ({
            id: row.id,
            kind: row.kind,
            occurredAt: new Date(row.occurred_at),
            text: row.text,
            author: toOwnerRef(row.author),
            contact: row.contact,
          })),
        });
      }),

    create: (input: CompanyInput) =>
      inLiveSandbox(async () => {
        const fields = toFields(input);
        if (!fields.name) return fail("name_required");
        const { data, error } = await db.from("companies").insert(fields).select("id").single();
        if (error) return isMissingReference(error) ? fail("owner_not_found") : unexpected(error);
        return ok({ id: data.id });
      }),

    update: (id: string, input: CompanyInput) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const fields = toFields(input);
        if (!fields.name) return fail("name_required");
        const { data, error } = await db.from("companies").update(fields).eq("id", id).select("id");
        if (error) return isMissingReference(error) ? fail("owner_not_found") : unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),

    /** Deletes the Company with its Contacts and Activities. */
    delete: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("companies").delete().eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),
  };
}

const COMPANY_COLUMNS = `id, name, industry, city, added_at, owner:teammates!inner(${OWNER_REF_COLUMNS})`;

function toListItem(row: {
  id: string;
  name: string;
  industry: string;
  city: string;
  added_at: string;
  owner: { id: string; first_name: string; last_name: string; initials: string };
}): CompanyListItem {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    city: row.city,
    // Every Company is a Prospect until Retainers exist (ticket 07).
    status: "Prospect",
    addedAt: new Date(row.added_at),
    owner: toOwnerRef(row.owner),
  };
}

function toFields(input: CompanyInput) {
  return { name: clean(input.name), industry: clean(input.industry), city: clean(input.city), owner_id: input.ownerId };
}

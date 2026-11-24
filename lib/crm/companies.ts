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
import { ACTIVITY_COLUMNS, toActivity, type Activity } from "./activities";
import { CONTACT_COLUMNS, toContact, type Contact } from "./contacts";
import { DEAL_COLUMNS, toCard, type DealCard } from "./deals";
import { RETAINER_COLUMNS, companyStatus, toRetainer, type Retainer } from "./retainers";
import type { CompanyStatus, Day } from "./terms";

export type CompanyListItem = {
  id: string;
  name: string;
  industry: string;
  city: string;
  status: CompanyStatus;
  owner: OwnerRef;
  addedAt: Date;
};

/** A Company with everything its page shows. */
export type CompanyDetail = CompanyListItem & {
  contacts: Contact[];
  activities: Activity[];
  /** Open ones first, then the most recently closed. */
  deals: DealCard[];
  /** The first to end first. */
  retainers: Retainer[];
};

/** `today` is the visitor's own, because a Client is a Company whose Retainer hasn't ended. */
export type CompanyFilter = { today: Day; search?: string; ownerId?: string; status?: CompanyStatus };

export type CompanyInput = { name: string; industry?: string; city?: string; ownerId: string };

export function companiesArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Companies in the Sandbox, by name, optionally filtered. */
    list: (filter: CompanyFilter) =>
      inLiveSandbox(async () => {
        let query = db
          .from("companies")
          .select(COMPANY_COLUMNS)
          .order("name");
        if (filter.ownerId) query = query.eq("owner_id", filter.ownerId);
        const { data, error } = await query;
        if (error) unexpected(error);

        const companies = data.map((row) => toListItem(row, filter.today));
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

    /** One Company with its Contacts (by name), Deals, Retainers and Activity timeline (newest first). */
    get: (id: string, view: { today: Day }) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const [company, contacts, activities, deals, retainers] = await Promise.all([
          db.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle(),
          db.from("contacts").select(CONTACT_COLUMNS).eq("company_id", id).order("name"),
          db.from("activities").select(ACTIVITY_COLUMNS).eq("company_id", id).order("occurred_at", { ascending: false }),
          db
            .from("deals")
            .select(DEAL_COLUMNS)
            .eq("company_id", id)
            .order("closed_on", { ascending: false, nullsFirst: true })
            .order("created_at", { ascending: false }),
          db.from("retainers").select(RETAINER_COLUMNS).eq("company_id", id).order("end_date").order("id"),
        ]);
        for (const { error } of [company, contacts, activities, deals, retainers]) if (error) unexpected(error);
        if (!company.data) return fail("not_found");
        return ok<CompanyDetail>({
          ...toListItem(company.data, view.today),
          contacts: contacts.data!.map(toContact),
          activities: activities.data!.map(toActivity),
          deals: deals.data!.map((row) => toCard(row, view.today)),
          retainers: retainers.data!.map((row) => toRetainer(row, view.today)),
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

    /** Deletes the Company with its Contacts, Deals, Retainers and Activities. */
    delete: (id: string) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        const { data, error } = await db.from("companies").delete().eq("id", id).select("id");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
      }),
  };
}

const COMPANY_COLUMNS = `id, name, industry, city, added_at, owner:teammates!inner(${OWNER_REF_COLUMNS}), retainers(end_date)`;

function toListItem(
  row: {
    id: string;
    name: string;
    industry: string;
    city: string;
    added_at: string;
    owner: { id: string; first_name: string; last_name: string; initials: string };
    retainers: { end_date: string }[];
  },
  today: Day,
): CompanyListItem {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    city: row.city,
    status: companyStatus(row.retainers, today),
    addedAt: new Date(row.added_at),
    owner: toOwnerRef(row.owner),
  };
}

function toFields(input: CompanyInput) {
  return { name: clean(input.name), industry: clean(input.industry), city: clean(input.city), owner_id: input.ownerId };
}

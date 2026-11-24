import "server-only";
import { OWNER_REF_COLUMNS, fail, isDay, isId, ok, toOwnerRef, unexpected, type CrmContext, type OwnerRef } from "./core";
import { daysFrom, isOpenStage, type CompanyStatus, type Day, type DealStage, type OpenStage, type RetainerState } from "./terms";

export type Retainer = {
  id: string;
  company: { id: string; name: string };
  /** The won Deal it came from. */
  deal: { id: string; title: string };
  /** The open Deal to renew it, if there is one. */
  openRenewal: { id: string; stage: OpenStage } | null;
  owner: OwnerRef;
  /** USD a month. */
  monthlyFee: number;
  startDate: Day;
  /** Its last day. */
  endDate: Day;
  state: RetainerState;
};

/** The furthest an end date can be set, which leaves room to renew it. */
const LAST_END_DATE: Day = "2200-12-31";

/** Retainers ending within this many days are flagged, to plan renewals. */
const ENDS_SOON_DAYS = 60;

export const RETAINER_COLUMNS = `id, monthly_fee, start_date, end_date,
  company:companies!inner(id, name), deal:deals!retainers_deal_at_company!inner(id, title),
  renewals:deals!deals_renews_retainer(id, stage), owner:teammates!inner(${OWNER_REF_COLUMNS})`;

export function retainersArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Every Retainer, the first to end first. */
    list: (view: { today: Day }) =>
      inLiveSandbox(async () => {
        const { data, error } = await db.from("retainers").select(RETAINER_COLUMNS).order("end_date").order("id");
        if (error) unexpected(error);
        return ok(data.map((row) => toRetainer(row, view.today)));
      }),

    /**
     * Corrects a Retainer's last day. Nothing else about a Retainer can change.
     * Pass the end date it had when the edit began, and an edit from before a
     * Renewal extended it is refused.
     */
    setEndDate: (id: string, endDate: Day, seen: { was?: Day } = {}) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        if (!isDay(endDate)) return fail("end_date_invalid");
        if (endDate > LAST_END_DATE) return fail("end_date_too_far");
        let update = db.from("retainers").update({ end_date: endDate }).eq("id", id);
        if (seen.was) update = update.eq("end_date", seen.was);
        const { data, error } = await update.select("id");
        // Named in the migration: a Retainer can't end before it starts.
        if (error?.message.includes("retainers_dates")) return fail("end_before_start");
        if (error) unexpected(error);
        if (data.length) return ok(undefined);
        const existing = await db.from("retainers").select("id").eq("id", id).maybeSingle();
        if (existing.error) unexpected(existing.error);
        return fail(existing.data ? "end_date_changed" : "not_found");
      }),
  };
}

/** A Company with an active Retainer is a Client; without one it's a Prospect. */
export function companyStatus(retainers: { end_date: string }[], today: Day): CompanyStatus {
  return retainers.some((retainer) => retainerState(retainer.end_date, today) !== "Ended") ? "Client" : "Prospect";
}

/** A Retainer runs through its end date, in the visitor's calendar. */
function retainerState(endDate: Day, today: Day): RetainerState {
  if (endDate < today) return "Ended";
  return daysFrom(today, endDate) <= ENDS_SOON_DAYS ? "Ends soon" : "Active";
}

export function toRetainer(
  row: {
    id: string;
    monthly_fee: number;
    start_date: string;
    end_date: string;
    company: { id: string; name: string };
    deal: { id: string; title: string };
    renewals: { id: string; stage: DealStage }[];
    owner: { id: string; first_name: string; last_name: string; initials: string };
  },
  today: Day,
): Retainer {
  const [openRenewal] = row.renewals.flatMap(({ id, stage }) => (isOpenStage(stage) ? [{ id, stage }] : []));
  return {
    id: row.id,
    company: row.company,
    deal: row.deal,
    openRenewal: openRenewal ?? null,
    owner: toOwnerRef(row.owner),
    monthlyFee: row.monthly_fee,
    startDate: row.start_date,
    endDate: row.end_date,
    state: retainerState(row.end_date, today),
  };
}

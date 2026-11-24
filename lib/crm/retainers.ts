import "server-only";
import { OWNER_REF_COLUMNS, fail, isDay, isId, ok, toOwnerRef, unexpected, type CrmContext, type OwnerRef } from "./core";
import { daysFrom, type CompanyStatus, type Day, type RetainerState } from "./terms";

export type Retainer = {
  id: string;
  company: { id: string; name: string };
  /** The won Deal it came from. */
  deal: { id: string; title: string };
  owner: OwnerRef;
  /** USD a month. */
  monthlyFee: number;
  startDate: Day;
  /** Its last day. */
  endDate: Day;
  state: RetainerState;
};

/** Retainers ending within this many days are flagged, to plan renewals. */
const ENDS_SOON_DAYS = 60;

export const RETAINER_COLUMNS = `id, monthly_fee, start_date, end_date,
  company:companies!inner(id, name), deal:deals!inner(id, title), owner:teammates!inner(${OWNER_REF_COLUMNS})`;

export function retainersArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** Every Retainer, the first to end first. */
    list: (view: { today: Day }) =>
      inLiveSandbox(async () => {
        const { data, error } = await db.from("retainers").select(RETAINER_COLUMNS).order("end_date").order("id");
        if (error) unexpected(error);
        return ok(data.map((row) => toRetainer(row, view.today)));
      }),

    /** Corrects a Retainer's last day. Nothing else about a Retainer can change. */
    setEndDate: (id: string, endDate: Day) =>
      inLiveSandbox(async () => {
        if (!isId(id)) return fail("not_found");
        if (!isDay(endDate)) return fail("end_date_invalid");
        const { data, error } = await db.from("retainers").update({ end_date: endDate }).eq("id", id).select("id");
        // Named in the migration: a Retainer can't end before it starts.
        if (error?.message.includes("retainers_dates")) return fail("end_before_start");
        if (error) unexpected(error);
        return data.length ? ok(undefined) : fail("not_found");
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
    owner: { id: string; first_name: string; last_name: string; initials: string };
  },
  today: Day,
): Retainer {
  return {
    id: row.id,
    company: row.company,
    deal: row.deal,
    owner: toOwnerRef(row.owner),
    monthlyFee: row.monthly_fee,
    startDate: row.start_date,
    endDate: row.end_date,
    state: retainerState(row.end_date, today),
  };
}

import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Day } from "@/lib/crm";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

// The visitor's time zone is saved by <TimeZoneSync /> in their browser, so
// "Due today" and "Overdue" follow their calendar rather than the server's.

/** Today's calendar day for the visitor, "2026-11-24". UTC until their browser has reported its zone. */
export async function visitorToday(): Promise<Day> {
  // "Today" belongs to this request and this visitor, never to a prerender.
  await connection();
  const zone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return dayIn(new Date(), zone && isTimeZone(zone) ? zone : "UTC");
}

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function dayIn(date: Date, timeZone: string): Day {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

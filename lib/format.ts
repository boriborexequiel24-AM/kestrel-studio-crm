import { daysFrom, type Day } from "@/lib/crm/terms";

const DAY = 24 * 60 * 60 * 1000;

/** Midnight at the start of `date`'s calendar day, in this runtime's time zone. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "today", "yesterday", "3 days ago", "5 months ago", "2 years ago", counted
 * in calendar days in this runtime's time zone (the visitor's, in the browser).
 */
export function agoLabel(date: Date, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(days / 365.25)} years ago`;
}

/** "in 23 hours", "in 1 hour", "in less than an hour". */
export function hoursLeftLabel(until: Date, now = new Date()): string {
  const hours = Math.floor((until.getTime() - now.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "in less than an hour";
  return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
}

export function fullName(owner: { firstName: string; lastName: string }): string {
  return `${owner.firstName} ${owner.lastName}`;
}

/** "Nov 21, 2026", in this runtime's time zone. */
export function longDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "$9,500". */
export function usd(amount: number): string {
  return dollars.format(amount);
}

/** "$9.5k", "$18k", "$800". */
export function usdShort(amount: number): string {
  if (amount < 1000) return dollars.format(amount);
  const thousands = amount / 1000;
  return `$${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
}

/** A calendar day as text. It has no time zone, so it reads the same on the server and in the browser. */
function dayText(day: Day, parts: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { ...parts, timeZone: "UTC" });
}

/** "Dec 3, 2026". */
export function longDay(day: Day): string {
  return dayText(day, { month: "short", day: "numeric", year: "numeric" });
}

/** "Due today", "Due tomorrow", "Due in 3 days", "Due Dec 3", "Overdue by 2 days". */
export function dueLabel(due: Day | null, today: Day): string {
  if (!due) return "No due date";
  const days = daysFrom(today, due);
  if (days < 0) return days === -1 ? "Overdue since yesterday" : `Overdue by ${-days} days`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days} days`;
  return `Due ${dayText(due, { month: "short", day: "numeric" })}`;
}

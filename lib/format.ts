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

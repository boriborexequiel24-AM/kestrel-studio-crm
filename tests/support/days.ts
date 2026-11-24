/** A calendar day in UTC, `offsetDays` from now, as the app passes it for a visitor in UTC. */
export function utcDay(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "2026-11-24" to "2026-11-25". */
export function dayAfter(day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The last day of a term, worked out separately from the database: the day
 * before the same date `months` later. January 31 for 1 month ends February 27.
 */
export function lastDay(start: string, months: number) {
  const [year, month, day] = start.split("-").map(Number);
  const daysInEndMonth = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, daysInEndMonth) - 1)).toISOString().slice(0, 10);
}

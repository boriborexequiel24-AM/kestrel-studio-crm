/** A calendar day in UTC, `offsetDays` from now, as the app passes it for a visitor in UTC. */
export function utcDay(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

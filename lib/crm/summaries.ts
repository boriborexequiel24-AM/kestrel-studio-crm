import "server-only";
import { createHash } from "node:crypto";
import type { Activity } from "./activities";
import type { ActivityKind } from "./terms";

/** A Company's story in up to three lines, as the AI last wrote it. */
export type Summary = {
  lines: string[];
  writtenAt: Date;
  /** False once the Company's Activities differ from the ones it covers. */
  upToDate: boolean;
};

export const SUMMARY_COLUMNS = "lines, activities_seen, written_at";

/** What the fingerprint needs of an Activity. */
export const SEEN_COLUMNS = "id, kind, occurred_at, text";

type SeenActivity = Pick<Activity, "id" | "kind" | "occurredAt" | "text">;

export function toSeen(row: { id: string; kind: ActivityKind; occurred_at: string; text: string }): SeenActivity {
  return { id: row.id, kind: row.kind, occurredAt: new Date(row.occurred_at), text: row.text };
}

/** A fingerprint of a Company's Activities: any new, edited or deleted one changes it. */
export function activitiesSeen(activities: SeenActivity[]): string {
  const rows = activities.map(({ id, kind, occurredAt, text }) => JSON.stringify([id, kind, occurredAt.getTime(), text]));
  return createHash("sha256").update(rows.sort().join("\n")).digest("hex");
}

export function toSummary(
  row: { lines: string[]; activities_seen: string; written_at: string } | null,
  activities: SeenActivity[],
): Summary | null {
  return row && { lines: row.lines, writtenAt: new Date(row.written_at), upToDate: row.activities_seen === activitiesSeen(activities) };
}

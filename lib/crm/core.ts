import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { MAX_MONTHLY_DOLLARS } from "./terms";

export type CrmSupabaseClient = SupabaseClient<Database>;
export type CrmDb = ReturnType<CrmSupabaseClient["schema"]>;

/** Rule violations come back as typed results the UI can show, not thrown errors. */
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const fail = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error });

/** Returned by every read or write when the visitor has no live Sandbox. */
export type NoLiveSandbox = "no_sandbox" | "sandbox_expired";

/** Runs a piece of CRM work only for a visitor with a live Sandbox. */
export type InLiveSandbox = <T, E extends string = never>(
  work: () => Promise<Result<T, E>>,
) => Promise<Result<T, E | NoLiveSandbox>>;

/** What every area of the CRM module works with. */
export type CrmContext = { db: CrmDb; inLiveSandbox: InLiveSandbox };

/** The Persona or a Teammate, as shown wherever someone owns or authors a record. */
export type OwnerRef = { id: string; firstName: string; lastName: string; initials: string };

export const OWNER_REF_COLUMNS = "id, first_name, last_name, initials";

export function toOwnerRef(row: { id: string; first_name: string; last_name: string; initials: string }): OwnerRef {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, initials: row.initials };
}

/** Trims a free-text field; empty text becomes "". */
export function clean(text: string | null | undefined): string {
  return (text ?? "").trim();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from URLs and forms; anything that isn't a uuid can't name a record. */
export function isId(id: string): boolean {
  return UUID.test(id);
}

/** Monthly values and fees are whole US dollars, from 0 to the limit. */
export function isWholeDollars(dollars: number): boolean {
  return Number.isInteger(dollars) && dollars >= 0 && dollars <= MAX_MONTHLY_DOLLARS;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whether text is a real calendar day such as "2026-02-28". */
export function isDay(text: string): boolean {
  if (!DAY_PATTERN.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

/** A row the insert or update pointed at doesn't exist in this Sandbox. */
export function isMissingReference(error: PostgrestError): boolean {
  return error.code === "23503";
}

/** Which of these rules the database refused with, if any. Its functions and triggers raise a rule's name. */
export function ruleBroken<Rule extends string>(error: PostgrestError, ...rules: Rule[]): Rule | undefined {
  return rules.find((rule) => error.message === rule);
}

/** Throws anything that isn't an expected, typed outcome. */
export function unexpected(error: PostgrestError): never {
  throw new Error(`CRM database error ${error.code}: ${error.message}`);
}

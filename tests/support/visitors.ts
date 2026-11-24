import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { createCrm, type CrmSupabaseClient } from "@/lib/crm";
import { createFakeAiProvider } from "@/lib/ai/fake";
import type { Database } from "@/lib/database.types";
import { utcDay } from "./days";

export const TEST_LIMITS = { sandboxesPerIpPerDay: 5, ipHashSalt: "test-salt" };

/**
 * A fresh browser-less visitor: their own Supabase client (no session yet),
 * the CRM module bound to that client, and a fake AI provider. Each visitor
 * comes from their own made-up network (`ip`) unless one is given, so the
 * per-network Sandbox limit never trips across tests.
 * `db` is the visitor's raw client, for tests that act like someone poking the
 * API directly with their own session.
 */
export function newVisitor(options: { ip?: string; sandboxesPerIpPerDay?: number } = {}) {
  const { url, anonKey } = inject("localStack");
  const db: CrmSupabaseClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const ai = createFakeAiProvider();
  const { ip = `test-${crypto.randomUUID()}`, ...limitOverrides } = options;
  const crm = createCrm(db, { ai, limits: { ...TEST_LIMITS, ...limitOverrides } });
  return { crm, db, ai, ip };
}

/** A visitor who has already clicked "Open the demo". `today` is their own calendar day. */
export async function visitorWithSandbox({
  today = utcDay(),
  ...options
}: Parameters<typeof newVisitor>[0] & { today?: string } = {}) {
  const visitor = newVisitor(options);
  const opened = await visitor.crm.sandbox.open({ ip: visitor.ip, today });
  if (!opened.ok) throw new Error(`Could not open a Sandbox: ${opened.error}`);
  return { ...visitor, sandbox: opened.value };
}

/** Operator access for test setup only (e.g. backdating a Sandbox). Never used by the app. */
export function operator() {
  const { url, serviceRoleKey } = inject("localStack");
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const TEMPLATE_ID = "00000000-0000-4000-8000-000000000000";

/** Rows per Sandbox-owned table, found by the database itself so new tables are covered. */
export async function sandboxRowCounts(sandboxId: string): Promise<Record<string, number>> {
  const { data, error } = await operator().schema("crm").rpc("sandbox_row_counts", { target: sandboxId });
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.table_name, Number(row.row_count)]));
}

export function templateRowCounts() {
  return sandboxRowCounts(TEMPLATE_ID);
}

export const HOUR = 60 * 60 * 1000;

/** Backdates a Sandbox so it ran out an hour ago. */
export async function expireSandbox(id: string) {
  const { error } = await operator()
    .schema("crm")
    .from("sandboxes")
    .update({ created_at: new Date(Date.now() - 25 * HOUR).toISOString(), expires_at: new Date(Date.now() - HOUR).toISOString() })
    .eq("id", id);
  if (error) throw error;
}

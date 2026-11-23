import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { createCrm, type CrmSupabaseClient } from "@/lib/crm";
import { createFakeAiProvider } from "@/lib/ai/fake";
import type { Database } from "@/lib/database.types";

/**
 * A fresh browser-less visitor: their own Supabase client (no session yet),
 * the CRM module bound to that client, and a fake AI provider.
 * `db` is the visitor's raw client, for tests that act like someone poking the
 * API directly with their own session.
 */
export function newVisitor() {
  const { url, anonKey } = inject("localStack");
  const db: CrmSupabaseClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const ai = createFakeAiProvider();
  return { crm: createCrm(db, { ai }), db, ai };
}

/** A visitor who has already clicked "Open the demo". */
export async function visitorWithSandbox() {
  const visitor = newVisitor();
  const opened = await visitor.crm.sandbox.open();
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

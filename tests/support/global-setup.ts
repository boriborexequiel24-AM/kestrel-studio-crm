import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { TestProject } from "vitest/node";
import type { Database } from "@/lib/database.types";

export type LocalStack = { url: string; anonKey: string; serviceRoleKey: string };

declare module "vitest" {
  export interface ProvidedContext {
    localStack: LocalStack;
  }
}

// Tests only ever run against the local Supabase stack in Docker. The keys come
// from the Supabase CLI, never from `.env`, so a `.env` pointing at the shared
// live project can't leak into a test run.
export default function setup(project: TestProject) {
  let raw: string;
  try {
    raw = execSync("supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("The local Supabase stack isn't running. Start it with `npm run db:start`.");
  }
  const status = JSON.parse(raw) as Record<string, string>;
  const url = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error(`Refusing to run tests against a non-local Supabase: ${url}`);
  }
  project.provide("localStack", {
    url,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  });

  // AI usage outlives its Sandbox, so without this a few test runs would use up
  // the local app's demo-wide AI limit for the day.
  const startedAt = new Date().toISOString();
  return async function teardown() {
    const operator = createClient<Database>(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { error } = await operator.schema("crm").from("ai_usage").delete().gte("started_at", startedAt);
    if (error) throw error;
  };
}

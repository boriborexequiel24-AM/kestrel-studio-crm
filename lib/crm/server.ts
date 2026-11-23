import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { aiProviderFromEnv } from "@/lib/ai";
import { createVisitorClient } from "@/lib/supabase/server";
import { createCrm, type NoLiveSandbox, type Result } from "./index";

/** The CRM module for this request, acting as the visitor. One per request. */
export const getCrm = cache(async () => {
  // Everything the CRM returns is per visitor and per moment (Sandbox expiry,
  // token checks), so it never runs during prerendering.
  await connection();
  return createCrm(await createVisitorClient(), { ai: aiProviderFromEnv() });
});

/**
 * For signed-in screens: the CRM module and the visitor's live Sandbox.
 * Without one, the visitor goes back to the landing page.
 */
export const requireLiveSandbox = cache(async () => {
  const crm = await getCrm();
  const status = await crm.sandbox.status();
  if (status.state !== "live") redirect("/");
  return { crm, sandbox: status.sandbox };
});

/** On a signed-in screen: the value of a CRM read, or back to the landing page if the Sandbox is gone. */
export function valueOrLanding<T>(result: Result<T, NoLiveSandbox>): T {
  if (!result.ok) redirect("/");
  return result.value;
}

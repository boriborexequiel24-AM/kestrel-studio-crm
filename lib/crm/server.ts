import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { aiProviderFromEnv } from "@/lib/ai";
import { createVisitorClient } from "@/lib/supabase/server";
import { createCrm, type AiLimits, type NoLiveSandbox, type Result, type SandboxLimits } from "./index";

/** The CRM module for this request, acting as the visitor. One per request. */
export const getCrm = cache(async () => {
  // Everything the CRM returns is per visitor and per moment (Sandbox expiry,
  // token checks), so it never runs during prerendering.
  await connection();
  return createCrm(await createVisitorClient(), { ai: aiProviderFromEnv(), limits: limitsFromEnv() });
});

function limitsFromEnv(): SandboxLimits & AiLimits {
  return {
    sandboxesPerIpPerDay: numberFrom(process.env.DEMO_SANDBOXES_PER_IP_PER_DAY, 5),
    ipHashSalt: process.env.IP_HASH_SALT ?? "",
    aiActionsPerSandbox: numberFrom(process.env.DEMO_AI_ACTIONS_PER_SANDBOX_PER_DAY, 30),
    aiActionsPerDay: numberFrom(process.env.DEMO_DAILY_AI_ACTION_CAP, 1000),
  };
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = value?.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) ? parsed : fallback;
}

/** Where a visitor without a live Sandbox goes: the landing page, with a notice if theirs ran out. */
export function landingFor(reason: NoLiveSandbox): string {
  return reason === "sandbox_expired" ? "/?reset=1" : "/";
}

/**
 * For signed-in screens: the CRM module and the visitor's live Sandbox.
 * Without one, the visitor goes back to the landing page.
 */
export const requireLiveSandbox = cache(async () => {
  const crm = await getCrm();
  const status = await crm.sandbox.status();
  if (status.state !== "live") redirect(landingFor(status.state === "expired" ? "sandbox_expired" : "no_sandbox"));
  return { crm, sandbox: status.sandbox };
});

/** On a signed-in screen: the value of a CRM read, or back to the landing page if the Sandbox is gone. */
export function valueOrLanding<T>(result: Result<T, NoLiveSandbox>): T {
  if (!result.ok) redirect(landingFor(result.error));
  return result.value;
}

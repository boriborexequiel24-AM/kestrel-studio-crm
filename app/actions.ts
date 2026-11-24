"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/form-state";
import { getCrm, landingFor } from "@/lib/crm/server";
import { rememberSandboxExpiry } from "@/lib/sandbox-cookie";
import { visitorToday } from "@/lib/visitor-day";

export type OpenDemoState = { limitReached: boolean };

/** "Open the demo": an anonymous session plus a private Sandbox, then into the app. */
export async function openDemo(): Promise<OpenDemoState> {
  const crm = await getCrm();
  const opened = await crm.sandbox.open({ ip: await visitorIp(), today: await visitorToday() });
  if (!opened.ok) return { limitReached: true };
  await rememberSandboxExpiry(opened.value.expiresAt);
  redirect("/home");
}

/** The visitor's address as the hosting platform reports it. Only its salted hash is stored. */
async function visitorIp(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

/** Start over: a fresh copy of the sample data in the same Sandbox, same expiry. */
export async function startOver(): Promise<FormState> {
  const crm = await getCrm();
  const reset = await crm.sandbox.startOver({ today: await visitorToday() });
  if (!reset.ok) redirect(landingFor(reset.error));
  // Records Maya added are gone, so the page she was on may be too.
  redirect("/home");
}

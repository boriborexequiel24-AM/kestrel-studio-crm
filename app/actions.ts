"use server";

import { redirect } from "next/navigation";
import { getCrm } from "@/lib/crm/server";

/** "Open the demo": an anonymous session plus a private Sandbox, then into the app. */
export async function openDemo() {
  const crm = await getCrm();
  await crm.sandbox.open();
  redirect("/companies");
}

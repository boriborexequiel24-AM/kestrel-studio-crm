import type { Crm } from "@/lib/crm";
import { utcDay } from "./days";
import { expectOk } from "./results";

/** A sample Company from the Template, by (part of) its name. */
export async function sampleCompany(crm: Crm, name: string) {
  const [listed] = expectOk(await crm.companies.list({ today: utcDay(), search: name }));
  if (!listed) throw new Error(`No sample Company matches "${name}"`);
  return expectOk(await crm.companies.get(listed.id, { today: utcDay() }));
}

/** The Persona's id (Maya). */
export async function personaId(crm: Crm) {
  return expectOk(await crm.team.list()).find((owner) => owner.isPersona)!.id;
}

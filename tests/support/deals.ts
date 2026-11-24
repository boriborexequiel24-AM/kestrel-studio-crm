import type { Crm } from "@/lib/crm";
import { utcDay } from "./days";
import { expectOk } from "./results";
import { personaId, sampleCompany } from "./sample";

/** A new Deal for Saltmarsh Skincare, owned by Maya, estimated at $5,000 a month. */
export async function newDeal(crm: Crm, overrides: Partial<Parameters<Crm["deals"]["create"]>[0]> = {}) {
  const company = await sampleCompany(crm, "Saltmarsh");
  return expectOk(
    await crm.deals.create({
      companyId: company.id,
      ownerId: await personaId(crm),
      title: "Test Deal",
      estimatedMonthlyValue: 5000,
      nextStep: "Send the deck",
      nextStepDue: utcDay(3),
      ...overrides,
    }),
  );
}

export async function getDeal(crm: Crm, id: string) {
  return expectOk(await crm.deals.get(id, { today: utcDay() }));
}

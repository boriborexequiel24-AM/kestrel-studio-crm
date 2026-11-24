import type { Crm, ProposalInput } from "@/lib/crm";
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

/** $4,200 + $2,600 = $6,800 a month. */
export const OFFER: ProposalInput = {
  scopeSummary: "Paid social and creative for the spring launch.",
  termMonths: 6,
  lineItems: [
    { service: "Paid social", monthlyFee: 4200 },
    { service: "Creative production", monthlyFee: 2600 },
  ],
};

/** A new Deal with a Sent Proposal, ready to be won. */
export async function dealWithSentProposal(
  crm: Crm,
  offer: ProposalInput = OFFER,
  overrides: Parameters<typeof newDeal>[1] = {},
) {
  const deal = await newDeal(crm, overrides);
  const draft = expectOk(await crm.proposals.createDraft(deal.id, offer));
  expectOk(await crm.proposals.markSent(draft.id));
  return deal;
}

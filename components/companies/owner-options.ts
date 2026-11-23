import type { Owner } from "@/lib/crm";
import { fullName } from "@/lib/format";

export type OwnerOption = { value: string; label: string };

/** The team as choices for an Owner picker. */
export function ownerOptions(team: Owner[]): OwnerOption[] {
  return team.map((owner) => ({ value: owner.id, label: fullName(owner) }));
}

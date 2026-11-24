import Link from "next/link";
import { Repeat } from "lucide-react";
import type { OwnerOption } from "@/components/companies/owner-options";
import { StartRenewalButton } from "@/components/pipeline/deal-forms";
import type { Retainer } from "@/lib/crm";

/** The Retainer's open Renewal, or a way to start one before it ends. */
export function RetainerRenewal({ retainer, owners }: { retainer: Retainer; owners: OwnerOption[] }) {
  if (retainer.openRenewal) {
    return (
      <Link
        href={`/deals/${retainer.openRenewal.id}`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[14px] font-semibold text-primary hover:underline"
      >
        <Repeat className="size-4 shrink-0" aria-hidden />
        <span>
          Renewal in {retainer.openRenewal.stage}
          <span className="sr-only">
            , {retainer.company.name}: {retainer.deal.title}
          </span>
        </span>
      </Link>
    );
  }
  if (retainer.state === "Ended") return <span className="text-muted-foreground">Ended</span>;
  return (
    <StartRenewalButton
      owners={owners}
      retainer={{
        id: retainer.id,
        title: retainer.deal.title,
        company: retainer.company,
        ownerId: retainer.owner.id,
        monthlyFee: retainer.monthlyFee,
      }}
    />
  );
}

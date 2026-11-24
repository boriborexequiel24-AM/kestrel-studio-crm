import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ownerOptions } from "@/components/companies/owner-options";
import { RetainerRenewal } from "@/components/retainers/renewal";
import { EditEndDateButton } from "@/components/retainers/retainer-forms";
import { RetainerStateChip } from "@/components/retainers/retainer-state";
import { requireLiveSandbox, valueOrLanding } from "@/lib/crm/server";
import { fullName, longDay, usd } from "@/lib/format";
import { visitorToday } from "@/lib/visitor-day";

export const metadata: Metadata = { title: "Retainers" };

export default function RetainersPage() {
  return (
    <>
      <PageHeader title="Retainers" />
      <Suspense
        fallback={
          <p role="status" className="mt-5 rounded-xl border border-border bg-card p-4 text-muted-foreground">
            Loading Retainers...
          </p>
        }
      >
        <RetainersSection />
      </Suspense>
    </>
  );
}

async function RetainersSection() {
  const [{ crm }, today] = await Promise.all([requireLiveSandbox(), visitorToday()]);
  const [listed, team] = await Promise.all([crm.retainers.list({ today }), crm.team.list()]);
  const retainers = valueOrLanding(listed);
  const owners = ownerOptions(valueOrLanding(team));
  const active = retainers.filter((retainer) => retainer.state !== "Ended");
  const endingSoon = retainers.filter((retainer) => retainer.state === "Ends soon");
  const monthly = active.reduce((sum, retainer) => sum + retainer.monthlyFee, 0);

  return (
    <div className="relative mt-5 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1020px] text-left text-[14px]">
        <caption className="border-b border-border px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground">
          {active.length} active {active.length === 1 ? "Retainer" : "Retainers"}, {usd(monthly)} a month.{" "}
          {endingSoon.length} {endingSoon.length === 1 ? "ends" : "end"} within 60 days.
        </caption>
        <thead className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-2.5 font-semibold">Company</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Monthly fee</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Ends</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Owner</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Renewal</th>
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">Change</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {retainers.map((retainer) => (
            <tr key={retainer.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-tint-faint">
              <th scope="row" className="px-4 py-2 font-normal">
                <Link href={`/companies/${retainer.company.id}`} className="block min-h-11 rounded-md py-1 hover:text-primary">
                  <span className="block font-semibold text-primary">{retainer.company.name}</span>
                  <span className="block text-[13px] text-muted-foreground">{retainer.deal.title}</span>
                </Link>
              </th>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{usd(retainer.monthlyFee)}</td>
              <td className="px-4 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums">{longDay(retainer.endDate)}</span>
                  <RetainerStateChip state={retainer.state} />
                </span>
              </td>
              <td className="px-4 py-2">
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-[12px] font-bold" aria-hidden>
                    {retainer.owner.initials}
                  </span>
                  {fullName(retainer.owner)}
                </span>
              </td>
              <td className="px-4 py-2">
                <RetainerRenewal retainer={retainer} owners={owners} />
              </td>
              <td className="px-4 py-2 text-right">
                <EditEndDateButton
                  retainer={{
                    id: retainer.id,
                    startDate: retainer.startDate,
                    endDate: retainer.endDate,
                    title: `${retainer.company.name}: ${retainer.deal.title}`,
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {retainers.length === 0 && (
        <p className="px-4 py-8 text-center text-muted-foreground">No Retainers yet. Winning a Deal starts one.</p>
      )}
    </div>
  );
}

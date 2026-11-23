import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { valueOrLanding, requireLiveSandbox } from "@/lib/crm/server";
import { agoLabel, fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  return (
    <>
      <PageHeader title="Companies" />
      <Suspense fallback={<CompaniesTableShell />}>
        <CompaniesTable />
      </Suspense>
    </>
  );
}

async function CompaniesTable() {
  const { crm } = await requireLiveSandbox();
  const companies = valueOrLanding(await crm.companies.list());
  const now = new Date();

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <caption className="border-b border-border px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground">
          {companies.length} Companies in your Sandbox
        </caption>
        <thead className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-2.5 font-semibold">Company</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">City</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Owner</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Added</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-tint-faint">
              <th scope="row" className="px-4 py-3 font-normal">
                <span className="block font-semibold">{company.name}</span>
                <span className="block text-[13px] text-muted-foreground">{company.industry}</span>
              </th>
              <td className="px-4 py-3">{company.city}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-[12px] font-bold" aria-hidden>
                    {company.owner.initials}
                  </span>
                  {fullName(company.owner)}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <time dateTime={company.addedAt.toISOString()}>{agoLabel(company.addedAt, now)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompaniesTableShell() {
  return (
    <div className="mt-5 rounded-xl border border-border bg-card p-4 text-[14px] text-muted-foreground" role="status">
      Loading Companies...
    </div>
  );
}

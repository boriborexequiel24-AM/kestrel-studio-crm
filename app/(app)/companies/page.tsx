import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { NewCompanyButton } from "@/components/companies/company-forms";
import { ownerOptions } from "@/components/companies/owner-options";
import { StatusChip } from "@/components/companies/status-chip";
import { INPUT_CLASS } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { COMPANY_STATUSES, type CompanyFilter, type CompanyStatus } from "@/lib/crm";
import { requireLiveSandbox, valueOrLanding } from "@/lib/crm/server";
import { RelativeTime } from "@/components/app/relative-time";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Companies" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  return (
    <>
      <PageHeader title="Companies">
        <Suspense>
          <NewCompany />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<Loading />}>
        <CompaniesSection searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewCompany() {
  const { crm } = await requireLiveSandbox();
  return <NewCompanyButton owners={ownerOptions(valueOrLanding(await crm.team.list()))} />;
}

function readFilter(params: Awaited<SearchParams>): CompanyFilter {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const status = one("status");
  return {
    search: one("q"),
    ownerId: one("owner") || undefined,
    status: COMPANY_STATUSES.find((known) => known === status) as CompanyStatus | undefined,
  };
}

async function CompaniesSection({ searchParams }: { searchParams: SearchParams }) {
  const filter = readFilter(await searchParams);
  const { crm } = await requireLiveSandbox();
  const [companies, team] = await Promise.all([crm.companies.list(filter), crm.team.list()]);
  const owners = valueOrLanding(team);
  const shown = valueOrLanding(companies);
  const filtering = Boolean(filter.search || filter.ownerId || filter.status);

  return (
    <>
      <form role="search" aria-label="Filter Companies" className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <label htmlFor="filter-q" className="text-[13px] font-semibold">Name</label>
          <input id="filter-q" name="q" type="search" defaultValue={filter.search} placeholder="Type part of a name" className={INPUT_CLASS} />
        </div>
        <div className="grid min-w-44 gap-1.5">
          <label htmlFor="filter-owner" className="text-[13px] font-semibold">Owner</label>
          <select id="filter-owner" name="owner" defaultValue={filter.ownerId ?? ""} className={INPUT_CLASS}>
            <option value="">Everyone</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{fullName(owner)}</option>
            ))}
          </select>
        </div>
        <div className="grid min-w-36 gap-1.5">
          <label htmlFor="filter-status" className="text-[13px] font-semibold">Client or Prospect</label>
          <select id="filter-status" name="status" defaultValue={filter.status ?? ""} className={INPUT_CLASS}>
            <option value="">Both</option>
            <option value="Client">Clients</option>
            <option value="Prospect">Prospects</option>
          </select>
        </div>
        <Button type="submit" className="h-11 rounded-lg px-5 font-semibold hover:bg-primary-hover">Filter</Button>
        {filtering && (
          <Link href="/companies" className="flex h-11 items-center rounded-lg px-3 text-[14px] font-semibold text-primary hover:underline">
            Clear filters
          </Link>
        )}
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-left text-[14px]">
          <caption className="border-b border-border px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground">
            {shown.length} {shown.length === 1 ? "Company" : "Companies"}
            {filtering ? " match your filters" : " in your Sandbox"}
          </caption>
          <thead className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2.5 font-semibold">Company</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">City</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Owner</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Added</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((company) => (
              <tr key={company.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-tint-faint">
                <th scope="row" className="px-4 py-2 font-normal">
                  <Link href={`/companies/${company.id}`} className="block min-h-11 rounded-md py-1 hover:text-primary">
                    <span className="block font-semibold text-primary">{company.name}</span>
                    <span className="block text-[13px] text-muted-foreground">{company.industry}</span>
                  </Link>
                </th>
                <td className="px-4 py-2"><StatusChip status={company.status} /></td>
                <td className="px-4 py-2">{company.city}</td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-muted text-[12px] font-bold" aria-hidden>
                      {company.owner.initials}
                    </span>
                    {fullName(company.owner)}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  <RelativeTime iso={company.addedAt.toISOString()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-8 text-center text-muted-foreground">No Companies match these filters.</p>
        )}
      </div>
    </>
  );
}

function Loading() {
  return (
    <p role="status" className="mt-5 rounded-xl border border-border bg-card p-4 text-muted-foreground">
      Loading Companies...
    </p>
  );
}

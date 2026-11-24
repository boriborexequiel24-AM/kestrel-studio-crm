import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { ACTIVITY_KIND_ICON } from "@/components/companies/activity-kind";
import { DeleteCompanyButton, EditCompanyButton } from "@/components/companies/company-forms";
import { AddContactButton, ContactActions } from "@/components/companies/contact-forms";
import { ActivityActions, LogActivityButton } from "@/components/companies/activity-forms";
import { ownerOptions, type OwnerOption } from "@/components/companies/owner-options";
import { SandboxLine } from "@/components/app/sandbox-line";
import { StatusChip } from "@/components/companies/status-chip";
import { StageDot } from "@/components/pipeline/stage";
import { RetainerRenewal } from "@/components/retainers/renewal";
import { EditEndDateButton } from "@/components/retainers/retainer-forms";
import { RetainerStateChip } from "@/components/retainers/retainer-state";
import type { CompanyDetail } from "@/lib/crm";
import { landingFor, requireLiveSandbox, valueOrLanding } from "@/lib/crm/server";
import { RelativeTime } from "@/components/app/relative-time";
import { fullName, longDay, usd } from "@/lib/format";
import { visitorToday } from "@/lib/visitor-day";

export const metadata: Metadata = { title: "Company" };

export default function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  return (
    <>
      <Link
        href="/companies"
        className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-[14px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Companies
      </Link>
      <Suspense fallback={<p role="status" className="mt-2 text-muted-foreground">Loading Company...</p>}>
        <CompanyView params={params} />
      </Suspense>
    </>
  );
}

async function CompanyView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ crm }, today] = await Promise.all([requireLiveSandbox(), visitorToday()]);
  const [found, team] = await Promise.all([crm.companies.get(id, { today }), crm.team.list()]);
  if (!found.ok) return found.error === "not_found" ? notFound() : redirect(landingFor(found.error));
  const company = found.value;
  const owners = ownerOptions(valueOrLanding(team));

  return (
    <>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-bold tracking-tight">{company.name}</h1>
            <StatusChip status={company.status} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {[company.industry, company.city].filter(Boolean).join(", ")}
            {(company.industry || company.city) && ". "}
            Owner: <span className="font-semibold text-foreground">{fullName(company.owner)}</span>
          </p>
          <SandboxLine />
        </div>
        <div className="flex gap-2">
          <EditCompanyButton
            owners={owners}
            company={{ id: company.id, name: company.name, industry: company.industry, city: company.city, ownerId: company.owner.id }}
          />
          <DeleteCompanyButton company={company} />
        </div>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Timeline company={company} />
        <div className="grid gap-5">
          <Retainers company={company} owners={owners} />
          <Deals company={company} />
          <Contacts company={company} />
        </div>
      </div>
    </>
  );
}

function Timeline({ company }: { company: CompanyDetail }) {
  const contacts = company.contacts.map(({ id, name }) => ({ id, name }));
  return (
    <section aria-labelledby="activity-heading" className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="activity-heading" className="text-[16px] font-bold">
          Activity <span className="font-semibold text-muted-foreground">({company.activities.length})</span>
        </h2>
        <LogActivityButton companyId={company.id} contacts={contacts} />
      </header>
      {company.activities.length === 0 ? (
        <p className="px-5 py-8 text-center text-muted-foreground">No Activity yet. Log the first one.</p>
      ) : (
        <ol className="divide-y divide-border">
          {company.activities.map((activity) => {
            const Icon = ACTIVITY_KIND_ICON[activity.kind];
            return (
              <li key={activity.id} className="flex gap-3 px-5 py-4">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-tint text-primary" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{activity.kind}</span>
                    {" by "}
                    {fullName(activity.author)}
                    {activity.contact && <> with {activity.contact.name}</>}
                    {activity.deal && (
                      <>
                        {" about "}
                        <Link href={`/deals/${activity.deal.id}`} className="font-semibold text-primary hover:underline">
                          {activity.deal.title}
                        </Link>
                      </>
                    )}
                    {", "}
                    <RelativeTime iso={activity.occurredAt.toISOString()} />
                  </p>
                  <p className="mt-1 whitespace-pre-line">{activity.text}</p>
                </div>
                <ActivityActions
                  contacts={contacts}
                  activity={{
                    id: activity.id,
                    kind: activity.kind,
                    occurredAt: activity.occurredAt.toISOString(),
                    contactId: activity.contact?.id ?? null,
                    text: activity.text,
                  }}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Contacts({ company }: { company: CompanyDetail }) {
  return (
    <section aria-labelledby="contacts-heading" className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="contacts-heading" className="text-[16px] font-bold">
          Contacts <span className="font-semibold text-muted-foreground">({company.contacts.length})</span>
        </h2>
        <AddContactButton companyId={company.id} companyName={company.name} />
      </header>
      {company.contacts.length === 0 ? (
        <p className="px-5 py-8 text-center text-muted-foreground">No Contacts yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {company.contacts.map((contact) => (
            <li key={contact.id} className="flex items-start justify-between gap-2 px-5 py-3">
              <div className="min-w-0 py-1">
                <p className="font-semibold">{contact.name}</p>
                {contact.jobTitle && <p className="text-[13px] text-muted-foreground">{contact.jobTitle}</p>}
                {contact.email && <p className="truncate text-[13px]">{contact.email}</p>}
                {contact.phone && <p className="text-[13px]">{contact.phone}</p>}
              </div>
              <ContactActions contact={contact} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Retainers({ company, owners }: { company: CompanyDetail; owners: OwnerOption[] }) {
  return (
    <section aria-labelledby="retainers-heading" className="rounded-xl border border-border bg-card">
      <h2 id="retainers-heading" className="border-b border-border px-5 py-3 text-[16px] font-bold">
        Retainers <span className="font-semibold text-muted-foreground">({company.retainers.length})</span>
      </h2>
      {company.retainers.length === 0 ? (
        <p className="px-5 py-6 text-center text-muted-foreground">No Retainers. Winning a Deal starts one.</p>
      ) : (
        <ul className="divide-y divide-border">
          {company.retainers.map((retainer) => (
            <li key={retainer.id} className="px-5 py-3">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{retainer.deal.title}</span>
                <RetainerStateChip state={retainer.state} />
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{usd(retainer.monthlyFee)}</span> a month, ends{" "}
                {longDay(retainer.endDate)}. Owner: {fullName(retainer.owner)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <RetainerRenewal retainer={retainer} owners={owners} />
                <EditEndDateButton
                  retainer={{ id: retainer.id, startDate: retainer.startDate, endDate: retainer.endDate, title: retainer.deal.title }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Deals({ company }: { company: CompanyDetail }) {
  return (
    <section aria-labelledby="deals-heading" className="rounded-xl border border-border bg-card">
      <h2 id="deals-heading" className="border-b border-border px-5 py-3 text-[16px] font-bold">
        Deals <span className="font-semibold text-muted-foreground">({company.deals.length})</span>
      </h2>
      {company.deals.length === 0 ? (
        <p className="px-5 py-6 text-center text-muted-foreground">No Deals yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {company.deals.map((deal) => (
            <li key={deal.id}>
              <Link
                href={`/deals/${deal.id}`}
                className="flex min-h-11 items-start justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-tint-faint"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-primary">{deal.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <StageDot stage={deal.stage} /> {deal.stage}
                    {deal.lostReason && `: ${deal.lostReason}`}
                    {deal.kind === "Renewal" && " · Renewal"}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums">{usd(deal.monthlyValue)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

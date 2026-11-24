import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CalendarClock, CircleDashed } from "lucide-react";
import { LinkSwitch } from "@/components/app/link-switch";
import { PageHeader } from "@/components/app/page-header";
import { STAGE_COLOR, StageDot } from "@/components/pipeline/stage";
import { RetainerStateChip } from "@/components/retainers/retainer-state";
import type { DealCard, HomeOverview, Retainer } from "@/lib/crm";
import { requireLiveSandbox, valueOrLanding } from "@/lib/crm/server";
import { dueLabel, fullName, longDay, usd } from "@/lib/format";
import { visitorToday } from "@/lib/visitor-day";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Maya's day: what needs her first, what ends soon, and how the agency's Pipeline is doing. */
export function HomeView({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Home">
        <Suspense>
          <HomeControls searchParams={searchParams} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<p role="status" className="mt-5 rounded-xl border border-border bg-card p-4 text-muted-foreground">Loading Home...</p>}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function isEveryone(searchParams: SearchParams) {
  return (await searchParams).everyone === "1";
}

async function HomeControls({ searchParams }: { searchParams: SearchParams }) {
  const everyone = await isEveryone(searchParams);
  return (
    <LinkSwitch
      label="Whose work"
      options={[
        { label: "Mine", href: "/home", active: !everyone },
        { label: "Everyone", href: "/home?everyone=1", active: everyone },
      ]}
    />
  );
}

async function Overview({ searchParams }: { searchParams: SearchParams }) {
  const everyone = await isEveryone(searchParams);
  const [{ crm }, today] = await Promise.all([requireLiveSandbox(), visitorToday()]);
  const { attention, endingSoon, pipeline } = valueOrLanding(
    await crm.home.overview({ today, owners: everyone ? "everyone" : "mine" }),
  );
  return (
    <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid grid-cols-1 gap-5">
        <ListCard
          id="attention"
          title="Needs attention"
          count={attention.length}
          detail="Deals whose Next step is overdue or missing"
          empty={`Nothing needs attention. ${everyone ? "Every open Deal has" : "All of your open Deals have"} a Next step, and none is overdue.`}
        >
          {attention.map((deal) => (
            <li key={deal.id}>
              <AttentionRow deal={deal} today={today} showOwner={everyone} />
            </li>
          ))}
        </ListCard>
        <ListCard
          id="ending-soon"
          title="Retainers ending soon"
          count={endingSoon.length}
          detail="Ending within 60 days"
          empty={everyone ? "No Retainers end within 60 days." : "None of your Retainers end within 60 days."}
        >
          {endingSoon.map((retainer) => (
            <li key={retainer.id}>
              <RetainerRow retainer={retainer} showOwner={everyone} />
            </li>
          ))}
        </ListCard>
      </div>
      <PipelineValue pipeline={pipeline} />
    </div>
  );
}

type ListCardProps = { id: string; title: string; count: number; detail: string; empty: string; children: ReactNode };

function ListCard({ id, title, count, detail, empty, children }: ListCardProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <h2 id={`${id}-heading`} className="text-[16px] font-bold">
          {title} <span className="font-semibold text-muted-foreground">({count})</span>
        </h2>
        <p className="text-[13px] text-muted-foreground">{detail}</p>
      </header>
      {count === 0 ? <p className="px-5 py-8 text-center text-muted-foreground">{empty}</p> : <ul className="divide-y divide-border">{children}</ul>}
    </section>
  );
}

const ROW_CLASS = "flex min-h-11 flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3 transition-colors duration-150 hover:bg-tint-faint";

function AttentionRow({ deal, today, showOwner }: { deal: DealCard; today: string; showOwner: boolean }) {
  return (
    <Link href={`/deals/${deal.id}`} className={ROW_CLASS}>
      <span className="min-w-0 flex-1 basis-60">
        <span className="block font-semibold text-primary">{deal.company.name}</span>
        <span className="block text-[13px] text-muted-foreground">
          {deal.kind === "Renewal" && "Renewal · "}
          {deal.title}
        </span>
        {deal.nextStep && <span className="mt-1 block text-[14px]">{deal.nextStep.text}</span>}
        {showOwner && <span className="mt-1 block text-[13px] text-muted-foreground">Owner: {fullName(deal.owner)}</span>}
      </span>
      <span className="sm:text-right">
        {deal.nextStep ? (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-destructive sm:justify-end">
            <CalendarClock className="size-4 shrink-0" aria-hidden /> {dueLabel(deal.nextStep.due, today)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-warning sm:justify-end">
            <CircleDashed className="size-4 shrink-0" aria-hidden /> No Next step
          </span>
        )}
        <span className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground sm:justify-end">
          <StageDot stage={deal.stage} /> {deal.stage}, {usd(deal.monthlyValue)} a month
        </span>
      </span>
    </Link>
  );
}

function RetainerRow({ retainer, showOwner }: { retainer: Retainer; showOwner: boolean }) {
  return (
    <Link href={`/companies/${retainer.company.id}`} className={ROW_CLASS}>
      <span className="min-w-0 flex-1 basis-60">
        <span className="block font-semibold text-primary">{retainer.company.name}</span>
        <span className="block text-[13px] text-muted-foreground">
          {retainer.deal.title}, {usd(retainer.monthlyFee)} a month
        </span>
        {showOwner && <span className="mt-1 block text-[13px] text-muted-foreground">Owner: {fullName(retainer.owner)}</span>}
      </span>
      <span className="sm:text-right">
        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="text-[14px] tabular-nums">{longDay(retainer.endDate)}</span>
          <RetainerStateChip state={retainer.state} />
        </span>
        <span className="mt-1 block text-[13px] text-muted-foreground">
          {retainer.openRenewal ? `Renewal in ${retainer.openRenewal.stage}` : "No Renewal yet"}
        </span>
      </span>
    </Link>
  );
}

/** Open Deals' Monthly value by Stage. Every bar is named and valued, so color and length only help. */
function PipelineValue({ pipeline }: { pipeline: HomeOverview["pipeline"] }) {
  const largest = Math.max(...pipeline.stages.map((stage) => stage.monthlyValue), 1);
  return (
    <section aria-labelledby="pipeline-value-heading" className="rounded-xl border border-border bg-card p-5">
      <h2 id="pipeline-value-heading" className="text-[16px] font-bold">
        Open pipeline
      </h2>
      <p className="mt-1 text-[26px] font-bold tabular-nums">{usd(pipeline.monthlyValue)}</p>
      <p className="text-[13px] text-muted-foreground">
        a month, {pipeline.openDeals} open {pipeline.openDeals === 1 ? "Deal" : "Deals"}, the whole agency
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3">
        {pipeline.stages.map(({ stage, count, monthlyValue }) => (
          <li key={stage}>
            <p className="flex items-baseline justify-between gap-2 text-[14px]">
              <span className="font-semibold">
                {stage}{" "}
                <span className="text-[13px] font-medium text-muted-foreground">
                  {count} {count === 1 ? "Deal" : "Deals"}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{usd(monthlyValue)}</span>
            </p>
            <div className="mt-1 h-2" aria-hidden>
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${(monthlyValue / largest) * 100}%`, background: STAGE_COLOR[stage] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <Link href="/pipeline" className="mt-3 inline-flex min-h-11 items-center text-[14px] font-semibold text-primary hover:underline">
        Open the Pipeline
      </Link>
    </section>
  );
}

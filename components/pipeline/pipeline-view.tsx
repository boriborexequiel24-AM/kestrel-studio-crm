import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, Check, CircleX, MessageSquareText, Repeat, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { RelativeTime } from "@/components/app/relative-time";
import { ACTIVITY_KIND_ICON } from "@/components/companies/activity-kind";
import { LogActivityButton } from "@/components/companies/activity-forms";
import { ownerOptions } from "@/components/companies/owner-options";
import { RetainerStateChip } from "@/components/retainers/retainer-state";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OPEN_STAGES, isOpenStage, type Crm, type DealCard, type DealDetail, type DealStage, type LostReason, type PipelineBoard, type Retainer } from "@/lib/crm";
import { requireLiveSandbox, valueOrLanding, landingFor } from "@/lib/crm/server";
import { dueLabel, fullName, longDay, usd, usdShort } from "@/lib/format";
import { visitorToday } from "@/lib/visitor-day";
import { ClosedTable } from "./closed-table";
import { DealSheetFrame } from "./deal-sheet-frame";
import { choiceQuery, readChoice, type PipelineChoice } from "./pipeline-choice";
import { ProposalCard } from "./proposal-card";
import { DeleteDealButton, EditDealButton, NewDealButton, NextStepButton, type DealFormOptions } from "./deal-forms";
import { STAGE_COLOR } from "./stage";
import { MoveToMenu, StageSelect, type StagedDeal } from "./stage-controls";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The Pipeline, optionally with one Deal open in a Sheet beside it (the Deal's own route). */
export function PipelineView({ searchParams, openDealId }: { searchParams: SearchParams; openDealId?: string }) {
  return (
    <>
      <PageHeader title="Pipeline">
        <Suspense>
          <PipelineControls searchParams={searchParams} openDealId={openDealId} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<p role="status" className="mt-5 rounded-xl border border-border bg-card p-4 text-muted-foreground">Loading the Pipeline...</p>}>
        <Deals searchParams={searchParams} openDealId={openDealId} />
      </Suspense>
      {openDealId && (
        <Suspense>
          <DealSheet id={openDealId} searchParams={searchParams} />
        </Suspense>
      )}
    </>
  );
}

async function choiceFrom(searchParams: SearchParams): Promise<PipelineChoice> {
  const params = await searchParams;
  return readChoice((name) => params[name]);
}

/** Only what the Stage controls need goes to the browser, not the whole Deal. */
function stagedDeal({ id, title, kind, stage, monthlyValue, proposal }: DealCard): StagedDeal {
  return { id, title, kind, stage, monthlyValue, proposal };
}

/** The Companies and Owners a Deal form can pick from. */
async function dealFormOptions(crm: Crm): Promise<DealFormOptions> {
  const [companies, team] = await Promise.all([crm.companies.list({ today: await visitorToday() }), crm.team.list()]);
  return {
    companies: valueOrLanding(companies).map((company) => ({ value: company.id, label: company.name })),
    owners: ownerOptions(valueOrLanding(team)),
  };
}

async function PipelineControls({ searchParams, openDealId }: { searchParams: SearchParams; openDealId?: string }) {
  const choice = await choiceFrom(searchParams);
  const { crm } = await requireLiveSandbox();
  // Switching stays on the open Deal, if there is one.
  const href = (change: Partial<PipelineChoice>) =>
    `${openDealId ? `/deals/${openDealId}` : "/pipeline"}${choiceQuery({ ...choice, ...change })}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Switch
        label="Open or Closed Deals"
        options={[
          { label: "Open", href: href({ closed: false }), active: !choice.closed },
          { label: "Closed", href: href({ closed: true }), active: choice.closed },
        ]}
      />
      <Switch
        label="Whose Deals"
        options={[
          { label: "Everyone", href: href({ mine: false }), active: !choice.mine },
          { label: "Mine", href: href({ mine: true }), active: choice.mine },
        ]}
      />
      <NewDealButton options={await dealFormOptions(crm)} mine={choice.mine} />
    </div>
  );
}

function Switch({ label, options }: { label: string; options: { label: string; href: string; active: boolean }[] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-border bg-card p-1 text-[14px] font-semibold">
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          scroll={false}
          aria-current={option.active ? "true" : undefined}
          className={`relative flex h-9 items-center rounded-md px-4 transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-1 ${
            option.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** The KPI strip, then the grid of open Deals or the table of closed ones. */
async function Deals({ searchParams, openDealId }: { searchParams: SearchParams; openDealId?: string }) {
  const choice = await choiceFrom(searchParams);
  const [{ crm }, today] = await Promise.all([requireLiveSandbox(), visitorToday()]);
  const view = { today, owners: choice.mine ? ("mine" as const) : ("everyone" as const) };
  const [board, closed] = await Promise.all([crm.pipeline.board(view), choice.closed ? crm.pipeline.closed(view) : null]);
  return (
    <>
      <KpiStrip board={valueOrLanding(board)} />
      {closed ? (
        <ClosedTable deals={valueOrLanding(closed)} choice={choice} openDealId={openDealId} />
      ) : (
        <Grid board={valueOrLanding(board)} today={today} choice={choice} openDealId={openDealId} />
      )}
    </>
  );
}

function Grid({ board, today, choice, openDealId }: { board: PipelineBoard; today: string; choice: PipelineChoice; openDealId?: string }) {
  return (
    <>
      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1060px] table-fixed border-collapse text-left">
          <caption className="sr-only">Open Deals by Owner and Stage</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-48 px-4 py-3 text-[13px] font-semibold text-muted-foreground">
                Owner
              </th>
              {board.stages.map((column) => (
                <th key={column.stage} scope="col" className="border-l border-border px-3 py-3 align-top">
                  <div className="h-1 rounded-full" style={{ background: STAGE_COLOR[column.stage] }} aria-hidden />
                  <div className="mt-2 text-[14px] font-bold">{column.stage}</div>
                  <div className="text-[12px] font-medium text-muted-foreground tabular-nums">
                    {column.count} {column.count === 1 ? "Deal" : "Deals"}, {usd(column.monthlyValue)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.owners.map(({ owner, monthlyValue }) => (
              <tr key={owner.id} className={`border-b border-border last:border-0 ${owner.isPersona ? "bg-tint-faint" : ""}`}>
                <th scope="row" className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                        owner.isPersona ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                      aria-hidden
                    >
                      {owner.initials}
                    </span>
                    <span className="text-[14px] leading-tight font-semibold">
                      {fullName(owner)}
                      {owner.isPersona && <span className="ml-1.5 rounded-md bg-tint px-1.5 py-0.5 text-[12px] text-primary">You</span>}
                      <span className="block text-[12px] font-medium text-muted-foreground tabular-nums">{usd(monthlyValue)} a month</span>
                    </span>
                  </div>
                </th>
                {OPEN_STAGES.map((stage) => (
                  <td key={stage} className="border-l border-border p-2 align-top">
                    <ul className="space-y-2">
                      {board.deals
                        .filter((deal) => deal.owner.id === owner.id && deal.stage === stage)
                        .map((deal) => (
                          <li key={deal.id}>
                            <DealCardView deal={deal} today={today} choice={choice} selected={deal.id === openDealId} />
                          </li>
                        ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Select a Deal to open it beside the Pipeline. Change its Stage there, or with the menu on its card.
      </p>
    </>
  );
}

function KpiStrip({ board }: { board: PipelineBoard }) {
  const { openMonthlyValue, openDeals, proposalsOut, wonThisMonth, overdueNextSteps } = board.kpis;
  const deals = (count: number) => (count === 1 ? "Deal" : "Deals");
  return (
    <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Open pipeline" value={usd(openMonthlyValue)} detail={`${openDeals} open ${deals(openDeals)}, a month`} bar="bg-primary" />
      <Kpi
        label="Proposals out"
        value={usd(proposalsOut.monthlyValue)}
        detail={`${proposalsOut.deals} ${deals(proposalsOut.deals)} with a Sent Proposal, a month`}
        bar="bg-stage-proposal-sent"
      />
      <Kpi
        label="Won this month"
        value={usd(wonThisMonth.monthlyValue)}
        detail={`${wonThisMonth.deals} ${deals(wonThisMonth.deals)} won, a month`}
        bar="bg-stage-won"
      />
      <Kpi
        label="Overdue Next steps"
        value={String(overdueNextSteps)}
        detail={overdueNextSteps ? "Overdue: needs action today" : "All on time"}
        bar={overdueNextSteps ? "bg-destructive" : "bg-stage-new"}
        alert={overdueNextSteps > 0}
      />
    </dl>
  );
}

function Kpi({ label, value, detail, bar, alert = false }: { label: string; value: string; detail: string; bar: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${alert ? "border-destructive/40" : "border-border"}`}>
      <dt className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        <span className={`h-3 w-1 rounded-full ${bar}`} aria-hidden /> {label}
      </dt>
      <dd className={`mt-1 text-[26px] font-bold tabular-nums ${alert ? "text-destructive" : ""}`}>{value}</dd>
      <dd className={`text-[12px] ${alert ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{detail}</dd>
    </div>
  );
}

function DealCardView({ deal, today, choice, selected }: { deal: DealCard; today: string; choice: PipelineChoice; selected: boolean }) {
  const overdue = deal.nextStep?.overdue;
  return (
    <div
      className={`relative rounded-lg border transition-colors duration-150 ${
        selected ? "border-primary bg-tint" : "border-border bg-card hover:border-primary/60 hover:bg-tint-faint"
      }`}
    >
      <Link
        href={`/deals/${deal.id}${choiceQuery(choice)}`}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className="block min-h-11 rounded-lg p-2.5 pr-9"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14px] font-semibold">{deal.company.name}</span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums">{usdShort(deal.monthlyValue)}</span>
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {deal.kind === "Renewal" && "Renewal · "}
          {deal.title}
        </span>
        {deal.nextStep ? (
          <>
            <span className="mt-1.5 block truncate text-[12px]">{deal.nextStep.text}</span>
            <span className={`mt-0.5 flex items-center gap-1 text-[12px] font-semibold ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{dueLabel(deal.nextStep.due, today)}</span>
            </span>
          </>
        ) : (
          <span className="mt-1.5 block text-[12px] font-semibold text-muted-foreground">No Next step</span>
        )}
      </Link>
      <div className="absolute top-1.5 right-1.5">
        <MoveToMenu deal={stagedDeal(deal)} />
      </div>
    </div>
  );
}

async function DealSheet({ id, searchParams }: { id: string; searchParams: SearchParams }) {
  const choice = await choiceFrom(searchParams);
  const [{ crm }, today] = await Promise.all([requireLiveSandbox(), visitorToday()]);
  const [found, options] = await Promise.all([crm.deals.get(id, { today }), dealFormOptions(crm)]);
  if (!found.ok) return found.error === "not_found" ? notFound() : redirect(landingFor(found.error));
  const deal = found.value;

  return (
    <DealSheetFrame closeHref={`/pipeline${choiceQuery(choice)}`}>
      <SheetHeader className="sticky top-0 z-10 gap-2 border-b border-border bg-card p-5 pr-14">
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
          <Link href={`/companies/${deal.company.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
            {deal.company.name}
          </Link>
          <span aria-hidden>·</span> {deal.company.status} <span aria-hidden>·</span> {deal.kind}
        </p>
        <SheetTitle className="text-[22px] leading-tight font-bold">{deal.title}</SheetTitle>
        <SheetDescription className="sr-only">
          Deal for {deal.company.name}, in {deal.stage}
        </SheetDescription>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <StageSelect deal={stagedDeal(deal)} />
          <div className="text-right">
            <div className="text-[24px] leading-none font-bold tabular-nums">{usd(deal.monthlyValue)}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {deal.proposal ? `a month, Proposal v${deal.proposal.version}` : "a month, estimated"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditDealButton
            deal={{
              id: deal.id,
              title: deal.title,
              companyId: deal.company.id,
              ownerId: deal.owner.id,
              estimatedMonthlyValue: deal.estimatedMonthlyValue,
              nextStep: deal.nextStep?.text ?? "",
              nextStepDue: deal.nextStep?.due ?? null,
              companyFixedBy: deal.companyFixedBy,
            }}
            options={options}
          />
          {deal.stage !== "Won" && <DeleteDealButton deal={{ id: deal.id, title: deal.title }} choice={choice} />}
        </div>
      </SheetHeader>

      <div className="space-y-5 p-5">
        <StageStepper stage={deal.stage} />
        {deal.lostReason && <LostBanner reason={deal.lostReason} on={deal.closedOn} />}
        {deal.retainer && <RetainerCard deal={deal} retainer={deal.retainer} />}
        {(deal.nextStep || isOpenStage(deal.stage)) && <NextStepCard deal={deal} today={today} />}
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <ProposalCard deal={deal} />
          <PeopleCard deal={deal} />
        </div>
        <DealActivities deal={deal} />
      </div>
    </DealSheetFrame>
  );
}

/** Where the Deal is in the Pipeline: color, name and a check for done Stages, never color alone. */
function StageStepper({ stage: reached }: { stage: DealStage }) {
  // A Won Deal is past every open Stage. A Lost one doesn't keep how far it got.
  const current = isOpenStage(reached) ? OPEN_STAGES.indexOf(reached) : reached === "Won" ? OPEN_STAGES.length : -1;
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Stage progress">
      {OPEN_STAGES.map((stage, index) => {
        const done = index < current;
        const isCurrent = index === current;
        return (
          <li key={stage} aria-current={isCurrent ? "step" : undefined}>
            <div className="h-1.5 rounded-full" style={{ background: done || isCurrent ? STAGE_COLOR[stage] : "var(--border)" }} />
            <div className={`mt-1.5 flex items-center gap-1 text-[12px] ${isCurrent ? "font-bold" : done ? "font-medium" : "text-muted-foreground"}`}>
              {done && <Check className="size-3.5 shrink-0 text-won" aria-label="done" />}
              {stage}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LostBanner({ reason, on }: { reason: LostReason; on: string | null }) {
  return (
    <section aria-labelledby="lost-heading" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <CircleX className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div>
        <h3 id="lost-heading" className="text-[15px] font-bold text-destructive">
          Lost: {reason}
        </h3>
        {on && <p className="text-[13px] text-muted-foreground">On {longDay(on)}. To reopen it, pick an open Stage.</p>}
      </div>
    </section>
  );
}

const RENEWAL_HEADING = { open: "Renews this Retainer", Won: "Renewed this Retainer", Lost: "Did not renew this Retainer" };

/** What winning the Deal started, or the Retainer a Renewal is about. */
function RetainerCard({ deal, retainer }: { deal: DealDetail; retainer: Retainer }) {
  const heading = deal.kind === "New business" ? "Retainer" : RENEWAL_HEADING[isOpenStage(deal.stage) ? "open" : deal.stage];
  return (
    <section
      aria-labelledby="retainer-heading"
      className={`rounded-xl border p-4 ${deal.stage === "Won" ? "border-won/30 bg-won/5" : "border-border bg-card"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="retainer-heading" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Repeat className="size-4" aria-hidden /> {heading}
        </h3>
        <RetainerStateChip state={retainer.state} />
      </div>
      <p className="mt-1 text-[17px] font-semibold tabular-nums">{usd(retainer.monthlyFee)} a month</p>
      <p className="text-[13px] text-muted-foreground">
        {deal.kind === "Renewal" && `${retainer.deal.title}, `}
        {longDay(retainer.startDate)} to {longDay(retainer.endDate)}
      </p>
    </section>
  );
}

function NextStepCard({ deal, today }: { deal: DealDetail; today: string }) {
  const next = deal.nextStep;
  return (
    <section aria-labelledby="next-step-heading" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="next-step-heading" className="text-[13px] font-semibold text-muted-foreground">
          Next step
        </h3>
        <NextStepButton dealId={deal.id} nextStep={next?.text ?? ""} due={next?.due ?? null} />
      </div>
      {next ? (
        <>
          <p className="mt-1 text-[17px] font-semibold">{next.text}</p>
          <p className={`mt-1 flex items-center gap-1 text-[13px] font-semibold ${next.overdue ? "text-destructive" : "text-muted-foreground"}`}>
            <CalendarClock className="size-4" aria-hidden />
            {/* A closed Deal's Next step isn't overdue, so it just says its day. */}
            {isOpenStage(deal.stage) || !next.due ? dueLabel(next.due, today) : `Due ${longDay(next.due)}`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[14px] text-muted-foreground">No Next step yet. Every Deal should have one clear action.</p>
      )}
    </section>
  );
}

function PeopleCard({ deal }: { deal: DealDetail }) {
  return (
    <section aria-labelledby="people-heading" className="rounded-xl border border-border bg-card p-4">
      <h3 id="people-heading" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        <Users className="size-4" aria-hidden /> People
      </h3>
      {deal.contacts.length ? (
        <ul className="mt-2 grid gap-2.5">
          {deal.contacts.map((contact) => (
            <li key={contact.id} className="text-[14px] leading-tight">
              <b>{contact.name}</b>
              {contact.jobTitle && <span className="block text-[12px] text-muted-foreground">{contact.jobTitle}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-muted-foreground">No Contacts at {deal.company.name} yet.</p>
      )}
      <p className="mt-3 text-[13px] text-muted-foreground">
        Owner: <span className="font-semibold text-foreground">{fullName(deal.owner)}</span>
      </p>
    </section>
  );
}

function DealActivities({ deal }: { deal: DealDetail }) {
  return (
    <section aria-labelledby="deal-activity-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="deal-activity-heading" className="flex items-center gap-1.5 text-[15px] font-bold">
          <MessageSquareText className="size-4" aria-hidden /> Activity ({deal.activities.length})
        </h3>
        <LogActivityButton
          companyId={deal.company.id}
          dealId={deal.id}
          contacts={deal.contacts.map(({ id, name }) => ({ id, name }))}
        />
      </div>
      {deal.activities.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted-foreground">No Activity on this Deal yet.</p>
      ) : (
        <ol className="mt-2 space-y-3">
          {deal.activities.map((activity) => {
            const Icon = ACTIVITY_KIND_ICON[activity.kind];
            return (
              <li key={activity.id} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden>
                  <Icon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 text-[14px]">
                  <p className="text-[12px] text-muted-foreground">
                    <b className="text-foreground">{activity.kind}</b> by {fullName(activity.author)}
                    {activity.contact && <> with {activity.contact.name}</>}, <RelativeTime iso={activity.occurredAt.toISOString()} />
                  </p>
                  <p className="leading-relaxed">{activity.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

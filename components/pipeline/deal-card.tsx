import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { DealCard } from "@/lib/crm";
import { dueLabel, fullName, usdShort } from "@/lib/format";
import { choiceQuery, type PipelineChoice } from "./pipeline-choice";
import { MoveToMenu, type StagedDeal } from "./stage-controls";

/** Only what the Stage controls need goes to the browser, not the whole Deal. */
export function stagedDeal({ id, title, kind, stage, monthlyValue, proposal }: DealCard): StagedDeal {
  return { id, title, kind, stage, monthlyValue, proposal };
}

type DealCardViewProps = {
  deal: DealCard;
  today: string;
  choice: PipelineChoice;
  selected: boolean;
  /** Outside the grid, a card has no row to say whose it is. */
  showOwner?: boolean;
};

/** A Deal at a glance: a link to open it, with "Move to..." on top. */
export function DealCardView({ deal, today, choice, selected, showOwner = false }: DealCardViewProps) {
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
        className="block min-h-11 rounded-lg p-2.5 pr-11"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14px] font-semibold">{deal.company.name}</span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums">{usdShort(deal.monthlyValue)}</span>
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {deal.kind === "Renewal" && "Renewal · "}
          {deal.title}
        </span>
        {showOwner && <span className="block truncate text-[12px] text-muted-foreground">Owner: {fullName(deal.owner)}</span>}
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

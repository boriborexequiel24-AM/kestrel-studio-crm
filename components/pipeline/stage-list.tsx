import Link from "next/link";
import type { PipelineBoard } from "@/lib/crm";
import { usd } from "@/lib/format";
import { DealCardView } from "./deal-card";
import { choiceQuery, openStageOf, type PipelineChoice } from "./pipeline-choice";
import { StageDot } from "./stage";

/** The open Pipeline on a narrow screen: one Stage at a time. */
export function StageList({ board, today, choice, openDealId }: { board: PipelineBoard; today: string; choice: PipelineChoice; openDealId?: string }) {
  // A Deal opened from a link shows its own Stage behind it.
  const shown = choice.stage ?? openStageOf(board.deals.find((deal) => deal.id === openDealId)) ?? "New";
  const deals = board.deals.filter((deal) => deal.stage === shown);
  const total = board.stages.find((each) => each.stage === shown)?.monthlyValue ?? 0;

  return (
    <>
      <div role="group" aria-label="Stages" className="mt-5">
        <ul className="flex flex-wrap gap-1.5 sm:gap-2">
          {board.stages.map(({ stage, count }) => (
            <li key={stage}>
              <Link
                href={`/pipeline${choiceQuery({ ...choice, stage })}`}
                replace
                scroll={false}
                aria-current={stage === shown ? "true" : undefined}
                className={`flex h-11 items-center gap-1.5 rounded-lg border px-2 text-[13px] sm:gap-2 sm:px-3 sm:text-[14px] font-semibold transition-colors duration-150 ${
                  stage === shown ? "border-primary bg-tint text-primary" : "border-border bg-card hover:border-primary/60"
                }`}
              >
                <StageDot stage={stage} />
                {stage}
                <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  {count}
                  <span className="sr-only"> {count === 1 ? "Deal" : "Deals"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <section aria-labelledby="stage-list-heading" className="mt-4">
        <h2 id="stage-list-heading" className="text-[15px] font-bold">
          {shown}{" "}
          <span className="ml-1 text-[13px] font-medium text-muted-foreground tabular-nums">{usd(total)} a month</span>
        </h2>
        {deals.length ? (
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {deals.map((deal) => (
              <li key={deal.id} className="min-w-0">
                <DealCardView deal={deal} today={today} choice={{ ...choice, stage: shown }} selected={deal.id === openDealId} showOwner />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl border border-border bg-card px-4 py-8 text-center text-muted-foreground">No Deals in {shown}.</p>
        )}
      </section>
      <p className="mt-3 text-[12px] text-muted-foreground">Select a Deal to open it. Change its Stage there, or with the menu on its card.</p>
    </>
  );
}

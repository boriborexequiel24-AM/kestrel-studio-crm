import { History, Sparkles } from "lucide-react";
import { RelativeTime } from "@/components/app/relative-time";
import type { AiActionsLeft, Summary } from "@/lib/crm";
import { ActionsLeft } from "./actions-left";
import { SummarizeButton } from "./summarize-button";

type SummaryCardProps = {
  /** Where it's shown. A Company and one of its Deals can both be in the page at once. */
  id: string;
  companyId: string;
  companyName: string;
  summary: Summary | null;
  actions: AiActionsLeft;
  /** "h3" under a title that is already an h2, such as a Deal's Sheet. */
  heading?: "h2" | "h3";
};

/** The AI's story of a Company in three lines, saved until its Activities change. */
export function SummaryCard({ id, companyId, companyName, summary, actions, heading: Heading = "h2" }: SummaryCardProps) {
  const spent = actions.left === 0;
  const headingId = `summary-${id}`;
  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-primary/20 bg-tint p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Heading id={headingId} tabIndex={-1} className="flex min-w-0 items-center gap-1.5 text-[16px] font-bold">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">Summary of {companyName}</span>
        </Heading>
        {summary?.upToDate && <p className="text-[12px] font-semibold text-muted-foreground">Cached until new Activity</p>}
      </div>
      <div aria-live="polite">
        {summary ? (
          <>
            <ul className="mt-2 grid list-disc grid-cols-1 gap-1.5 pl-5 marker:text-primary">
              {summary.lines.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Written by AI, <RelativeTime iso={summary.writtenAt.toISOString()} />. Check it before you rely on it.
            </p>
            {!summary.upToDate && (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold text-warning">
                <History className="mt-0.5 size-4 shrink-0" aria-hidden /> Out of date: the Activities have changed since.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-muted-foreground">
            The story so far in three lines, from its Activities, Deals and Retainers.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!summary?.upToDate && <SummarizeButton companyId={companyId} headingId={headingId} again={summary !== null} disabled={spent} />}
        <ActionsLeft actions={actions} />
      </div>
      {spent && !summary?.upToDate && (
        <p role="status" className="mt-2 text-[13px]">You have used all {actions.limit} AI actions for today. Everything else keeps working.</p>
      )}
    </section>
  );
}

import Link from "next/link";
import type { ClosedStage, DealCard } from "@/lib/crm";
import { fullName, longDay, usd } from "@/lib/format";
import { choiceQuery, type PipelineChoice } from "./pipeline-choice";
import { StageDot } from "./stage";

/** Won and Lost Deals, the latest first. Each row opens its Deal. */
export function ClosedTable({ deals, choice, openDealId }: { deals: DealCard[]; choice: PipelineChoice; openDealId?: string }) {
  const count = (stage: ClosedStage) => deals.filter((deal) => deal.stage === stage).length;
  return (
    <div className="relative mt-5 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[980px] text-left text-[14px]">
        <caption className="border-b border-border px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground">
          {count("Won")} Won and {count("Lost")} Lost {deals.length === 1 ? "Deal" : "Deals"}, the latest first
        </caption>
        <thead className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-2.5 font-semibold">Company</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Deal</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Owner</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Stage</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Monthly value</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Lost reason</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Closed</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const selected = deal.id === openDealId;
            return (
              <tr
                key={deal.id}
                // The clip holds the row's link to its row where a row can't be positioned.
                className={`relative border-b [clip-path:inset(0)] border-border transition-colors duration-150 last:border-0 ${
                  selected ? "bg-tint" : "hover:bg-tint-faint"
                }`}
              >
                <td className="px-4 py-3">{deal.company.name}</td>
                <th scope="row" className="px-4 py-3 font-semibold">
                  {/* The link covers the whole row. */}
                  <Link
                    href={`/deals/${deal.id}${choiceQuery(choice)}`}
                    scroll={false}
                    aria-current={selected ? "true" : undefined}
                    className="text-primary after:absolute after:inset-0 hover:underline"
                  >
                    {deal.kind === "Renewal" && "Renewal · "}
                    {deal.title}
                  </Link>
                </th>
                <td className="px-4 py-3">{fullName(deal.owner)}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <StageDot stage={deal.stage} /> {deal.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{usd(deal.monthlyValue)}</td>
                <td className="px-4 py-3">{deal.lostReason}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                  {deal.closedOn && longDay(deal.closedOn)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {deals.length === 0 && <p className="px-4 py-8 text-center text-muted-foreground">No Won or Lost Deals yet.</p>}
    </div>
  );
}

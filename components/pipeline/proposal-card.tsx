import { ChevronRight, FileText } from "lucide-react";
import { RelativeTime } from "@/components/app/relative-time";
import type { DealDetail, Proposal, ProposalStatus } from "@/lib/crm";
import { usd } from "@/lib/format";
import { DeclineProposalButton, EditProposalButton, NewProposalButton, SendProposalButton } from "./proposal-forms";

const isOpen = (proposal: Proposal) => proposal.status === "Draft" || proposal.status === "Sent";

/** A Deal's Proposals: a Draft and the Sent one in full, settled ones folded away. */
export function ProposalCard({ deal }: { deal: DealDetail }) {
  const open = deal.proposals.filter(isOpen);
  const settled = deal.proposals.filter((proposal) => !isOpen(proposal));
  const hasDraft = open.some((proposal) => proposal.status === "Draft");
  return (
    <section aria-labelledby="proposal-heading" className="rounded-xl border border-border bg-card p-4">
      <h3 id="proposal-heading" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        <FileText className="size-4" aria-hidden /> Proposal
      </h3>
      {deal.proposals.length === 0 && <p className="mt-2 text-[14px] text-muted-foreground">No Proposal on this Deal yet.</p>}
      <div className="divide-y divide-border">
        {open.map((proposal) => (
          <div key={proposal.id} className="py-3">
            <ProposalDetails proposal={proposal} />
            <div className="mt-3 flex flex-wrap items-start gap-2">
              {proposal.status === "Draft" && (
                <>
                  {/* The key drops an old "already Sent" message once that Proposal is declined. */}
                  <SendProposalButton key={deal.sentProposalVersion} proposalId={proposal.id} />
                  <EditProposalButton
                    proposal={{
                      id: proposal.id,
                      version: proposal.version,
                      scopeSummary: proposal.scopeSummary,
                      termMonths: proposal.termMonths,
                      lineItems: proposal.lineItems,
                    }}
                  />
                </>
              )}
              {proposal.status === "Sent" && <DeclineProposalButton proposalId={proposal.id} version={proposal.version} />}
            </div>
          </div>
        ))}
        {settled.map((proposal) => (
          <details key={proposal.id} className="group py-1">
            <summary className="flex min-h-11 cursor-pointer items-center gap-1 rounded-md text-[13px] font-semibold hover:text-primary">
              <ChevronRight className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-90" aria-hidden />
              v{proposal.version}, {proposal.status}, {usd(proposal.monthlyTotal)} a month
            </summary>
            <div className="pb-3">
              <ProposalDetails proposal={proposal} />
            </div>
          </details>
        ))}
      </div>
      {!hasDraft && (
        <div className="mt-2">
          <NewProposalButton dealId={deal.id} revising={deal.proposals.length > 0} />
        </div>
      )}
    </section>
  );
}

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[20px] font-bold tabular-nums">
          {usd(proposal.monthlyTotal)} <span className="text-[12px] font-medium text-muted-foreground">a month</span>
        </span>
        <StatusPill status={proposal.status} />
      </div>
      <p className="text-[12px] text-muted-foreground">
        v{proposal.version}, {proposal.termMonths} {proposal.termMonths === 1 ? "month" : "months"}
        {proposal.sentAt && (
          <>
            , sent <RelativeTime iso={proposal.sentAt.toISOString()} />
          </>
        )}
      </p>
      <p className="mt-2 text-[13px] whitespace-pre-line">{proposal.scopeSummary}</p>
      <ul className="mt-2 divide-y divide-border text-[13px]">
        {proposal.lineItems.map((item, index) => (
          <li key={index} className="flex justify-between gap-2 py-1.5">
            <span className="min-w-0 break-words">{item.service}</span>
            <span className="shrink-0 font-semibold tabular-nums">{usd(item.monthlyFee)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

const STATUS_DOT: Record<ProposalStatus, string> = {
  Draft: "var(--stage-new)",
  Sent: "var(--stage-proposal-sent)",
  Accepted: "var(--stage-won)",
  Declined: "var(--stage-lost)",
};

/** The status as a word, with a color beside it. */
function StatusPill({ status }: { status: ProposalStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-[12px] font-semibold">
      <span className="size-2 rounded-full" style={{ background: STATUS_DOT[status] }} aria-hidden />
      {status}
    </span>
  );
}

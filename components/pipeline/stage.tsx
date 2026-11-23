import type { DealStage } from "@/lib/crm/terms";

/** Each Stage's color, from the theme. Always shown next to the Stage's name, never alone. */
export const STAGE_COLOR: Record<DealStage, string> = {
  New: "var(--stage-new)",
  Qualified: "var(--stage-qualified)",
  Discovery: "var(--stage-discovery)",
  "Proposal sent": "var(--stage-proposal-sent)",
  Negotiation: "var(--stage-negotiation)",
  Won: "var(--stage-won)",
  Lost: "var(--stage-lost)",
};

export function StageDot({ stage, className = "size-2" }: { stage: DealStage; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: STAGE_COLOR[stage] }} aria-hidden />;
}

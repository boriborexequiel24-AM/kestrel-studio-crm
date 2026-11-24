import { CircleCheck, CircleSlash, Hourglass } from "lucide-react";
import type { RetainerState } from "@/lib/crm/terms";

const LOOK: Record<RetainerState, { icon: typeof CircleCheck; className: string }> = {
  Active: { icon: CircleCheck, className: "border-won/30 bg-won/5 text-won-hover" },
  "Ends soon": { icon: Hourglass, className: "border-warning/30 bg-warning/5 text-warning" },
  Ended: { icon: CircleSlash, className: "border-border bg-muted text-muted-foreground" },
};

/** Where a Retainer is: always a word and an icon, never color alone. */
export function RetainerStateChip({ state }: { state: RetainerState }) {
  const { icon: Icon, className } = LOOK[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${className}`}>
      <Icon className="size-3.5" aria-hidden /> {state}
    </span>
  );
}

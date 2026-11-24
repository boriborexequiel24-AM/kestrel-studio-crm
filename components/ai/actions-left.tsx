import type { AiActionsLeft } from "@/lib/crm";

/** "29 of 30 AI actions left today", beside every AI feature. */
export function ActionsLeft({ actions: { left, limit } }: { actions: AiActionsLeft }) {
  return (
    <p className="text-[12px] text-muted-foreground tabular-nums">
      {left} of {limit} AI actions left today
    </p>
  );
}

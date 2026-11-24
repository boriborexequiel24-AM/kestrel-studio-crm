"use client";

import { useActionState, useRef, useState, useTransition, type RefObject } from "react";
import { MoreHorizontal } from "lucide-react";
import { moveDeal } from "@/app/(app)/pipeline/actions";
import { ConfirmDialog } from "@/components/forms/form-dialog";
import { IDLE } from "@/components/forms/form-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DealCard } from "@/lib/crm";
import { OPEN_STAGES, type DealStage } from "@/lib/crm/terms";
import { usd } from "@/lib/format";
import { StageDot } from "./stage";

/** The part of a Deal its Stage controls need. */
export type StagedDeal = Pick<DealCard, "id" | "title" | "stage" | "monthlyValue" | "proposal">;

const canWin = (deal: StagedDeal) => deal.proposal?.status === "Sent";
const WON_RULE = "needs a Sent Proposal";

/** Asks before a Deal is won: it accepts the Proposal and starts the Retainer, and neither can be undone. */
function WinDialog({
  deal,
  ...opened
}: {
  deal: StagedDeal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: RefObject<HTMLElement | null>;
}) {
  return (
    <ConfirmDialog
      opened={opened}
      title="Mark Proposal accepted and start the Retainer?"
      description={`Proposal v${deal.proposal?.version} of "${deal.title}" becomes Accepted, the Deal moves to Won, and a Retainer at ${usd(
        deal.monthlyValue,
      )} a month starts today. You can't undo it, but Start over brings back the sample data.`}
      action={moveDeal}
      confirmLabel="Accept and start"
      pendingLabel="Starting..."
      tone="positive"
      hidden={{ dealId: deal.id, stage: "Won", proposalVersion: String(deal.proposal?.version ?? "") }}
    />
  );
}

/** The Deal Sheet's Stage dropdown. Picking an open Stage moves the Deal at once; Won asks first and is final. */
export function StageSelect({ deal }: { deal: StagedDeal }) {
  const [state, action, pending] = useActionState(moveDeal, IDLE);
  const [winning, setWinning] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const select = useRef<HTMLSelectElement>(null);

  if (deal.stage === "Won") {
    return (
      <p className="flex h-11 items-center gap-2 text-[14px] font-semibold">
        <StageDot stage="Won" className="size-3" />
        Won
      </p>
    );
  }

  function pick(target: HTMLSelectElement) {
    if (target.value !== "Won") return form.current?.requestSubmit();
    target.value = deal.stage;
    setWinning(true);
  }

  return (
    <form ref={form} action={action} className="grid gap-1">
      <input type="hidden" name="dealId" value={deal.id} />
      <label htmlFor="deal-stage" className="sr-only">
        Stage
      </label>
      <div className="flex items-center gap-2">
        <StageDot stage={deal.stage} className="size-3" />
        <select
          ref={select}
          id="deal-stage"
          name="stage"
          defaultValue={deal.stage}
          key={deal.stage}
          disabled={pending}
          onChange={(event) => pick(event.target)}
          className="h-11 rounded-lg border border-input bg-card px-3 text-[14px] font-semibold transition-colors duration-150 hover:border-muted-foreground"
        >
          {OPEN_STAGES.map((open) => (
            <option key={open} value={open}>
              {open}
            </option>
          ))}
          <option value="Won" disabled={!canWin(deal)}>
            {canWin(deal) ? "Won" : `Won (${WON_RULE})`}
          </option>
          <option value="Lost" disabled>
            Lost (needs a Lost reason)
          </option>
        </select>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <WinDialog deal={deal} open={winning} onOpenChange={setWinning} returnFocusTo={select} />
    </form>
  );
}

/** "Move to..." on a Deal card: the other open Stages, and Won once there's a Sent Proposal. */
export function MoveToMenu({ deal }: { deal: StagedDeal }) {
  const [state, action] = useActionState(moveDeal, IDLE);
  const [pending, startTransition] = useTransition();
  const [winning, setWinning] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function moveTo(target: DealStage) {
    const form = new FormData();
    form.set("dealId", deal.id);
    form.set("stage", target);
    startTransition(() => action(form));
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          aria-label={`Move ${deal.title} to another Stage`}
          disabled={pending}
          className="relative grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-150 after:absolute after:-inset-1.5 hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 border-border">
          <DropdownMenuLabel className="text-[12px] text-muted-foreground">Move to...</DropdownMenuLabel>
          {OPEN_STAGES.filter((open) => open !== deal.stage).map((open) => (
            <DropdownMenuItem key={open} onSelect={() => moveTo(open)} className="min-h-11 gap-2 text-[14px]">
              <StageDot stage={open} />
              {open}
            </DropdownMenuItem>
          ))}
          {/* Not faded when disabled: the reason has to stay readable. */}
          <DropdownMenuItem
            disabled={!canWin(deal)}
            onSelect={() => setWinning(true)}
            className="min-h-11 gap-2 text-[14px] data-[disabled]:text-muted-foreground data-[disabled]:opacity-100"
          >
            <StageDot stage="Won" />
            <span>
              Won
              {!canWin(deal) && <span className="block text-[12px]">{WON_RULE}</span>}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WinDialog deal={deal} open={winning} onOpenChange={setWinning} returnFocusTo={trigger} />
      {state.status === "error" && (
        <p
          role="alert"
          className="absolute top-9 right-0 z-10 w-48 rounded-md border border-destructive/30 bg-card p-2 text-[12px] font-semibold text-destructive"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

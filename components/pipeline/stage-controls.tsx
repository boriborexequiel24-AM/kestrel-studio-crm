"use client";

import { useActionState, useRef, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { moveDeal } from "@/app/(app)/pipeline/actions";
import { IDLE } from "@/components/forms/form-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OPEN_STAGES, type DealStage } from "@/lib/crm/terms";
import { StageDot } from "./stage";

/** Why Won and Lost can't be picked yet. Tickets 07 and 09 make them available. */
function wonLostRules(hasSentProposal: boolean): [DealStage, string][] {
  return [
    ["Won", hasSentProposal ? "coming soon" : "needs a Sent Proposal"],
    ["Lost", "needs a Lost reason"],
  ];
}

/** The Deal Sheet's Stage dropdown. Picking a Stage moves the Deal at once. */
export function StageSelect({ dealId, stage, hasSentProposal }: { dealId: string; stage: DealStage; hasSentProposal: boolean }) {
  const [state, action, pending] = useActionState(moveDeal, IDLE);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="grid gap-1">
      <input type="hidden" name="dealId" value={dealId} />
      <label htmlFor="deal-stage" className="sr-only">
        Stage
      </label>
      <div className="flex items-center gap-2">
        <StageDot stage={stage} className="size-3" />
        <select
          id="deal-stage"
          name="stage"
          defaultValue={stage}
          key={stage}
          disabled={pending}
          onChange={() => form.current?.requestSubmit()}
          className="h-11 rounded-lg border border-input bg-card px-3 text-[14px] font-semibold transition-colors duration-150 hover:border-muted-foreground"
        >
          {OPEN_STAGES.map((open) => (
            <option key={open} value={open}>
              {open}
            </option>
          ))}
          {wonLostRules(hasSentProposal).map(([wonOrLost, rule]) => (
            <option key={wonOrLost} value={wonOrLost} disabled>
              {wonOrLost} ({rule})
            </option>
          ))}
        </select>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** "Move to..." on a Deal card: the other open Stages. */
export function MoveToMenu({ dealId, stage, dealTitle }: { dealId: string; stage: DealStage; dealTitle: string }) {
  const [state, action] = useActionState(moveDeal, IDLE);
  const [pending, startTransition] = useTransition();

  function moveTo(target: DealStage) {
    const form = new FormData();
    form.set("dealId", dealId);
    form.set("stage", target);
    startTransition(() => action(form));
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Move ${dealTitle} to another Stage`}
          disabled={pending}
          className="relative grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-150 after:absolute after:-inset-1.5 hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 border-border">
          <DropdownMenuLabel className="text-[12px] text-muted-foreground">Move to...</DropdownMenuLabel>
          {OPEN_STAGES.filter((open) => open !== stage).map((open) => (
            <DropdownMenuItem key={open} onSelect={() => moveTo(open)} className="min-h-11 gap-2 text-[14px]">
              <StageDot stage={open} />
              {open}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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

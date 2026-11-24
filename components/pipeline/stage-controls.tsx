"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { moveDeal } from "@/app/(app)/pipeline/actions";
import { SelectField } from "@/components/forms/fields";
import { ConfirmDialog, FormDialog, type Opened } from "@/components/forms/form-dialog";
import { IDLE } from "@/components/forms/form-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DealCard } from "@/lib/crm";
import { LOST_REASONS, OPEN_STAGES, isOpenStage, type ClosedStage, type DealStage, type OpenStage } from "@/lib/crm/terms";
import { usd } from "@/lib/format";
import { StageDot } from "./stage";

/** The part of a Deal its Stage controls need. */
export type StagedDeal = Pick<DealCard, "id" | "title" | "kind" | "stage" | "monthlyValue" | "proposal">;

const canWin = (deal: StagedDeal) => deal.proposal?.status === "Sent";
const WON_RULE = "needs a Sent Proposal";

/** What winning does, in words: New business starts a Retainer, a Renewal extends the one it renews. */
const WIN_COPY = {
  "New business": {
    title: "Mark Proposal accepted and start the Retainer?",
    outcome: (fee: string) => `a Retainer at ${fee} a month starts today`,
    confirmLabel: "Accept and start",
    pendingLabel: "Starting...",
  },
  Renewal: {
    title: "Mark Proposal accepted and extend the Retainer?",
    outcome: (fee: string) => `its Retainer is extended by the Proposal's term, at ${fee} a month`,
    confirmLabel: "Accept and extend",
    pendingLabel: "Extending...",
  },
};

/** Asks before a Deal is won: it accepts the Proposal and starts or extends the Retainer, and neither can be undone. */
function WinDialog({ deal, ...opened }: { deal: StagedDeal } & Opened) {
  const copy = WIN_COPY[deal.kind];
  return (
    <ConfirmDialog
      opened={opened}
      title={copy.title}
      description={`Proposal v${deal.proposal?.version} of "${deal.title}" becomes Accepted, the Deal moves to Won, and ${copy.outcome(
        usd(deal.monthlyValue),
      )}. You can't undo it, but Start over brings back the sample data.`}
      action={moveDeal}
      confirmLabel={copy.confirmLabel}
      pendingLabel={copy.pendingLabel}
      tone="positive"
      hidden={{ dealId: deal.id, stage: "Won", proposalVersion: String(deal.proposal?.version ?? "") }}
    />
  );
}

const REASON_OPTIONS = [{ value: "", label: "Pick a reason" }, ...LOST_REASONS.map((reason) => ({ value: reason, label: reason }))];

/** Asks why before a Deal is Lost. */
function LoseDialog({ deal, ...opened }: { deal: StagedDeal } & Opened) {
  return (
    <FormDialog
      opened={opened}
      title={`Mark "${deal.title}" as Lost?`}
      description="It leaves the open Pipeline and shows under Closed, with its Lost reason. You can move it back to an open Stage later."
      action={moveDeal}
      submitLabel="Mark as Lost"
      hidden={{ dealId: deal.id, stage: "Lost" }}
    >
      <SelectField label="Lost reason" name="lostReason" options={REASON_OPTIONS} defaultValue="" required />
    </FormDialog>
  );
}

/** Asks before a Lost Deal opens again, since that clears its Lost reason. */
function ReopenDialog({ deal, stage, ...opened }: { deal: StagedDeal; stage: OpenStage } & Opened) {
  return (
    <ConfirmDialog
      opened={opened}
      title={`Reopen "${deal.title}" in ${stage}?`}
      description="It goes back to the open Pipeline, and its Lost reason is cleared."
      action={moveDeal}
      confirmLabel="Reopen Deal"
      pendingLabel="Reopening..."
      tone="positive"
      hidden={{ dealId: deal.id, stage }}
    />
  );
}

/** Won and Lost each ask something first, then go back to the control they were picked from. */
function useClosingDialogs() {
  const [asking, setAsking] = useState<ClosedStage | null>(null);
  const opened = (stage: ClosedStage) => ({
    open: asking === stage,
    onOpenChange: (open: boolean) => setAsking(open ? stage : null),
  });
  return { ask: setAsking, won: opened("Won"), lost: opened("Lost") };
}

/** The Deal Sheet's Stage dropdown. Picking an open Stage moves an open Deal at once; anything else asks first, and Won is final. */
export function StageSelect({ deal }: { deal: StagedDeal }) {
  const [state, action, pending] = useActionState(moveDeal, IDLE);
  const closing = useClosingDialogs();
  const [reopening, setReopening] = useState<{ open: boolean; stage: OpenStage }>({ open: false, stage: "New" });
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
    const picked = target.value as DealStage;
    if (isOpenStage(picked) && deal.stage !== "Lost") return form.current?.requestSubmit();
    target.value = deal.stage;
    if (isOpenStage(picked)) setReopening({ open: true, stage: picked });
    else closing.ask(picked);
  }

  return (
    <>
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
            className="h-11 max-w-44 rounded-lg border border-input bg-card px-3 text-[16px] font-semibold transition-colors duration-150 hover:border-muted-foreground sm:max-w-none sm:text-[14px]"
          >
            {OPEN_STAGES.map((open) => (
              <option key={open} value={open}>
                {open}
              </option>
            ))}
            <option value="Won" disabled={!canWin(deal)}>
              {canWin(deal) ? "Won" : `Won (${WON_RULE})`}
            </option>
            <option value="Lost">Lost</option>
          </select>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {state.message}
          </p>
        )}
      </form>
      <WinDialog deal={deal} {...closing.won} returnFocusTo={select} />
      <LoseDialog deal={deal} {...closing.lost} returnFocusTo={select} />
      <ReopenDialog
        deal={deal}
        stage={reopening.stage}
        open={reopening.open}
        onOpenChange={(open) => setReopening({ ...reopening, open })}
        returnFocusTo={select}
      />
    </>
  );
}

/** "Move to..." on a Deal card: the other open Stages, Won once there's a Sent Proposal, and Lost. */
export function MoveToMenu({ deal }: { deal: StagedDeal }) {
  const [state, action] = useActionState(moveDeal, IDLE);
  const [pending, startTransition] = useTransition();
  const closing = useClosingDialogs();
  const trigger = useRef<HTMLButtonElement>(null);

  function moveTo(target: OpenStage) {
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
            onSelect={() => closing.ask("Won")}
            className="min-h-11 gap-2 text-[14px] data-[disabled]:text-muted-foreground data-[disabled]:opacity-100"
          >
            <StageDot stage="Won" />
            <span>
              Won
              {!canWin(deal) && <span className="block text-[12px]">{WON_RULE}</span>}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => closing.ask("Lost")} className="min-h-11 gap-2 text-[14px]">
            <StageDot stage="Lost" />
            Lost
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WinDialog deal={deal} {...closing.won} returnFocusTo={trigger} />
      <LoseDialog deal={deal} {...closing.lost} returnFocusTo={trigger} />
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

"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { createProposal, declineProposal, editProposal, sendProposal } from "@/app/(app)/pipeline/actions";
import { INPUT_CLASS, TextAreaField, TextField } from "@/components/forms/fields";
import { ConfirmDialog, FormDialog, FormError, useFormReport } from "@/components/forms/form-dialog";
import { IDLE } from "@/components/forms/form-state";
import { Button } from "@/components/ui/button";
import type { LineItem } from "@/lib/crm";
import { MAX_MONTHLY_DOLLARS, MAX_TERM_MONTHS } from "@/lib/crm/terms";
import { usd } from "@/lib/format";

/** A Draft as its edit form needs it. */
export type EditableProposal = { id: string; version: number; scopeSummary: string; termMonths: number; lineItems: LineItem[] };

export function NewProposalButton({ dealId, revising }: { dealId: string; revising: boolean }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold">
          <Plus aria-hidden /> {revising ? "Draft a revised Proposal" : "Draft a Proposal"}
        </Button>
      }
      title={revising ? "Draft a revised Proposal" : "Draft a Proposal"}
      description="It stays a Draft until you mark it as Sent. Nothing is really sent."
      action={createProposal}
      submitLabel="Save Draft"
      hidden={{ dealId }}
    >
      <ProposalFields />
    </FormDialog>
  );
}

export function EditProposalButton({ proposal }: { proposal: EditableProposal }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold">
          <Pencil aria-hidden /> Edit Draft
        </Button>
      }
      title={`Edit Proposal v${proposal.version}`}
      action={editProposal}
      submitLabel="Save Draft"
      hidden={{ proposalId: proposal.id }}
    >
      <ProposalFields proposal={proposal} />
    </FormDialog>
  );
}

/** Makes a Draft the live offer, or says why it can't be yet. */
export function SendProposalButton({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState(sendProposal, IDLE);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="proposalId" value={proposalId} />
      <Button type="submit" disabled={pending} className="h-11 rounded-lg px-4 font-semibold hover:bg-primary-hover">
        <Send aria-hidden /> {pending ? "Saving..." : "Mark as Sent"}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export function DeclineProposalButton({ proposalId, version }: { proposalId: string; version: number }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold text-destructive hover:text-destructive">
          <X aria-hidden /> Mark as Declined
        </Button>
      }
      title={`Mark Proposal v${version} as Declined?`}
      description="The Deal stays open in its Stage, back on its estimated Monthly value. You can then send a revised Proposal."
      action={declineProposal}
      confirmLabel="Mark as Declined"
      pendingLabel="Saving..."
      hidden={{ proposalId }}
    />
  );
}

function ProposalFields({ proposal }: { proposal?: EditableProposal }) {
  return (
    <>
      <TextAreaField
        label="Scope summary"
        name="scopeSummary"
        required
        defaultValue={proposal?.scopeSummary}
        placeholder="Paid social and creative for the spring launch."
      />
      <LineItemsField initial={proposal?.lineItems} />
      <TextField
        label="Term"
        hint="months"
        name="termMonths"
        type="number"
        min={1}
        max={MAX_TERM_MONTHS}
        step={1}
        inputMode="numeric"
        required
        defaultValue={proposal?.termMonths ?? 12}
      />
    </>
  );
}

/** The same rule the CRM module holds fees to, to mark the row that breaks it. */
function isFee(text: string) {
  const fee = Number(text);
  return text.trim() !== "" && Number.isInteger(fee) && fee >= 0 && fee <= MAX_MONTHLY_DOLLARS;
}

type Row = { key: number; service: string; fee: string };

/** Services and their monthly fees, adding up as they're typed. */
function LineItemsField({ initial }: { initial?: LineItem[] }) {
  const [rows, setRows] = useState<Row[]>(
    () => initial?.map((item, key) => ({ key, service: item.service, fee: String(item.monthlyFee) })) ?? [{ key: 0, service: "", fee: "" }],
  );
  const report = useFormReport();
  const blamed = report.status === "error" ? report.field : undefined;
  const total = rows.reduce((sum, row) => sum + (Number(row.fee) || 0), 0);

  function change(key: number, part: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...part } : row)));
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-[13px] font-semibold">Line items</legend>
      <div className="hidden gap-2 text-[12px] text-muted-foreground sm:flex" aria-hidden>
        <span className="flex-1">Service</span>
        <span className="w-28">Monthly fee, USD</span>
        <span className="w-11" />
      </div>
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="flex flex-wrap items-center gap-2 border-b border-border pb-2 sm:flex-nowrap sm:border-0 sm:pb-0"
        >
          <span className="w-full text-[12px] text-muted-foreground sm:hidden" aria-hidden>
            Service, then monthly fee in USD
          </span>
          <input
            name="service"
            aria-label={`Service ${index + 1}`}
            aria-invalid={(blamed === "service" && !row.service.trim()) || undefined}
            required
            value={row.service}
            onChange={(event) => change(row.key, { service: event.target.value })}
            placeholder="Paid social"
            className={`${INPUT_CLASS} min-w-0 sm:flex-1`}
          />
          <input
            name="monthlyFee"
            type="number"
            min={0}
            max={MAX_MONTHLY_DOLLARS}
            step={1}
            inputMode="numeric"
            aria-label={`Monthly fee ${index + 1}, in USD`}
            aria-invalid={(blamed === "monthlyFee" && !isFee(row.fee)) || undefined}
            required
            value={row.fee}
            onChange={(event) => change(row.key, { fee: event.target.value })}
            placeholder="4200"
            className={`${INPUT_CLASS} min-w-0 flex-1 sm:w-28! sm:flex-none`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-lg"
            aria-label={`Remove line item ${index + 1}`}
            disabled={rows.length === 1}
            onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-lg px-3 font-semibold"
          onClick={() => setRows((current) => [...current, { key: Math.max(...current.map((row) => row.key)) + 1, service: "", fee: "" }])}
        >
          <Plus aria-hidden /> Add a line item
        </Button>
        <p className="text-[14px]" aria-live="polite">
          Monthly total <b className="tabular-nums">{usd(total)}</b>
        </p>
      </div>
    </fieldset>
  );
}

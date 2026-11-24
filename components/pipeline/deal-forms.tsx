"use client";

import { CalendarClock, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { createDeal, deleteDeal, setNextStep, updateDeal } from "@/app/(app)/pipeline/actions";
import type { OwnerOption } from "@/components/companies/owner-options";
import { SelectField, TextField } from "@/components/forms/fields";
import { ConfirmDeleteDialog, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { DealDetail } from "@/lib/crm";
import { MAX_MONTHLY_DOLLARS } from "@/lib/crm/terms";
import { choiceFields, type PipelineChoice } from "./pipeline-choice";

type CompanyOption = { value: string; label: string };

/** A Deal as its edit form needs it. */
export type EditableDeal = {
  id: string;
  title: string;
  companyId: string;
  ownerId: string;
  estimatedMonthlyValue: number;
  nextStep: string;
  nextStepDue: string | null;
  /** Why the Company can't change, if it can't. */
  companyFixedBy: DealDetail["companyFixedBy"];
};

const FIXED_BECAUSE: Record<NonNullable<EditableDeal["companyFixedBy"]>, string> = {
  Renewal: "Fixed, because this Deal renews this Company's Retainer.",
  Activities: "Fixed, because this Deal has Activities about it.",
  Proposal: "Fixed, because a Proposal was sent to this Company.",
};

/** What a form for a new or an existing Deal starts with. */
type DealStart = Partial<Omit<EditableDeal, "id">>;

/** The choices a Deal form offers. */
export type DealFormOptions = { companies: CompanyOption[]; owners: OwnerOption[] };

function DealFields({ options, deal }: { options: DealFormOptions; deal?: DealStart }) {
  const { companies, owners } = options;
  return (
    <>
      <TextField label="Title" name="title" defaultValue={deal?.title} required autoComplete="off" placeholder="Product launch campaign" />
      {deal?.companyFixedBy ? (
        <div className="grid grid-cols-1 gap-1.5">
          <p className="text-[13px] font-semibold">Company</p>
          <p className="text-[14px]">
            {companies.find((company) => company.value === deal.companyId)?.label}
            <span className="block text-[13px] text-muted-foreground">{FIXED_BECAUSE[deal.companyFixedBy]}</span>
          </p>
          <input type="hidden" name="companyId" value={deal.companyId} />
        </div>
      ) : (
        <SelectField label="Company" name="companyId" options={companies} defaultValue={deal?.companyId ?? companies[0]?.value} />
      )}
      <SelectField label="Owner" name="ownerId" options={owners} defaultValue={deal?.ownerId ?? owners[0]?.value} />
      <TextField
        label="Monthly value, estimated"
        hint="USD a month"
        name="estimatedMonthlyValue"
        type="number"
        min={0}
        max={MAX_MONTHLY_DOLLARS}
        step={1}
        inputMode="numeric"
        required
        defaultValue={deal?.estimatedMonthlyValue}
      />
      <NextStepFields nextStep={deal?.nextStep} due={deal?.nextStepDue} />
    </>
  );
}

function NextStepFields({ nextStep, due }: { nextStep?: string; due?: string | null }) {
  return (
    <>
      <TextField label="Next step" hint="optional" name="nextStep" defaultValue={nextStep} placeholder="Send the proposal" />
      <TextField label="Next step due" hint="optional" name="nextStepDue" type="date" defaultValue={due ?? ""} />
    </>
  );
}

export function NewDealButton({ options, mine }: { options: DealFormOptions; mine: boolean }) {
  return (
    <FormDialog
      trigger={
        <Button className="h-11 rounded-lg px-4 font-semibold hover:bg-primary-hover">
          <Plus aria-hidden /> New Deal
        </Button>
      }
      title="New Deal"
      description="New business, starting in New. Its Monthly value is an estimate until a Proposal is sent. To renew a Retainer, start from Retainers or the Company."
      action={createDeal}
      submitLabel="Add Deal"
      hidden={choiceFields({ mine, closed: false, stage: null })}
    >
      <DealFields options={options} />
    </FormDialog>
  );
}

/** What a Renewal starts from. */
export type RenewableRetainer = { id: string; title: string; company: { id: string; name: string }; ownerId: string; monthlyFee: number };

export function StartRenewalButton({ retainer, owners }: { retainer: RenewableRetainer; owners: OwnerOption[] }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" aria-label={`Start Renewal of ${retainer.company.name}: ${retainer.title}`} className="h-11 rounded-lg px-3 font-semibold">
          <Repeat aria-hidden /> Start Renewal
        </Button>
      }
      title="Start Renewal"
      description="A Deal in New. Winning it extends this Retainer by the Proposal's term, at the Proposal's fee."
      action={createDeal}
      submitLabel="Start Renewal"
      hidden={{ renewsRetainerId: retainer.id }}
    >
      <DealFields
        options={{ owners, companies: [{ value: retainer.company.id, label: retainer.company.name }] }}
        deal={{
          title: retainer.title,
          companyId: retainer.company.id,
          ownerId: retainer.ownerId,
          estimatedMonthlyValue: retainer.monthlyFee,
          companyFixedBy: "Renewal",
        }}
      />
    </FormDialog>
  );
}

export function EditDealButton({ deal, options }: { deal: EditableDeal; options: DealFormOptions }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold">
          <Pencil aria-hidden /> Edit
        </Button>
      }
      title="Edit Deal"
      action={updateDeal}
      submitLabel="Save changes"
      hidden={{ dealId: deal.id }}
    >
      <DealFields options={options} deal={deal} />
    </FormDialog>
  );
}

export function DeleteDealButton({ deal, choice }: { deal: { id: string; title: string }; choice: PipelineChoice }) {
  return (
    <ConfirmDeleteDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold text-destructive hover:text-destructive">
          <Trash2 aria-hidden /> Delete
        </Button>
      }
      title={`Delete "${deal.title}"?`}
      description="Its Activities stay on the Company's timeline."
      action={deleteDeal}
      confirmLabel="Delete Deal"
      hidden={{ dealId: deal.id, ...choiceFields(choice) }}
    />
  );
}

export function NextStepButton({ dealId, nextStep, due }: { dealId: string; nextStep: string; due: string | null }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold">
          <CalendarClock aria-hidden /> {nextStep ? "Change" : "Set a Next step"}
        </Button>
      }
      title="Next step"
      description="The one action this Deal is waiting on. Leave it empty to clear it."
      action={setNextStep}
      submitLabel="Save Next step"
      hidden={{ dealId }}
    >
      <NextStepFields nextStep={nextStep} due={due} />
    </FormDialog>
  );
}

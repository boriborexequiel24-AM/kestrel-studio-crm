"use client";

import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { createDeal, deleteDeal, setNextStep, updateDeal } from "@/app/(app)/pipeline/actions";
import type { OwnerOption } from "@/components/companies/owner-options";
import { SelectField, TextField } from "@/components/forms/fields";
import { ConfirmDeleteDialog, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";

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
  /** Once a Deal has Activities, its Company can't change. */
  companyFixed: boolean;
};

/** The choices a Deal form offers. */
export type DealFormOptions = { companies: CompanyOption[]; owners: OwnerOption[] };

function DealFields({ options, deal }: { options: DealFormOptions; deal?: EditableDeal }) {
  const { companies, owners } = options;
  return (
    <>
      <TextField label="Title" name="title" defaultValue={deal?.title} required autoComplete="off" placeholder="Spring launch campaign" />
      {deal?.companyFixed ? (
        <div className="grid gap-1.5">
          <p className="text-[13px] font-semibold">Company</p>
          <p className="text-[14px]">
            {companies.find((company) => company.value === deal.companyId)?.label}
            <span className="block text-[13px] text-muted-foreground">Fixed, because this Deal has Activities about it.</span>
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
      description="It starts in New. Its Monthly value is an estimate until a Proposal is sent."
      action={createDeal}
      submitLabel="Add Deal"
      hidden={mine ? { mine: "1" } : {}}
    >
      <DealFields options={options} />
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

export function DeleteDealButton({ deal, mine }: { deal: { id: string; title: string }; mine: boolean }) {
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
      hidden={mine ? { dealId: deal.id, mine: "1" } : { dealId: deal.id }}
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

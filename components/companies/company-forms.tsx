"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { createCompany, deleteCompany, updateCompany } from "@/app/(app)/companies/actions";
import { SelectField, TextField } from "@/components/forms/fields";
import { ConfirmDeleteDialog, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { OwnerOption } from "./owner-options";

type EditableCompany = { id: string; name: string; industry: string; city: string; ownerId: string };

function CompanyFields({ owners, company }: { owners: OwnerOption[]; company?: EditableCompany }) {
  return (
    <>
      <TextField label="Name" name="name" defaultValue={company?.name} required autoComplete="off" />
      <TextField label="Industry" name="industry" hint="optional" defaultValue={company?.industry} placeholder="Craft brewery" />
      <TextField label="City" name="city" hint="optional" defaultValue={company?.city} placeholder="Bend, OR" />
      <SelectField label="Owner" name="ownerId" options={owners} defaultValue={company?.ownerId ?? owners[0]?.value} />
    </>
  );
}

export function NewCompanyButton({ owners }: { owners: OwnerOption[] }) {
  return (
    <FormDialog
      trigger={
        <Button className="h-11 rounded-lg px-4 font-semibold hover:bg-primary-hover">
          <Plus aria-hidden /> New Company
        </Button>
      }
      title="New Company"
      action={createCompany}
      submitLabel="Add Company"
    >
      <CompanyFields owners={owners} />
    </FormDialog>
  );
}

export function EditCompanyButton({ owners, company }: { owners: OwnerOption[]; company: EditableCompany }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-4 font-semibold">
          <Pencil aria-hidden /> Edit
        </Button>
      }
      title={`Edit ${company.name}`}
      action={updateCompany}
      submitLabel="Save changes"
      hidden={{ companyId: company.id }}
    >
      <CompanyFields owners={owners} company={company} />
    </FormDialog>
  );
}

export function DeleteCompanyButton({ company }: { company: { id: string; name: string } }) {
  return (
    <ConfirmDeleteDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-4 font-semibold text-destructive hover:text-destructive">
          <Trash2 aria-hidden /> Delete
        </Button>
      }
      title={`Delete ${company.name}?`}
      description="This also deletes its Contacts, Deals, Retainers and Activity history. You can't undo it, but Start over brings back the sample data."
      action={deleteCompany}
      confirmLabel="Delete Company"
      hidden={{ companyId: company.id }}
    />
  );
}

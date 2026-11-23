"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteContact, saveContact } from "@/app/(app)/companies/actions";
import { TextField } from "@/components/forms/fields";
import { ConfirmDeleteDialog, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/lib/crm";

function ContactFields({ contact }: { contact?: Contact }) {
  return (
    <>
      <TextField label="Name" name="name" defaultValue={contact?.name} required autoComplete="off" />
      <TextField label="Job title" name="jobTitle" hint="optional" defaultValue={contact?.jobTitle} />
      <TextField label="Email" name="email" type="email" hint="optional" defaultValue={contact?.email} autoComplete="off" />
      <TextField label="Phone" name="phone" type="tel" hint="optional" defaultValue={contact?.phone} autoComplete="off" />
    </>
  );
}

export function AddContactButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold">
          <Plus aria-hidden /> Add a Contact
        </Button>
      }
      title="Add a Contact"
      description={`Someone at ${companyName}.`}
      action={saveContact}
      submitLabel="Add Contact"
      hidden={{ companyId }}
    >
      <ContactFields />
    </FormDialog>
  );
}

export function ContactActions({ contact }: { contact: Contact }) {
  return (
    <div className="flex shrink-0 gap-1">
      <FormDialog
        trigger={
          <Button variant="ghost" size="icon" className="size-11 rounded-lg" aria-label={`Edit ${contact.name}`}>
            <Pencil aria-hidden />
          </Button>
        }
        title={`Edit ${contact.name}`}
        action={saveContact}
        submitLabel="Save changes"
        hidden={{ contactId: contact.id }}
      >
        <ContactFields contact={contact} />
      </FormDialog>
      <ConfirmDeleteDialog
        trigger={
          <Button variant="ghost" size="icon" className="size-11 rounded-lg text-destructive hover:text-destructive" aria-label={`Delete ${contact.name}`}>
            <Trash2 aria-hidden />
          </Button>
        }
        title={`Delete ${contact.name}?`}
        description="Their Activities stay on the Company's timeline."
        action={deleteContact}
        confirmLabel="Delete Contact"
        hidden={{ contactId: contact.id }}
      />
    </div>
  );
}

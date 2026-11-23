"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { logActivity } from "@/app/(app)/companies/actions";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { FormDialog, useFormReport } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { ACTIVITY_KINDS, type ActivityKind } from "@/lib/crm/terms";
import { ACTIVITY_KIND_ICON } from "./activity-kind";

type ContactOption = { id: string; name: string };

export function LogActivityButton({ companyId, contacts }: { companyId: string; contacts: ContactOption[] }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-lg px-3 font-semibold">
          <Plus aria-hidden /> Log an Activity
        </Button>
      }
      title="Log an Activity"
      description="Record an email, call, meeting or note. Nothing is sent."
      action={logActivity}
      submitLabel="Log Activity"
      hidden={{ companyId }}
    >
      <KindPicker />
      <ActivityDate />
      <SelectField
        label="Contact"
        name="contactId"
        hint="optional"
        options={[{ value: "", label: "No Contact" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <TextAreaField label="What happened" name="text" required placeholder="Called Rosa about the holiday launch..." />
    </FormDialog>
  );
}

function KindPicker() {
  const report = useFormReport();
  const invalid = report.status === "error" && report.field === "kind";
  const chosen = report.status === "error" ? report.values.kind : ACTIVITY_KINDS[0];
  return (
    <fieldset className="grid gap-1.5" aria-invalid={invalid || undefined}>
      <legend className="mb-1.5 text-[13px] font-semibold">Kind</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITY_KINDS.map((kind: ActivityKind) => {
          const Icon = ACTIVITY_KIND_ICON[kind];
          return (
            <label
              key={kind}
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input text-[14px] font-semibold transition-colors duration-150 hover:border-primary has-checked:border-primary has-checked:bg-tint has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input type="radio" name="kind" value={kind} defaultChecked={kind === chosen} className="sr-only" />
              <Icon className="size-4" aria-hidden />
              {kind}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A day in the visitor's own calendar. Today means "now"; another day means noon on that day. */
function ActivityDate() {
  const [today] = useState(() => localDate(new Date()));
  const [day, setDay] = useState(today);
  const occurredAt = day === today ? "now" : day ? new Date(`${day}T12:00`).toISOString() : "";
  return (
    <>
      <TextField label="Date" name="date" type="date" value={day} max={today} onChange={(event) => setDay(event.target.value)} required />
      <input type="hidden" name="occurredAt" value={occurredAt} />
    </>
  );
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

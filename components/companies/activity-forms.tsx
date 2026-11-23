"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteActivity, logActivity, updateActivity } from "@/app/(app)/companies/actions";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { ConfirmDeleteDialog, FormDialog, useFormReport } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { ACTIVITY_KINDS, type ActivityKind } from "@/lib/crm/terms";
import { ACTIVITY_KIND_ICON } from "./activity-kind";

type ContactOption = { id: string; name: string };

/** An Activity as the edit form needs it. `occurredAt` is an ISO string. */
export type EditableActivity = { id: string; kind: ActivityKind; occurredAt: string; contactId: string | null; text: string };

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
      <ActivityFields contacts={contacts} />
    </FormDialog>
  );
}

export function ActivityActions({ activity, contacts }: { activity: EditableActivity; contacts: ContactOption[] }) {
  return (
    <div className="flex shrink-0 gap-1">
      <FormDialog
        trigger={
          <Button variant="ghost" size="icon" className="size-11 rounded-lg" aria-label={`Edit this ${activity.kind}`}>
            <Pencil aria-hidden />
          </Button>
        }
        title={`Edit this ${activity.kind}`}
        action={updateActivity}
        submitLabel="Save changes"
        hidden={{ activityId: activity.id }}
      >
        <ActivityFields contacts={contacts} activity={activity} />
      </FormDialog>
      <ConfirmDeleteDialog
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-lg text-destructive hover:text-destructive"
            aria-label={`Delete this ${activity.kind}`}
          >
            <Trash2 aria-hidden />
          </Button>
        }
        title={`Delete this ${activity.kind}?`}
        description="It disappears from the Company's timeline."
        action={deleteActivity}
        confirmLabel="Delete Activity"
        hidden={{ activityId: activity.id }}
      />
    </div>
  );
}

function ActivityFields({ contacts, activity }: { contacts: ContactOption[]; activity?: EditableActivity }) {
  return (
    <>
      <KindPicker initial={activity?.kind ?? ACTIVITY_KINDS[0]} />
      <ActivityDate original={activity?.occurredAt} />
      <SelectField
        label="Contact"
        name="contactId"
        hint="optional"
        defaultValue={activity?.contactId ?? ""}
        options={[{ value: "", label: "No Contact" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <TextAreaField
        label="What happened"
        name="text"
        required
        defaultValue={activity?.text}
        placeholder="Called Rosa about the holiday launch..."
      />
    </>
  );
}

function KindPicker({ initial }: { initial: ActivityKind }) {
  const report = useFormReport();
  const invalid = report.status === "error" && report.field === "kind";
  const chosen = report.status === "error" ? report.values.kind : initial;
  return (
    <fieldset className="grid gap-1.5" aria-invalid={invalid || undefined}>
      <legend className="mb-1.5 text-[13px] font-semibold">Kind</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITY_KINDS.map((kind) => {
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

/**
 * A day in the visitor's own calendar. An unchanged day keeps the original
 * time; today means "now"; any other day means noon on that day.
 */
function ActivityDate({ original }: { original?: string }) {
  const [today] = useState(() => localDate(new Date()));
  const [originalDay] = useState(() => (original ? localDate(new Date(original)) : null));
  const [day, setDay] = useState(originalDay ?? today);
  const occurredAt =
    original && day === originalDay
      ? original
      : day === today
        ? "now"
        : day
          ? new Date(`${day}T12:00`).toISOString()
          : "";
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

"use client";

import { CalendarDays } from "lucide-react";
import { setRetainerEndDate } from "@/app/(app)/retainers/actions";
import { TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { Retainer } from "@/lib/crm";
import { longDay } from "@/lib/format";

type EndDateButtonProps = { retainer: Pick<Retainer, "id" | "startDate" | "endDate"> & { title: string } };

/** The one thing about a Retainer that can change. */
export function EditEndDateButton({ retainer }: EndDateButtonProps) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" aria-label={`Edit end date of ${retainer.title}`} className="h-11 rounded-lg px-3 font-semibold">
          <CalendarDays aria-hidden /> Edit end date
        </Button>
      }
      title="Edit end date"
      description={`${retainer.title} started ${longDay(retainer.startDate)}. The end date is its last day.`}
      action={setRetainerEndDate}
      submitLabel="Save end date"
      hidden={{ retainerId: retainer.id }}
    >
      <TextField label="End date" name="endDate" type="date" min={retainer.startDate} defaultValue={retainer.endDate} required />
    </FormDialog>
  );
}

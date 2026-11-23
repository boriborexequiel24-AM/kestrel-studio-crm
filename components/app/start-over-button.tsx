"use client";

import { startOver } from "@/app/actions";
import { ConfirmDialog } from "@/components/forms/form-dialog";

export function StartOverButton() {
  return (
    <ConfirmDialog
      trigger={
        <button type="button" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
          Start over
        </button>
      }
      title="Start over?"
      description="Everything you changed goes, and you get a fresh copy of the sample data. Your Sandbox still resets at the same time."
      action={startOver}
      confirmLabel="Start over"
      pendingLabel="Starting over..."
    />
  );
}

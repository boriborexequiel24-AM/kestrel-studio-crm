"use client";

import { startOver } from "@/app/actions";
import { useAsk } from "@/components/ai/ask-context";
import { ConfirmDialog } from "@/components/forms/form-dialog";

export function StartOverButton() {
  // The chat is about records that are about to go.
  const { clear } = useAsk();
  return (
    <ConfirmDialog
      trigger={
        <button type="button" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
          Start over
        </button>
      }
      title="Start over?"
      description="Everything you changed goes, and you get a fresh copy of the sample data. Your Sandbox still resets at the same time."
      action={() => {
        clear();
        return startOver();
      }}
      confirmLabel="Start over"
      pendingLabel="Starting over..."
    />
  );
}

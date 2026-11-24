"use client";

import { useActionState, useLayoutEffect, useRef } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { summarizeCompany } from "@/app/(app)/ai-actions";
import { FormError } from "@/components/forms/form-dialog";
import { IDLE } from "@/components/forms/form-state";
import { Button } from "@/components/ui/button";

type SummarizeButtonProps = {
  companyId: string;
  /** The card's heading, which takes focus once the summary is written. */
  headingId: string;
  again: boolean;
  disabled: boolean;
};

/** Writes a Company's summary, or writes it again once it's out of date. */
export function SummarizeButton({ companyId, headingId, again, disabled }: SummarizeButtonProps) {
  const [state, action, pending] = useActionState(summarizeCompany, IDLE);
  const form = useRef<HTMLFormElement>(null);

  // The button goes once there's an up-to-date summary; keyboard focus moves to it.
  useLayoutEffect(() => {
    const own = form.current;
    return () => {
      if (own?.contains(document.activeElement)) document.getElementById(headingId)?.focus();
    };
  }, [headingId]);

  const Icon = again ? RefreshCw : Sparkles;
  return (
    <form ref={form} action={action} onSubmit={(event) => (pending || disabled) && event.preventDefault()} className="grid grid-cols-1 gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <div>
        {/* Not `disabled`: that would drop keyboard focus. */}
        <Button
          type="submit"
          aria-disabled={pending || disabled || undefined}
          className="h-11 rounded-lg px-4 font-semibold hover:bg-primary-hover aria-disabled:opacity-50"
        >
          <Icon aria-hidden /> {pending ? "Summarizing..." : again ? "Refresh summary" : "Summarize"}
        </Button>
      </div>
      {/* With none left, the card says so itself. */}
      {!disabled && <FormError state={state} />}
    </form>
  );
}

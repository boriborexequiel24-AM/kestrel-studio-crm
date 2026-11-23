"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { openDemo, type OpenDemoState } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** "Open the demo", or "Back to your Sandbox" for a visitor whose Sandbox is still live. */
export function OpenDemoForm({ returning = false }: { returning?: boolean }) {
  const [state, formAction, pending] = useActionState<OpenDemoState, FormData>(openDemo, { limitReached: false });
  return (
    <form action={formAction} className="grid justify-items-start gap-3">
      <Button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg px-6 text-[16px] font-semibold transition-colors duration-150 hover:bg-primary-hover"
      >
        {pending ? "Opening your Sandbox..." : returning ? "Back to your Sandbox" : "Open the demo"}
        {!pending && <ArrowRight className="size-5" aria-hidden />}
      </Button>
      {state.limitReached && (
        <p
          role="alert"
          className="max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[14px] font-semibold text-destructive"
        >
          This network has opened the most Sandboxes allowed for today. Please come back tomorrow.
        </p>
      )}
    </form>
  );
}

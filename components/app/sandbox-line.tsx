import { Suspense } from "react";
import { requireLiveSandbox } from "@/lib/crm/server";
import { hoursLeftLabel } from "@/lib/format";
import { StartOverButton } from "./start-over-button";

/** "Sandbox resets in N hours. Start over", under every signed-in page title. */
export function SandboxLine() {
  return (
    <Suspense fallback={<p className="min-h-11" />}>
      <SandboxLineContent />
    </Suspense>
  );
}

async function SandboxLineContent() {
  const { sandbox } = await requireLiveSandbox();
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-[14px] text-muted-foreground">
      Sandbox resets {hoursLeftLabel(sandbox.expiresAt)}. <StartOverButton />
    </p>
  );
}

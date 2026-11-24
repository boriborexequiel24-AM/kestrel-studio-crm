import { Suspense } from "react";
import { requireLiveSandbox } from "@/lib/crm/server";
import { PageHeader } from "./page-header";

/** Stand-in for a screen that a later ticket builds. Still requires a live Sandbox. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Suspense>
        <SandboxGate />
      </Suspense>
      <p className="mt-5 rounded-xl border border-border bg-card p-4 text-muted-foreground">
        {title} is still being built. Companies, Pipeline and Retainers are ready to try.
      </p>
    </>
  );
}

async function SandboxGate() {
  await requireLiveSandbox();
  return null;
}

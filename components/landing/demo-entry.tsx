import { getCrm } from "@/lib/crm/server";
import { hoursLeftLabel } from "@/lib/format";
import { hadSandboxThatExpired } from "@/lib/sandbox-cookie";
import { OpenDemoForm } from "./open-demo-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The landing page's call to action, which depends on the visitor: back into a
 * live Sandbox, a notice when theirs was reset, or a fresh start.
 */
export async function DemoEntry({ searchParams }: { searchParams: SearchParams }) {
  const crm = await getCrm();
  const [status, params] = await Promise.all([crm.sandbox.status(), searchParams]);

  if (status.state === "live") {
    return (
      <>
        <OpenDemoForm returning />
        <p className="mt-3 text-[13px] text-muted-foreground">
          Your changes are still there. Your Sandbox resets {hoursLeftLabel(status.sandbox.expiresAt)}.
        </p>
      </>
    );
  }

  const wasReset = status.state === "expired" || params.reset === "1" || (await hadSandboxThatExpired());
  return (
    <>
      {wasReset && (
        <p role="status" className="mb-4 max-w-xl rounded-lg border border-border bg-tint px-4 py-3 text-[14px]">
          <b>Your Sandbox was reset.</b> Sandboxes last 24 hours, so your changes are gone. Open a fresh one any time.
        </p>
      )}
      <OpenDemoForm />
      <p className="mt-3 text-[13px] text-muted-foreground">No sign-up. Kestrel Studio is fictional and all data is fake.</p>
    </>
  );
}

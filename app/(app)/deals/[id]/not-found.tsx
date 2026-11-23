import Link from "next/link";
import { SandboxLine } from "@/components/app/sandbox-line";

export default function DealNotFound() {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6">
      <h1 className="text-[22px] font-bold">This Deal isn&apos;t in your Sandbox</h1>
      <SandboxLine />
      <p className="mt-1 text-muted-foreground">It may have been deleted, or the link is from someone else&apos;s Sandbox.</p>
      <Link href="/pipeline" className="mt-4 inline-flex h-11 items-center font-semibold text-primary hover:underline">
        Back to the Pipeline
      </Link>
    </div>
  );
}

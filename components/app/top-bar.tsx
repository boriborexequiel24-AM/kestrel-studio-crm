import Link from "next/link";
import { Suspense } from "react";
import { AskButton } from "@/components/ai/ask-context";
import { AskPanel } from "@/components/ai/ask-panel";
import { valueOrLanding, requireLiveSandbox } from "@/lib/crm/server";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 md:px-6">
        <Link href="/home" aria-label="Kestrel Studio, Home" className="flex min-h-11 items-center rounded-lg">
          <Logo />
        </Link>
        <MainNav className="hidden md:block" />
        <div className="ml-auto flex items-center gap-3">
          <AskButton labelClassName="sr-only sm:not-sr-only sm:whitespace-nowrap md:sr-only lg:not-sr-only" />
          <Suspense>
            <Ask />
          </Suspense>
          <Suspense fallback={<PersonaBadgeShell />}>
            <PersonaBadge />
          </Suspense>
        </div>
      </div>
      <MainNav className="overflow-x-auto border-t border-border px-2 md:hidden" />
    </header>
  );
}

async function Ask() {
  const { crm, sandbox } = await requireLiveSandbox();
  return <AskPanel sandboxId={sandbox.id} actions={valueOrLanding(await crm.ai.actionsLeft())} />;
}

async function PersonaBadge() {
  const { crm } = await requireLiveSandbox();
  const persona = valueOrLanding(await crm.team.list()).find((owner) => owner.isPersona);
  if (!persona) return <PersonaBadgeShell />;
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-full bg-persona text-[13px] font-bold text-white" aria-hidden>
        {persona.initials}
      </span>
      <p className="sr-only lg:not-sr-only lg:text-[13px] lg:leading-tight">
        <span className="sr-only">Signed in as </span>
        <b className="lg:block">{persona.firstName}</b>
        <span className="sr-only">, </span>
        <span className="lg:block lg:text-muted-foreground">{persona.role}</span>
      </p>
    </div>
  );
}

function PersonaBadgeShell() {
  return <span className="size-9 rounded-full bg-muted" aria-hidden />;
}

"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * The right-hand Sheet a Deal opens in, over the Pipeline. The Deal has its
 * own route, so closing it goes back to the Pipeline's.
 */
export function DealSheetFrame({ closeHref, title, children }: { closeHref: string; title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(open) => !open && router.push(closeHref, { scroll: false })}>
      <SheetContent side="right" className="gap-0 p-0 duration-200 desk:max-w-2xl">
        {/* On a phone the full header would fill the screen, so this bar stays instead, with Close on it. */}
        <p className="shrink-0 truncate border-b border-border bg-card py-4.5 pr-14 pl-4 text-[15px] leading-6 font-bold sm:hidden" aria-hidden>
          {title}
        </p>
        {/* Above that the Deal's header sticks, and focus keeps clear of it. */}
        <div className="min-h-0 flex-1 overflow-y-auto sm:scroll-pt-64">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

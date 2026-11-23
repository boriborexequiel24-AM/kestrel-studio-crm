"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * The right-hand Sheet a Deal opens in, over the Pipeline. The Deal has its
 * own route, so closing it goes back to the Pipeline's.
 */
export function DealSheetFrame({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(open) => !open && router.push(closeHref, { scroll: false })}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 duration-200 sm:max-w-2xl">
        {children}
      </SheetContent>
    </Sheet>
  );
}

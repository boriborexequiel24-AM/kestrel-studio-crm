import type { ReactNode } from "react";
import { SandboxLine } from "./sandbox-line";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        <SandboxLine />
      </div>
      {children}
    </div>
  );
}

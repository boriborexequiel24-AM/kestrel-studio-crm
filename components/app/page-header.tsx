import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

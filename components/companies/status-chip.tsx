import type { CompanyStatus } from "@/lib/crm";

/** Client or Prospect, always as a word, never color alone. */
export function StatusChip({ status }: { status: CompanyStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-semibold ${
        status === "Client" ? "border-won/30 bg-won/5 text-won-hover" : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

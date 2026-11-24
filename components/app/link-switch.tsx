import Link from "next/link";

/** A few choices side by side, each its own link, such as Mine and Everyone. */
export function LinkSwitch({ label, options }: { label: string; options: { label: string; href: string; active: boolean }[] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-border bg-card p-1 text-[14px] font-semibold">
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          scroll={false}
          aria-current={option.active ? "true" : undefined}
          className={`relative flex h-9 items-center rounded-md px-4 transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-1 ${
            option.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

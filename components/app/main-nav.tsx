"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/companies", label: "Companies" },
  { href: "/retainers", label: "Retainers" },
] as const;

export function MainNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1 text-[14px] font-semibold">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center rounded-lg px-3 whitespace-nowrap transition-colors duration-150 ${
                  active ? "bg-tint text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

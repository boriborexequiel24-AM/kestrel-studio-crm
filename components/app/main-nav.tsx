"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const ITEMS = [
  { href: "/home", label: "Home", also: [] },
  // A Deal opens over the Pipeline at its own route.
  { href: "/pipeline", label: "Pipeline", also: ["/deals"] },
  { href: "/companies", label: "Companies", also: [] },
  { href: "/retainers", label: "Retainers", also: [] },
] as const;

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

type NavProps = { className?: string };

// On dynamic routes the current path is only known at request time, so the
// nav first renders without a highlight and then marks the active item.
export function MainNav(props: NavProps) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <CurrentNav {...props} />
    </Suspense>
  );
}

function CurrentNav(props: NavProps) {
  return <NavList {...props} pathname={usePathname()} />;
}

function NavList({ className = "", pathname }: NavProps & { pathname: string | null }) {
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1 text-[14px] font-semibold">
        {ITEMS.map((item) => {
          const active = pathname !== null && [item.href, ...item.also].some((base) => isUnder(pathname, base));
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

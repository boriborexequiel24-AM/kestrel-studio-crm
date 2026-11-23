// Placeholder mark from the prototype's direction: a blue rounded square with a
// flat two-tone folded wing. A proper logo is a later pass.
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg bg-primary ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[56%]">
        <path d="M3 9l9 4 9-4-9 10z" fill="#fff" />
        <path d="M3 9l9-4 9 4-9 4z" fill="#93c5fd" />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] leading-tight font-bold whitespace-nowrap">Kestrel Studio</span>
    </span>
  );
}

"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { Answer } from "@/lib/crm";

/** One question and, once there is one, its answer or why there isn't. */
export type Turn = { id: number; question: string; answer?: Answer; problem?: string };

type Ask = {
  turns: Turn[];
  setTurns: (change: (turns: Turn[]) => Turn[]) => void;
  /** The button that opened the panel, while it's open: focus goes back to it. */
  opener: HTMLElement | null;
  open: (from: HTMLElement) => void;
  close: () => void;
  clear: () => void;
};

const AskContext = createContext<Ask | null>(null);

export function useAsk(): Ask {
  const ask = use(AskContext);
  if (!ask) throw new Error("useAsk needs AskProvider.");
  return ask;
}

/**
 * The chat with Ask the pipeline. It sits in the app frame, so it stays while
 * Maya moves around, and goes when the page is reloaded. It's stored nowhere.
 */
export function AskProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setOpener(null), []);
  const clear = useCallback(() => setTurns([]), []);
  const ask = useMemo(() => ({ turns, setTurns, opener, open: setOpener, close, clear }), [turns, opener, close, clear]);
  return <AskContext value={ask}>{children}</AskContext>;
}

/** "Ask the pipeline", in the top bar and on a Deal, which covers the top bar. */
export function AskButton({ labelClassName = "" }: { labelClassName?: string }) {
  const { open, opener } = useAsk();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={opener !== null}
      onClick={(event) => open(event.currentTarget)}
      className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-[14px] font-semibold transition-colors duration-150 hover:border-primary hover:text-primary"
    >
      <Search className="size-4" aria-hidden />
      <span className={labelClassName}>Ask the pipeline</span>
    </button>
  );
}

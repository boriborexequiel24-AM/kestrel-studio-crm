"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles } from "lucide-react";
import { askPipeline } from "@/app/(app)/ai-actions";
import { INPUT_CLASS } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AiActionsLeft, ChatMessage } from "@/lib/crm";
import { ActionsLeft } from "./actions-left";
import { useAsk, type Turn } from "./ask-context";

const SUGGESTIONS = [
  "Which Deals are stuck in Proposal sent?",
  "What renews next month?",
  "Why are we losing Deals?",
  "Which of my Next steps are overdue?",
];
const MAX_QUESTION = 500;
// Enough for a follow-up question to make sense.
const TURNS_SENT = 4;

/** The Ask the pipeline Sheet. Any AskButton opens it. */
export function AskPanel({ sandboxId, actions }: { sandboxId: string; actions: AiActionsLeft }) {
  const { turns, setTurns, opener, close, clear } = useAsk();
  const open = opener !== null;
  const [question, setQuestion] = useState("");
  // Not a transition: while one waits for an answer, navigation would wait too.
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastOpener = useRef<HTMLElement>(null);
  const inputId = useId();
  const spent = actions.left === 0;

  useEffect(() => {
    if (opener) lastOpener.current = opener;
  }, [opener]);

  // The frame can outlive a Sandbox that ran out; a new one starts with no chat.
  const chatOf = useRef(sandboxId);
  useEffect(() => {
    if (chatOf.current !== sandboxId) clear();
    chatOf.current = sandboxId;
  }, [sandboxId, clear]);

  // Returns nothing: newer browsers give a promise from scrollIntoView, which isn't an effect's clean-up.
  function showLatest() {
    end.current?.scrollIntoView({ block: "end" });
  }
  useEffect(() => showLatest(), [turns]);

  async function ask(text: string) {
    const asked = text.trim();
    if (!asked || pending || spent) return;
    const turn: Turn = { id: (turns.at(-1)?.id ?? 0) + 1, question: asked };
    const messages = [...toMessages(turns), { role: "user" as const, content: asked }];
    setTurns((current) => [...current, turn]);
    setQuestion("");
    setPending(true);
    input.current?.focus();
    const report = await askPipeline(messages).catch(() => ({ ok: false as const, message: "That didn't get through. Try again." }));
    const done: Turn = report.ok ? { ...turn, answer: report.answer } : { ...turn, problem: report.message };
    setPending(false);
    setTurns((current) => current.map((each) => (each.id === turn.id ? done : each)));
  }

  function clearChat() {
    clear();
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(question);
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        side="left"
        className="gap-0 p-0 duration-200 desk:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
          showLatest();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          lastOpener.current?.focus();
        }}
      >
        <SheetHeader className="shrink-0 border-b border-border bg-card p-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-[22px] leading-tight font-bold">
            <Sparkles className="size-4 shrink-0 text-primary" aria-hidden /> Ask the pipeline
          </SheetTitle>
          <SheetDescription className="text-[14px]">
            Answers from your own records, with links to them. It only reads, and the chat isn&apos;t stored.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div role="log" aria-label="Chat" className="space-y-4">
            {turns.map((turn) => (
              <TurnView key={turn.id} turn={turn} onFollowLink={close} />
            ))}
          </div>
          <div>
            <p id={`${inputId}-ideas`} className="text-[13px] font-semibold text-muted-foreground">
              {turns.length ? "Or ask" : "You could ask"}
            </p>
            <ul aria-labelledby={`${inputId}-ideas`} className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.filter((each) => !turns.some((turn) => turn.question === each)).map((each) => (
                <li key={each}>
                  <button
                    type="button"
                    onClick={() => ask(each)}
                    aria-disabled={pending || spent || undefined}
                    className="min-h-11 rounded-lg border border-border bg-card px-3 py-1.5 text-left text-[13px] transition-colors duration-150 hover:border-primary hover:text-primary aria-disabled:opacity-50"
                  >
                    {each}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div ref={end} />
        </div>

        <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-border bg-card p-4">
          <label htmlFor={inputId} className="text-[13px] font-semibold">
            Your question
          </label>
          <div className="flex gap-2">
            <input
              ref={input}
              id={inputId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={MAX_QUESTION}
              autoComplete="off"
              placeholder="Which Retainers end soon?"
              className={`${INPUT_CLASS} min-w-0 flex-1`}
            />
            {/* Not `disabled`: that would drop keyboard focus. */}
            <Button
              type="submit"
              aria-disabled={pending || spent || undefined}
              className="h-11 rounded-lg px-4 font-semibold hover:bg-primary-hover aria-disabled:opacity-50"
            >
              <Send aria-hidden /> Ask
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ActionsLeft actions={actions} />
            {turns.length > 0 && !pending && (
              <button type="button" onClick={clearChat} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-primary hover:underline">
                Clear chat
              </button>
            )}
          </div>
          {spent && (
            <p role="status" className="text-[13px]">
              You have used all {actions.limit} AI actions for today. Everything else keeps working.
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** The chat so far, as the AI gets it: only turns that were answered, the latest few. */
function toMessages(turns: Turn[]): ChatMessage[] {
  return turns
    .filter((turn) => turn.answer)
    .slice(-TURNS_SENT)
    .flatMap(({ question, answer }) => [
      { role: "user" as const, content: question },
      { role: "assistant" as const, content: answer!.parts.map((part) => (part.type === "text" ? part.text : part.name)).join("") },
    ]);
}

function TurnView({ turn: { question, answer, problem }, onFollowLink }: { turn: Turn; onFollowLink: () => void }) {
  return (
    <div className="space-y-3">
      <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
        <span className="sr-only">You asked: </span>
        {question}
      </p>
      {answer && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="leading-8 whitespace-pre-line">
            {answer.parts.map((part, index) =>
              part.type === "text" ? (
                part.text
              ) : (
                <Link
                  key={index}
                  href={part.type === "deal" ? `/deals/${part.id}` : `/companies/${part.id}`}
                  onClick={onFollowLink}
                  className="relative inline-block font-semibold text-primary underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-1.5 hover:underline"
                >
                  {part.name}
                </Link>
              ),
            )}
          </p>
          {answer.lookedUp.length > 0 && (
            <p className="mt-3 text-[12px] text-muted-foreground">Looked up: {answer.lookedUp.join("; ")}.</p>
          )}
          <p className="mt-1 text-[12px] text-muted-foreground">Written by AI, so check it before you rely on it.</p>
        </div>
      )}
      {problem && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] font-semibold text-destructive">{problem}</p>
      )}
      {!answer && !problem && <p className="text-[13px] text-muted-foreground">Looking things up...</p>}
    </div>
  );
}

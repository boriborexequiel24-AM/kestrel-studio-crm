"use client";

import { useActionState, useEffect, useId, useRef, useState, type RefObject } from "react";
import { Check, Copy, Send, Sparkles } from "lucide-react";
import { draftFollowUp, logDraftAsSent, type DraftState } from "@/app/(app)/ai-actions";
import { INPUT_CLASS } from "@/components/forms/fields";
import { FormError } from "@/components/forms/form-dialog";
import { IDLE, type FormState } from "@/components/forms/form-state";
import { Button } from "@/components/ui/button";
import type { AiActionsLeft, FollowUpDraft } from "@/lib/crm";
import { ActionsLeft } from "./actions-left";

const MAX_INSTRUCTION = 200;

/** Drafts an email for the Deal's Next step, to edit, copy or log. Nothing is ever sent. */
export function FollowUp({ dealId, actions }: { dealId: string; actions: AiActionsLeft }) {
  const [draft, setDraft] = useState<(FollowUpDraft & { at: number }) | null>(null);
  const [logged, setLogged] = useState(false);
  const [instruction, setInstruction] = useState("");
  const instructionId = useId();
  const root = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const done = useRef<HTMLParagraphElement>(null);
  const spent = actions.left === 0;

  const [state, action, pending] = useActionState<DraftState, FormData>(async (_previous, form) => {
    const report = await draftFollowUp(IDLE, form);
    if (report.status === "saved" && report.draft) {
      setDraft({ ...report.draft, at: report.at });
      setLogged(false);
    }
    return report;
  }, IDLE);

  // Keyboard focus follows the work, to the new draft and then to the note that
  // it was logged, unless the visitor has gone somewhere else meanwhile.
  useEffect(() => {
    if (draft && isHere(root.current)) editor.current?.focus();
  }, [draft]);
  useEffect(() => {
    if (logged && isHere(root.current)) done.current?.focus();
  }, [logged]);

  return (
    <div ref={root} className="mt-4 border-t border-border pt-4">
      <form action={action} onSubmit={(event) => (pending || spent) && event.preventDefault()} className="grid grid-cols-1 gap-2">
        <input type="hidden" name="dealId" value={dealId} />
        <label htmlFor={instructionId} className="text-[13px] font-semibold">
          Instruction for the draft <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={instructionId}
            name="instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            maxLength={MAX_INSTRUCTION}
            autoComplete="off"
            placeholder="Mention the case study"
            className={`${INPUT_CLASS} min-w-0 flex-1 basis-52`}
          />
          {/* Not `disabled`: that would drop keyboard focus. */}
          <Button
            type="submit"
            aria-disabled={pending || spent || undefined}
            className="h-11 rounded-lg px-4 font-semibold hover:bg-primary-hover aria-disabled:opacity-50"
          >
            <Sparkles aria-hidden /> {pending ? "Drafting..." : draft ? "Draft again" : "Draft follow-up"}
          </Button>
        </div>
        <ActionsLeft actions={actions} />
        {spent ? (
          <p role="status" className="text-[13px]">You have used all {actions.limit} AI actions for today. Everything else keeps working.</p>
        ) : (
          !logged && <FormError state={state} />
        )}
      </form>
      {draft && (
        <DraftEditor
          key={draft.at}
          dealId={dealId}
          draft={draft}
          editor={editor}
          drafting={pending}
          onLogged={() => {
            setDraft(null);
            setLogged(true);
            setInstruction("");
          }}
        />
      )}
      {logged && (
        <p ref={done} tabIndex={-1} className="mt-3 flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-won-hover">
          <Check className="size-4 shrink-0" aria-hidden /> Logged as an Email Activity. Nothing was sent.
        </p>
      )}
    </div>
  );
}

/**
 * Whether focus is in this part of the page, or was until the control that had
 * it went away: it then falls to something around it, the Sheet or the page.
 */
function isHere(part: HTMLElement | null): boolean {
  const focused = document.activeElement;
  return Boolean(part && focused && (part.contains(focused) || focused.contains(part)));
}

type DraftEditorProps = {
  dealId: string;
  draft: FollowUpDraft;
  editor: RefObject<HTMLTextAreaElement | null>;
  /** Another draft is on its way to replace this one. */
  drafting: boolean;
  onLogged: () => void;
};

function DraftEditor({ dealId, draft, editor, drafting, onLogged }: DraftEditorProps) {
  const [text, setText] = useState(draft.text);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const id = useId();

  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, form) => {
    const report = await logDraftAsSent(previous, form);
    if (report.status === "saved") onLogged();
    return report;
  }, IDLE);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      // The browser may refuse; select it, so copying by hand is one step.
      editor.current?.select();
      setCopied("no");
    }
  }

  return (
    <form action={action} onSubmit={(event) => (pending || drafting) && event.preventDefault()} className="mt-4 grid grid-cols-1 gap-2">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="contactId" value={draft.contact?.id ?? ""} />
      <label htmlFor={id} className="text-[13px] font-semibold">
        Draft{draft.contact && ` to ${draft.contact.name}`}{" "}
        <span className="font-normal text-muted-foreground">(written by AI, so check it first)</span>
      </label>
      <textarea
        ref={editor}
        id={id}
        name="text"
        value={text}
        readOnly={pending || drafting}
        aria-invalid={(state.status === "error" && state.field === "text") || undefined}
        onChange={(event) => {
          setText(event.target.value);
          setCopied(null);
        }}
        rows={10}
        className={`${INPUT_CLASS} h-auto min-h-40 py-2.5 leading-relaxed`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={copy} className="h-11 rounded-lg px-4 font-semibold">
          <Copy aria-hidden /> Copy
        </Button>
        <Button
          type="submit"
          variant="outline"
          aria-disabled={pending || drafting || undefined}
          className="h-11 rounded-lg px-4 font-semibold aria-disabled:opacity-50"
        >
          <Send aria-hidden /> {pending ? "Logging..." : "Log as sent"}
        </Button>
        <p aria-live="polite" className="text-[13px] font-semibold text-muted-foreground">
          {copied === "yes" && "Copied."}
          {copied === "no" && "Press Ctrl+C or Cmd+C to copy."}
        </p>
      </div>
      <FormError state={state} />
      <p className="text-[12px] text-muted-foreground">
        Nothing is sent from here. Log as sent records it as an Email Activity. Draft again replaces this draft.
      </p>
    </form>
  );
}

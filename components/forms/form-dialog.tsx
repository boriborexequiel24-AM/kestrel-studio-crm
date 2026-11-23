"use client";

import { createContext, use, useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IDLE, type FormState } from "./form-state";

export type FormAction = (state: FormState, form: FormData) => Promise<FormState>;

const FormStateContext = createContext<FormState>(IDLE);

/** The current form's last report, so fields can mark themselves invalid. */
export function useFormReport(): FormState {
  return use(FormStateContext);
}

/** Runs `action`, and calls `onSaved` when it reports a save. */
function useDialogAction(action: FormAction, onSaved: () => void) {
  return useActionState<FormState, FormData>(async (state, form) => {
    const report = await action(state, form);
    if (report.status === "saved") onSaved();
    return report;
  }, IDLE);
}

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
}

function FormError({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] font-semibold text-destructive">
      {state.message}
    </p>
  );
}

type FormDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  action: FormAction;
  submitLabel: string;
  /** Hidden ids the action needs, such as the Company being edited. */
  hidden?: Record<string, string>;
  children: ReactNode;
};

/** A dialog with a form. It closes once the action saves; otherwise it shows why not. */
export function FormDialog({ trigger, title, description, ...form }: FormDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-bold">{title}</DialogTitle>
          {description && <DialogDescription className="text-[14px]">{description}</DialogDescription>}
        </DialogHeader>
        <DialogForm {...form} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DialogForm({
  action,
  submitLabel,
  hidden = {},
  children,
  onSaved,
  onCancel,
}: Omit<FormDialogProps, "trigger" | "title" | "description"> & { onSaved: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useDialogAction(action, onSaved);
  return (
    <FormStateContext value={state}>
      <form action={formAction} className="grid gap-4">
        <HiddenFields fields={hidden} />
        {children}
        <FormError state={state} />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-lg px-4" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 rounded-lg px-5 font-semibold hover:bg-primary-hover">
            {pending ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </FormStateContext>
  );
}

type ConfirmDeleteDialogProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  action: FormAction;
  confirmLabel: string;
  hidden: Record<string, string>;
};

/** Asks before a delete, which can't be undone. */
export function ConfirmDeleteDialog({ trigger, title, description, action, confirmLabel, hidden }: ConfirmDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[20px] font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[14px]">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmForm action={action} confirmLabel={confirmLabel} hidden={hidden} onDone={() => setOpen(false)} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmForm({
  action,
  confirmLabel,
  hidden,
  onDone,
}: Pick<ConfirmDeleteDialogProps, "action" | "confirmLabel" | "hidden"> & { onDone: () => void }) {
  const [state, formAction, pending] = useDialogAction(action, onDone);
  return (
    <form action={formAction} className="grid gap-4">
      <HiddenFields fields={hidden} />
      <FormError state={state} />
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel className="h-11 rounded-lg px-4">Cancel</AlertDialogCancel>
        <Button type="submit" variant="destructive" disabled={pending} className="h-11 rounded-lg px-5 font-semibold">
          {pending ? "Deleting..." : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

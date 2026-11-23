"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { useFormReport } from "./form-dialog";

export const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-[14px] transition-colors duration-150 placeholder:text-muted-foreground hover:border-muted-foreground aria-invalid:border-destructive";

/** Whether the form's last report blamed this field, and what was typed into it. */
function useFieldReport(name: string) {
  const report = useFormReport();
  if (report.status !== "error") return { invalid: undefined, submitted: undefined };
  return { invalid: report.field === name || undefined, submitted: report.values[name] };
}

function Field({ label, hint, id, children }: { label: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
        {hint && <span className="font-normal text-muted-foreground"> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}

type TextFieldProps = { label: string; name: string; hint?: string } & Omit<ComponentProps<"input">, "name">;

export function TextField({ label, name, hint, className = "", defaultValue, ...input }: TextFieldProps) {
  const id = useId();
  const { invalid, submitted } = useFieldReport(name);
  return (
    <Field label={label} hint={hint} id={id}>
      <input
        id={id}
        name={name}
        aria-invalid={invalid}
        defaultValue={input.value === undefined ? (submitted ?? defaultValue) : undefined}
        className={`${INPUT_CLASS} ${className}`}
        {...input}
      />
    </Field>
  );
}

type TextAreaFieldProps = { label: string; name: string; hint?: string } & Omit<ComponentProps<"textarea">, "name">;

export function TextAreaField({ label, name, hint, defaultValue, ...textarea }: TextAreaFieldProps) {
  const id = useId();
  const { invalid, submitted } = useFieldReport(name);
  return (
    <Field label={label} hint={hint} id={id}>
      <textarea
        id={id}
        name={name}
        rows={4}
        aria-invalid={invalid}
        defaultValue={submitted ?? defaultValue}
        className={`${INPUT_CLASS} h-auto min-h-24 py-2.5`}
        {...textarea}
      />
    </Field>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  hint?: string;
  options: { value: string; label: string }[];
} & Omit<ComponentProps<"select">, "name">;

export function SelectField({ label, name, hint, options, defaultValue, ...select }: SelectFieldProps) {
  const id = useId();
  const { invalid, submitted } = useFieldReport(name);
  return (
    <Field label={label} hint={hint} id={id}>
      <select
        id={id}
        name={name}
        aria-invalid={invalid}
        defaultValue={submitted ?? defaultValue}
        className={INPUT_CLASS}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

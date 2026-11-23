/**
 * What a form's server action reports back. `at` makes each report distinct.
 * An error carries the submitted values: React resets a form after its action
 * runs, and fields fall back to these so the visitor's typing isn't lost.
 */
export type FormState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; message: string; field?: string; values: Record<string, string>; at: number };

export const IDLE: FormState = { status: "idle" };

import { expect } from "vitest";
import type { Result } from "@/lib/crm";

/** The value of a CRM result that must have succeeded. */
export function expectOk<T, E extends string>(result: Result<T, E>): T {
  if (!result.ok) expect.fail(`Expected ok, got error "${result.error}"`);
  return result.value;
}

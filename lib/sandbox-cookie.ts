import "server-only";
import { cookies } from "next/headers";

// Remembers when the visitor's Sandbox expires, so the landing page can say
// "your Sandbox was reset" a day later, when their sign-in has long expired
// and the cleanup job has removed the Sandbox and its anonymous user.
const NAME = "kestrel_sandbox_expires";
const WEEK_SECONDS = 7 * 24 * 60 * 60;

/** Called after "Open the demo" succeeds. Only an expiry time is stored, nothing personal. */
export async function rememberSandboxExpiry(expiresAt: Date) {
  (await cookies()).set(NAME, expiresAt.toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: WEEK_SECONDS,
    path: "/",
  });
}

/** Whether this browser had a Sandbox that has since run out. */
export async function hadSandboxThatExpired(now = new Date()): Promise<boolean> {
  const value = (await cookies()).get(NAME)?.value;
  if (!value) return false;
  const expiresAt = new Date(value);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt <= now;
}

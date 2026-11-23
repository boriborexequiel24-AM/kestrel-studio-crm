# 04: Start over, expiry and cleanup

**What to build:** The visitor always knows how long their Sandbox lasts and can reset it to fresh sample data. Returning visitors get their own Sandbox back; expired ones are told it was reset. Sandboxes and their anonymous users disappear after 24 hours on their own, and nobody can open unlimited Sandboxes.

**Blocked by:** 02 (Walking skeleton).

**Status:** done

- [x] Every signed-in page shows "Sandbox resets in N hours. Start over" under its title.
- [x] "Start over" asks for confirmation, then replaces the Sandbox's data with a fresh copy of the Template. It keeps the same Sandbox and the same expiry time.
- [x] A returning visitor with a live Sandbox goes straight back in with their changes intact.
- [x] A returning visitor whose Sandbox expired lands on the landing page with a notice that it was reset, and can open a new one.
- [x] An hourly pg_cron job deletes expired Sandboxes, all their rows and their anonymous auth users. Tests call the cleanup function directly with backdated Sandboxes.
- [x] Opening a Sandbox is limited to `DEMO_SANDBOXES_PER_IP_PER_DAY` per salted IP hash, with a clear message when the limit is reached.
- [x] Building, Start over and cleanup handle every Sandbox table that exists. Later tickets that add tables keep these tests passing.

## Comments

**2026-11-24, done.** Every signed-in page shows "Sandbox resets in N hours. Start over"; Start over asks first, then refills the same Sandbox (same expiry). The landing page offers "Back to your Sandbox" to a visitor with a live one, and shows a "your Sandbox was reset" notice to one whose Sandbox expired or was cleaned up. `crm.clean_up_expired_sandboxes()` runs hourly via pg_cron (at minute 7). Opening a Sandbox is limited per salted IP hash over a rolling 24 hours. 63 tests pass.

How "every Sandbox table" stays covered: `crm.sandbox_row_counts(id)` finds every `crm` table with a `sandbox_id` column from the catalog, and the tests compare a Sandbox's counts with the Template's after building and Start over, and expect zero after cleanup. A new table is covered without touching the tests. `crm.start_over()` deletes Companies (which cascades to what hangs off them) and then Teammates; a new table that doesn't hang off a Company needs its own delete there, and the tests will fail until it has one.

Fixed after review: the reset notice now comes from a cookie holding the Sandbox's expiry time, so it also shows to a visitor who returns the next day (their sign-in token expires after an hour, so checking the session alone missed them, and a visitor who hit the daily limit was wrongly told their Sandbox was reset). The limit check takes a lock per network, so two visitors on one network can't both slip under it. The Company not-found page shows the Sandbox line too.

Choices worth a second look:
- A returning visitor with a live Sandbox sees "Back to your Sandbox" on the landing page rather than being sent straight in. Any signed-in link takes them straight back.
- The network limit trusts the app's server to report the visitor's address: the database only ever sees the server. The anon key never reaches browsers here, and direct API callers still face Supabase's own per-IP limit on anonymous sign-ins.
- The row-count tests can only prove a table is handled if it has a `sandbox_id` column and the test puts rows in it. Tables the Template leaves empty (AI summaries, AI usage in ticket 12) need their own Start over and cleanup checks.

Notes for later tickets:
- Ticket 12: Start over must not reset the AI limit. Don't give the AI usage table a cascading link to anything `start_over` deletes.
- Ticket 15: Supabase limits anonymous sign-ins per IP (30 an hour by default). On Vercel every sign-in comes from Vercel's servers, so that limit applies to the whole demo. Raise it in the shared project's Auth rate limits; this app's own per-network limit protects against abuse.
- Ticket 15: the cleanup migration runs `create extension if not exists pg_cron` and schedules the job, so pg_cron must be enabled in the shared project first.
- Anonymous users are tagged `app: kestrel-crm` at sign-in. The cleanup only deletes this app's users, since the Supabase project is shared.


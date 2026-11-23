# 04: Start over, expiry and cleanup

**What to build:** The visitor always knows how long their Sandbox lasts and can reset it to fresh sample data. Returning visitors get their own Sandbox back; expired ones are told it was reset. Sandboxes and their anonymous users disappear after 24 hours on their own, and nobody can open unlimited Sandboxes.

**Blocked by:** 02 (Walking skeleton).

**Status:** ready-for-agent

- [ ] Every signed-in page shows "Sandbox resets in N hours. Start over" under its title.
- [ ] "Start over" asks for confirmation, then replaces the Sandbox's data with a fresh copy of the Template. It keeps the same Sandbox and the same expiry time.
- [ ] A returning visitor with a live Sandbox goes straight back in with their changes intact.
- [ ] A returning visitor whose Sandbox expired lands on the landing page with a notice that it was reset, and can open a new one.
- [ ] An hourly pg_cron job deletes expired Sandboxes, all their rows and their anonymous auth users. Tests call the cleanup function directly with backdated Sandboxes.
- [ ] Opening a Sandbox is limited to `DEMO_SANDBOXES_PER_IP_PER_DAY` per salted IP hash, with a clear message when the limit is reached.
- [ ] Building, Start over and cleanup handle every Sandbox table that exists. Later tickets that add tables keep these tests passing.

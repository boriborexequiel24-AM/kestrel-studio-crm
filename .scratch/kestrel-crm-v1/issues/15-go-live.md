# 15: Go live

**What to build:** Kestrel Studio CRM runs at a public `.vercel.app` address on the shared Supabase project, and a full five-minute tour works there for a stranger. Zeki does the dashboard steps; an agent applies migrations and checks the result. A `/wizard` script fits the human part.

**Blocked by:** 02 to 14 (all feature tickets).

**Status:** ready-for-human

- [ ] In the shared Supabase project: anonymous sign-ins are turned on, `crm` is added to the schemas exposed to the API, and pg_cron is enabled. The `public`, `leads` and `ops` schemas are untouched.
- [ ] The repo's migrations and Template seed are applied to the shared project, and the hourly cleanup job is scheduled there.
- [ ] A Vercel project is created and its environment variables are set from `.env.example`'s names, with `AI_PROVIDER` set to OpenAI.
- [ ] On the live address, a fresh browser can open the demo and run the tour: Home, Pipeline, open a Deal, send a Proposal, win it, see the Retainer, Summarize, Draft follow-up, Ask the pipeline, Start over.
- [ ] Two browsers on the live address can't see each other's changes.
- [ ] After a few real AI actions, the usage table shows cost per action, and `DEMO_DAILY_AI_ACTION_CAP` is set from it.
- [ ] `CLAUDE.md` records the live address and the deploy steps.

## Comments

**2026-11-24, from ticket 04.** Two settings for the shared Supabase project: (1) raise the anonymous sign-in rate limit (Auth rate limits, 30 per hour per IP by default), because every sign-in comes from Vercel's servers, so the default would cap the whole demo at about 30 new visitors an hour; this app limits Sandboxes per visitor network itself. (2) Enable pg_cron before applying migrations; the cleanup migration schedules `crm-clean-up-expired-sandboxes` hourly.

**2026-11-24, prepared, nothing live yet.** `supabase/live/preflight.sql` (read-only checks of the shared project), `npm run live:sql` (writes `setup.sql`: all migrations and the Template in one transaction, undone if anything outside `crm` would change), `verify.sql`, `cost.sql` and `npm run live:check` (25 checks from the outside with the public key). All rehearsed on the local stack, including planted problems. The other demos' migrations treat `anon` and `authenticated` the same, so anonymous sign-ins give visitors nothing new there; preflight confirms it on the real project. The app needs no service key, so it doesn't go on Vercel.

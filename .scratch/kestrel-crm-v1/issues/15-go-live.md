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

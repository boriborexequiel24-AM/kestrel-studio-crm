# 12: AI module, limits and Company summary

**What to build:** Maya clicks "Summarize" on a Company page and gets the relationship's story in three lines, saved until a new Activity arrives. Behind it sits the AI module (OpenAI or a fake), the usage table, and the per-Sandbox and demo-wide limits, so the public demo can't drain Zeki's credits. This is the tracer bullet for all AI features.

**Blocked by:** 03 (Companies, Contacts and Activities), 04 (Start over, expiry and cleanup).

**Status:** ready-for-agent

- [ ] The AI module has a small provider interface with an OpenAI adapter (plain HTTP to the Responses API, model from `OPENAI_MODEL`, default `gpt-5.4-mini`, low reasoning effort) and a fake adapter. `AI_PROVIDER` picks one. Tests only ever use the fake.
- [ ] Each visitor request is one AI action. The limit check and a usage row (Sandbox, feature, time) are written atomically before the provider is called, then completed with input and output tokens and cost.
- [ ] Per-Sandbox limit `DEMO_AI_ACTIONS_PER_SANDBOX_PER_DAY` (30) and demo-wide limit `DEMO_DAILY_AI_ACTION_CAP` per UTC day. Going over returns the typed limit results, shown as friendly messages while the rest of the app keeps working.
- [ ] Required AI limit tests: the 31st action for a Sandbox is refused; Start over doesn't reset the count; the demo-wide limit refuses across Sandboxes; every action writes exactly one usage row.
- [ ] The Company page has a Summary card (light blue tint, sparkle icon) with a "Summarize" button that returns three bullet lines from the Company's Activities and Deals.
- [ ] A summary is saved per Company and marked "Cached until new Activity". A newer Activity for that Company marks it out of date and offers a refresh. Showing a saved summary costs no AI action.
- [ ] AI features show "N of 30 AI actions left today".
- [ ] Usage rows and summaries are covered by the isolation test.

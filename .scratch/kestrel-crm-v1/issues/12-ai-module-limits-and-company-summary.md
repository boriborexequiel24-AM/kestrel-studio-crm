# 12: AI module, limits and Company summary

**What to build:** Maya clicks "Summarize" on a Company page and gets the relationship's story in three lines, saved until a new Activity arrives. Behind it sits the AI module (OpenAI or a fake), the usage table, and the per-Sandbox and demo-wide limits, so the public demo can't drain Zeki's credits. This is the tracer bullet for all AI features.

**Blocked by:** 03 (Companies, Contacts and Activities), 04 (Start over, expiry and cleanup).

**Status:** done

- [x] The AI module has a small provider interface with an OpenAI adapter (plain HTTP to the Responses API, model from `OPENAI_MODEL`, default `gpt-5.4-mini`, low reasoning effort) and a fake adapter. `AI_PROVIDER` picks one. Tests only ever use the fake.
- [x] Each visitor request is one AI action. The limit check and a usage row (Sandbox, feature, time) are written atomically before the provider is called, then completed with input and output tokens and cost.
- [x] Per-Sandbox limit `DEMO_AI_ACTIONS_PER_SANDBOX_PER_DAY` (30) and demo-wide limit `DEMO_DAILY_AI_ACTION_CAP` per UTC day. Going over returns the typed limit results, shown as friendly messages while the rest of the app keeps working.
- [x] Required AI limit tests: the 31st action for a Sandbox is refused; Start over doesn't reset the count; the demo-wide limit refuses across Sandboxes; every action writes exactly one usage row.
- [x] The Company page has a Summary card (light blue tint, sparkle icon) with a "Summarize" button that returns three bullet lines from the Company's Activities and Deals.
- [x] A summary is saved per Company and marked "Cached until new Activity". A newer Activity for that Company marks it out of date and offers a refresh. Showing a saved summary costs no AI action.
- [x] AI features show "N of 30 AI actions left today".
- [x] Usage rows and summaries are covered by the isolation test.

## Comments

**2026-11-24, done.** A Company page and a Deal's Sheet have a Summary card: three lines from the Company's Activities, Deals and Retainers, saved until its Activities change. Every AI action is logged and checked against both limits before the provider is called. 223 tests pass, the required limit tests fail when their rule is removed, and the isolation cases fail when the new policies are loosened. The OpenAI adapter was checked against a local stub only: **no real OpenAI call has been made yet**.

Fixed after review: a summary could be called current without covering an Activity logged while the Company was being read; cut-off answers were saved; nothing capped the whole prompt; an emoji at a cut or a control character broke a paid answer; a failed usage log threw away a paid answer; two cards in the page at once shared an id; each test run ate into the local app's daily limit.

Notes for later tickets:
- Ticket 13: widen `act`'s `"summary"` to the new feature.
- Ticket 14: one message can need several provider calls. `act` makes one call and logs it once, so give it a function that may call the provider several times and sum the usage. Cut-off answers come back with `complete: false`, and tool arguments that aren't JSON as null.
- Ticket 15: set `AI_PROVIDER=openai`, try one real summary, and read its cost in `crm.ai_usage` before settling `DEMO_DAILY_AI_ACTION_CAP`. Reasoning effort is always sent, so a model without reasoning may refuse it. At the worst case (a full prompt and 800 tokens out) an action costs roughly 1 to 3 cents on gpt-5.4-mini.
- Accepted risk: someone with the anon key (server-only here) could fill the demo-wide limit without spending credits, or log a wrong cost, up to $5, for their own actions.

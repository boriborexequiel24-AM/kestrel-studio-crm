# 14: Ask the pipeline

**What to build:** From any screen Maya opens "Ask the pipeline" and asks things like "Which Deals are stuck in Proposal sent?", "What renews next month?" or "Why are we losing Deals?". The model answers by calling fixed, read-only lookups on her own Sandbox, links to the records it mentions and says what it looked up. Nothing is stored and nothing is changed.

**Blocked by:** 12 (AI module, limits and Company summary), 08 (Renewals), 09 (Lost and closed Deals).

**Status:** done

- [x] The top-bar button opens a left-hand Sheet: question as a blue bubble, answer in a card, suggested questions, and a labelled input at the bottom.
- [x] The model can call only these read-only lookups, each running through the visitor's RLS-scoped session: find Deals (by Stage, Owner, kind, overdue), Retainers ending within N days, a Company's recent Activities, Lost Deals with reasons over a period, and pipeline totals by Stage.
- [x] Answers link the Companies and Deals they mention, and a "Looked up: ..." note lists the lookups that ran.
- [x] Each message is one AI action, however many lookups it triggers, and respects both limits.
- [x] The chat lives only in the browser tab and is sent with each message. Reloading starts fresh. Nothing is written except the usage row.
- [x] Tests drive the lookups with scripted tool calls from the fake provider and show that every lookup returns only the visitor's own records.

## Comments

**2026-11-24, done.** "Ask the pipeline" in the top bar, and on a Deal, opens a chat on the left. The AI answers from five read-only lookups, names Deals and Companies as links, and says what it looked up. One question is one AI action. 298 tests pass; the lookups are shown to return only the visitor's own records. Checked in the browser with the fake provider at 1440 and 375px, over a Deal too. **No real OpenAI call has been made:** the request format for tool calls was checked against a local stub.

Fixed after review: an unfiltered list dropped one of the 26 sample Deals; waiting for an answer froze navigation; an answer could be given after the Sandbox ran out; Ask couldn't be opened over a Deal; a Renewal could be linked under the wrong name; "stuck in Proposal sent" had no date to judge by; short names written another way weren't linked; a database error looked like the AI's fault. Found in the browser: scrolling to the latest answer crashed the page in newer browsers.

Notes for ticket 15:
- Try the three example questions against real OpenAI and read their cost in `crm.ai_usage`: a question costs several times a summary.
- Tool calls are sent back without the model's reasoning (`store: false`). That should be accepted, but only a real call will tell.
- With `AI_PROVIDER=fake` and nothing scripted, the fake looks up open Deals once and links the first, so the panel can be seen working locally.

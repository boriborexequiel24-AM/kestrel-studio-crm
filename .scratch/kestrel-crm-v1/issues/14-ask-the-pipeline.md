# 14: Ask the pipeline

**What to build:** From any screen Maya opens "Ask the pipeline" and asks things like "Which Deals are stuck in Proposal sent?", "What renews next month?" or "Why are we losing Deals?". The model answers by calling fixed, read-only lookups on her own Sandbox, links to the records it mentions and says what it looked up. Nothing is stored and nothing is changed.

**Blocked by:** 12 (AI module, limits and Company summary), 08 (Renewals), 09 (Lost and closed Deals).

**Status:** ready-for-agent

- [ ] The top-bar button opens a left-hand Sheet: question as a blue bubble, answer in a card, suggested questions, and a labelled input at the bottom.
- [ ] The model can call only these read-only lookups, each running through the visitor's RLS-scoped session: find Deals (by Stage, Owner, kind, overdue), Retainers ending within N days, a Company's recent Activities, Lost Deals with reasons over a period, and pipeline totals by Stage.
- [ ] Answers link the Companies and Deals they mention, and a "Looked up: ..." note lists the lookups that ran.
- [ ] Each message is one AI action, however many lookups it triggers, and respects both limits.
- [ ] The chat lives only in the browser tab and is sent with each message. Reloading starts fresh. Nothing is written except the usage row.
- [ ] Tests drive the lookups with scripted tool calls from the fake provider and show that every lookup returns only the visitor's own records.

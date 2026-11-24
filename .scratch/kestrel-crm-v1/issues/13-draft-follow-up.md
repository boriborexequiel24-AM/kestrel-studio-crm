# 13: Draft follow-up

**What to build:** On a Deal, Maya clicks "Draft follow-up" (optionally with a one-line instruction) and gets an editable email for the Next step. She can copy it or "Log as sent", which records it as an Email Activity. Nothing ever really sends.

**Blocked by:** 12 (AI module, limits and Company summary), 05 (Pipeline board and Deal panel).

**Status:** done

- [x] The Next step card on the Deal Sheet has a labelled "Instruction for the draft (optional)" field and a "Draft follow-up" button.
- [x] The draft is built from the Deal's Stage, last few Activities, Next step, main Contact and the optional instruction, and counts as one AI action.
- [x] The draft opens as an editable text area with Copy, Log as sent, and "N of 30 AI actions left today".
- [x] "Log as sent" creates an Email Activity authored by the Persona with the edited text, which then appears in the Deal's and Company's Activity lists (and marks the Company summary out of date).
- [x] No email or message leaves the app.
- [x] Limit messages from ticket 12 show here too.

## Comments

**2026-11-24, done.** The Next step card on an open Deal has an optional instruction and "Draft follow-up", which writes an email to edit. Copy puts it on the clipboard; Log as sent records it as an Email by Maya on the Deal and its Company. 249 tests pass. Checked in the browser with the fake provider, at 1440 and 375px; the built-in browser refuses clipboard access, so only Copy's fallback was seen there.

Fixed after review: a huge instruction could hold up the server for seconds before any limit was checked; a new draft could be lost by logging the old one while it was being written; a declined Proposal was described as never sent; changing the Deal's Company or deleting the Contact made a draft impossible to log; a logged email lost its line breaks on the Deal; closed Deals offered a follow-up in some cases and not others.

Notes for later tickets:
- Ticket 14: `lib/crm/prompts.ts` has the shared limits and tidying (`cut`, `plain`). Cut a visitor's text before tidying it.
- Activity text has no length limit of its own (a direct call can store 900,000 characters), older than this ticket.

# 13: Draft follow-up

**What to build:** On a Deal, Maya clicks "Draft follow-up" (optionally with a one-line instruction) and gets an editable email for the Next step. She can copy it or "Log as sent", which records it as an Email Activity. Nothing ever really sends.

**Blocked by:** 12 (AI module, limits and Company summary), 05 (Pipeline board and Deal panel).

**Status:** ready-for-agent

- [ ] The Next step card on the Deal Sheet has a labelled "Instruction for the draft (optional)" field and a "Draft follow-up" button.
- [ ] The draft is built from the Deal's Stage, last few Activities, Next step, main Contact and the optional instruction, and counts as one AI action.
- [ ] The draft opens as an editable text area with Copy, Log as sent, and "N of 30 AI actions left today".
- [ ] "Log as sent" creates an Email Activity authored by the Persona with the edited text, which then appears in the Deal's and Company's Activity lists (and marks the Company summary out of date).
- [ ] No email or message leaves the app.
- [ ] Limit messages from ticket 12 show here too.

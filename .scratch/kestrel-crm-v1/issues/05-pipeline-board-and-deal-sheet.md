# 05: Pipeline board and Deal panel

**What to build:** Maya opens the Pipeline and sees the whole agency's open Deals in an Owner x Stage grid under a KPI strip. She clicks a card and the Deal opens beside the board with its own link, where she can see its context, set its Next step and move it between the open Stages. She can create, edit and delete Deals. This is the heart of the tour, built to the Variant H look from the prototype branch.

**Blocked by:** 03 (Companies, Contacts and Activities).

**Status:** ready-for-agent

- [ ] The Template holds about 25 open Deals spread across the open Stages and Owners (New business only for now), with Next steps, some overdue, dates relative to the anchor.
- [ ] The Pipeline shows the KPI strip with Open pipeline (Monthly value of open Deals) and Overdue Next steps (marked when above zero). The other two KPI cards arrive in tickets 06 and 07.
- [ ] The Owner x Stage grid is a real table with a caption: rows for the Persona and Teammates (initials, open Monthly value, Maya's row stands out), columns for the five open Stages (color bar, name, count, total).
- [ ] Each Deal card is a link of at least 44px showing the Company, short Monthly value, Deal title, the Next step text on one line, and the due label ("Due tomorrow", or red "Overdue" with the word, never color alone).
- [ ] A Mine / Everyone toggle filters the grid.
- [ ] Clicking a card opens the Deal in a right-hand Sheet over the Pipeline at the Deal's own route; back and close return to the Pipeline. The selected card shows a blue border and tint.
- [ ] The Deal Sheet shows the sticky header (Company, Client or Prospect, Deal title, Stage dropdown, Monthly value "a month, estimated"), the Stage stepper, the Next step card, a People card and the Activity list with "Log an Activity".
- [ ] Maya can change Stage among the open Stages from the Stage dropdown or the card's "Move to..." menu. There is no drag.
- [ ] Maya can create, edit and delete Deals (Company, Owner, title, estimated Monthly value, Next step and due date).
- [ ] Deals are covered by the isolation test.

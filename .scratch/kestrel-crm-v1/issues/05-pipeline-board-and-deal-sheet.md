# 05: Pipeline board and Deal panel

**What to build:** Maya opens the Pipeline and sees the whole agency's open Deals in an Owner x Stage grid under a KPI strip. She clicks a card and the Deal opens beside the board with its own link, where she can see its context, set its Next step and move it between the open Stages. She can create, edit and delete Deals. This is the heart of the tour, built to the Variant H look from the prototype branch.

**Blocked by:** 03 (Companies, Contacts and Activities).

**Status:** done

- [x] The Template holds about 25 open Deals spread across the open Stages and Owners (New business only for now), with Next steps, some overdue, dates relative to the anchor.
- [x] The Pipeline shows the KPI strip with Open pipeline (Monthly value of open Deals) and Overdue Next steps (marked when above zero). The other two KPI cards arrive in tickets 06 and 07.
- [x] The Owner x Stage grid is a real table with a caption: rows for the Persona and Teammates (initials, open Monthly value, Maya's row stands out), columns for the five open Stages (color bar, name, count, total).
- [x] Each Deal card is a link of at least 44px showing the Company, short Monthly value, Deal title, the Next step text on one line, and the due label ("Due tomorrow", or red "Overdue" with the word, never color alone).
- [x] A Mine / Everyone toggle filters the grid.
- [x] Clicking a card opens the Deal in a right-hand Sheet over the Pipeline at the Deal's own route; back and close return to the Pipeline. The selected card shows a blue border and tint.
- [x] The Deal Sheet shows the sticky header (Company, Client or Prospect, Deal title, Stage dropdown, Monthly value "a month, estimated"), the Stage stepper, the Next step card, a People card and the Activity list with "Log an Activity".
- [x] Maya can change Stage among the open Stages from the Stage dropdown or the card's "Move to..." menu. There is no drag.
- [x] Maya can create, edit and delete Deals (Company, Owner, title, estimated Monthly value, Next step and due date).
- [x] Deals are covered by the isolation test.

## Comments

**2026-11-24, done.** The Pipeline shows the KPI strip (Open pipeline, Overdue Next steps), the Owner x Stage grid with Maya's row marked "You", and Deal cards with the Next step and due label. Mine / Everyone filters it. A card opens the Deal at `/deals/[id]` in a right-hand Sheet over the board; closing goes back to the Pipeline. The Sheet has the header (Stage dropdown, Monthly value "a month, estimated", Edit, Delete), the Stage stepper, the Next step card, People and the Deal's Activities with "Log an Activity". Cards have a "Move to..." menu. The Template has 21 open Deals (ticket 08's 5 Renewals bring it to about 25); the Prospects' Activities are linked to their Deal. 81 tests pass, including Deals in the isolation test.

How "Overdue" works: Next step due dates are calendar days. The browser stores its time zone in a `tz` cookie, the server works out the visitor's today from it, and the CRM module compares due dates with that day (tests pass a fixed day).

Fixed after review: changing a Deal's Company failed with a misleading message whenever the Deal had Activities (most sample Deals do). Now the rule is explicit and tested: once a Deal has Activities its Company is fixed, and the edit form shows it read-only with the reason. Also: the Sheet slides in over 200ms (it was 500ms), creating or deleting a Deal and switching Mine / Everyone keep the filter and the open Deal, and a failed "Move to..." shows why.

Left as is: the Stage dropdown is a native select, so it shows one color dot beside it rather than a dot per option.

Notes for later tickets:
- Ticket 06: Monthly value is the estimate for now (`DealCard.monthlyValue`); switch it to the Sent Proposal's total, change the label to "a month, Proposal vN", and add the Proposals out KPI card. The Proposal card goes in the Deal Sheet between Next step and People.
- Tickets 07 and 09: the Stage dropdown lists Won and Lost as disabled, with "(needs a Sent Proposal)" and "(needs a Lost reason)". `deals.moveToStage` returns `stage_not_available` for them.
- Ticket 08: cards already prefix "Renewal:" for Renewal Deals.
- Story 54 says the Company page shows its Deals. It doesn't yet: its Activities link to their Deal, but there is no Deals card. Worth adding with ticket 07's Retainers card.
- Fixed 2026-11-24, after this ticket: sample due dates used the UTC day, so in Manila before 8am "Due tomorrow" read "Due today" and Deals due today read as overdue. Building and Start over now take the visitor's own day.
- The spec's ~300 Activities: the Template still has 125 (65 now linked to Deals).


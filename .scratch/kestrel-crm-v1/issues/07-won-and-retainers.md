# 07: Won and Retainers

**What to build:** Maya wins a Deal: she moves it to Won, confirms, and the Proposal is accepted and a Retainer starts, all at once. Companies with an active Retainer show as Clients. The Retainers screen lists the agency's recurring work, flags what ends soon, and lets her correct an end date.

**Blocked by:** 06 (Proposals).

**Status:** done

- [x] Won is disabled in the Stage dropdown and "Move to..." menu, with "needs a Sent Proposal", until the Deal has a Sent Proposal. The CRM module returns the typed "Won needs a Sent Proposal" result if called anyway.
- [x] Moving to Won asks "Mark Proposal accepted and start the Retainer?". Confirming accepts the Proposal, moves the Deal to Won and creates a Retainer (Company, Deal, Owner, monthly fee, start and end dates from the term) in one database transaction.
- [x] The Template holds about 15 active Retainers, linked to Won Deals, with end dates spread so several end within 60 days.
- [x] A Company is shown as a Client when it has an active Retainer and as a Prospect otherwise, everywhere it appears. The Companies list's Client or Prospect filter now works.
- [x] The Retainers screen lists Retainers by end date with Company, monthly fee, end date and Owner, flagging ones ending within 60 days with a word or icon as well as color.
- [x] Maya can edit a Retainer's end date. Retainers can't be created any other way than winning a Deal.
- [x] The Company page shows its Deals and Retainers.
- [x] The KPI strip adds Won this month.
- [x] Retainers are covered by the isolation test.

## Comments

**2026-11-24, done.** Winning a Deal from the Stage dropdown or the "Move to..." menu asks first, then accepts the Proposal, moves the Deal to Won and starts the Retainer in one database function. The Retainers screen lists them by end date with "Ends soon" flagged, and the end date can be corrected there or on the Company page, which now shows Deals and Retainers. Client and Prospect follow active Retainers everywhere. The KPI strip has Won this month. The Template has 15 Retainers on 12 Clients, 5 ending within 60 days. 140 tests pass, and the isolation cases fail when the new policy is loosened.

Fixed after review: sample end dates drifted from their Proposal terms; Won this month was empty early in a month; two sample Activities contradicted the wins and no Won Deal had any; a direct API call could change or delete an Accepted Proposal, or change the day a Deal was Won; a confirm left open in another tab could accept a different Proposal; keyboard focus was lost after winning from a card.

Notes for later tickets:
- Ticket 08: `crm.win_deal` ignores the Deal's kind and always starts a Retainer; a Renewal should extend one instead. The 5 Retainers ending soon come from Deals 104, 105, 106, 110 and 111. `retainers.deal_id` is unique per Deal. A link from Deals to Retainers may make the embeds in `RETAINER_COLUMNS` and `COMPANY_COLUMNS` ambiguous, so name the foreign key.
- Ticket 09: `closed_on` is ready for Lost (a check ties it to Won and Lost). A visitor calling the API directly can still set Lost without a reason; guard it there.
- A Won Deal's Owner can still be edited; its Retainer keeps the Owner it was won with.
- Sample text that named real dates or seasons was rewritten afterwards; `tests/sample-text.test.ts` keeps it timeless.

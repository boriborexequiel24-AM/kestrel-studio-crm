# 09: Lost and closed Deals

**What to build:** Maya marks a Deal Lost and has to say why. Lost Deals show their reason, and an Open / Closed switch on the Pipeline shows Won and Lost Deals in a simple table, so the board itself stays about live work.

**Blocked by:** 05 (Pipeline board and Deal panel).

**Status:** done

- [x] Moving a Deal to Lost (dropdown or "Move to...") asks for a Lost reason: Price, Timing, Chose another agency, Went in-house, No response or Other. The CRM module returns the typed "Lost reason required" result without one.
- [x] A Lost Deal's Sheet shows its Lost reason in a red-tinted banner with the words, not color alone.
- [x] Won and Lost Deals never appear on the grid.
- [x] An Open / Closed switch beside Mine / Everyone shows Closed Deals in a table (Company, Deal, Owner, Stage, Monthly value, Lost reason, closed date). Each row opens the Deal Sheet.
- [x] The Template includes some Lost Deals with a spread of Lost reasons and some Won Deals, dated over recent months.

## Comments

**2026-11-24, done.** Moving a Deal to Lost, from the Stage dropdown or "Move to...", asks for a Lost reason; the module and the database both refuse it without one. A Lost Deal's Sheet has a red-tinted banner with the reason, and picking an open Stage reopens it after a confirm. The Pipeline has an Open / Closed switch beside Mine / Everyone, and each row of the Closed table opens its Deal. The Template has 9 Lost Deals with every reason, and its 15 Won Deals are spread more evenly. 179 tests pass.

Fixed after review: sample Activities drifted past the day a Deal was Lost, depending on the hour a Sandbox was built (checked for all 24 hours and 3 visitor days); a Lost Renewal could be won while another was open for the same Retainer; a stale tab could rewrite a Lost reason and its day; one arrow key could reopen a Lost Deal; three sample Deals' estimates disagreed with their Declined Proposals.

Notes for later tickets:
- Ticket 10 (phones): the Closed table scrolls sideways on a phone, like the Companies table.
- Ticket 14: `pipeline.closed` has what the Lost lookup needs (`lostReason`, `closedOn`).
- Proposals can still be drafted and sent on a Lost Deal.
- Still open from ticket 08's review: two Start overs at the same moment can make one fail.

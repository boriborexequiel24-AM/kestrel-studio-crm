# 08: Renewals

**What to build:** Some open Deals are Renewals of existing Retainers. Maya can tell them apart on the board, and winning one extends the same Retainer instead of creating a second one.

**Blocked by:** 07 (Won and Retainers).

**Status:** done

- [x] A Deal has a kind, New business or Renewal. A Renewal belongs to the Retainer it renews.
- [x] The Template includes 5 open Renewal Deals for Retainers ending soon.
- [x] Renewal cards show a "Renewal · " prefix, and the Deal Sheet header shows New business or Renewal.
- [x] Maya can create a Renewal Deal from a Retainer.
- [x] Winning a Renewal (same Won rules and confirmation) updates the existing Retainer's end date and monthly fee from the Proposal and logs an Activity, in one transaction. No second Retainer is created.

## Comments

**2026-11-24, done.** A Renewal is a Deal that names the Retainer it renews. Maya starts one from the Retainers screen or the Company page; cards read "Renewal · " and the Deal Sheet shows the Retainer. Winning one extends that Retainer by the Proposal's term, at its fee, and logs a Note by Maya, in the same database function as other wins. The Template has 5, one for each Retainer ending soon and one in each open Stage (26 open Deals in all). 157 tests pass.

Fixed after review: an end date edit opened before a win could undo the extension; a far-off end date broke renewing; Ended Retainers offered a Renewal, against the glossary; two sample Proposals said "another year" of 9-month Retainers; the Deal Sheet sent the whole Deal to its Delete button; one test passed whether or not the rule it covered was there.

Notes for later tickets:
- Ticket 09: moving a Lost Renewal back to an open Stage while another is open for the same Retainer breaks the `deals_one_open_renewal` index. Map it to `renewal_already_open` in `moveToStage`.
- Ticket 10 or 14: `Retainer.openRenewal` gives each Retainer's open Renewal.
- Found in review, older than this ticket: two Start overs at the same moment can make one fail with a database error (the delete and rebuild aren't locked).

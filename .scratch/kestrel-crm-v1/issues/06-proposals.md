# 06: Proposals

**What to build:** Maya drafts a Proposal for a Deal with line items and a term, sends it, and sees the Deal's Monthly value switch to the real offer. If the Company declines, the Deal stays open so she can send a revised version.

**Blocked by:** 05 (Pipeline board and Deal panel).

**Status:** done

- [x] Maya can create a Draft Proposal on a Deal with a scope summary, line items (service and monthly fee) and a term in months. The monthly total comes from the line items.
- [x] Maya can mark a Proposal Sent or Declined. Proposals keep version numbers, and earlier versions stay visible on the Deal.
- [x] The database allows at most one Sent Proposal per Deal. Trying to send a second returns the typed "another Proposal is already Sent" result, shown in the UI.
- [x] Declining a Proposal leaves the Deal in its Stage.
- [x] The Deal's Monthly value reads "a month, Proposal vN" from the Sent Proposal's total, and "a month, estimated" otherwise. The board's totals use the same rule.
- [x] The Deal Sheet shows the Proposal card (total, version, status, term, line items) beside the People card.
- [x] The KPI strip adds Proposals out (Monthly value of Deals with a Sent Proposal).
- [x] The Template includes Proposals for Deals in Proposal sent and Negotiation, including one with an earlier Declined version.
- [x] Proposals and line items are covered by the isolation test.

## Comments

**2026-11-24, done.** A Deal's Sheet has a Proposal card beside People: draft, edit the Draft, mark it Sent or Declined, with earlier versions folded below. The Monthly value and every Pipeline total come from the Sent Proposal, or the estimate when none is Sent. The KPI strip has Proposals out. The Template has a Sent Proposal on all 8 Deals in Proposal sent and Negotiation; Tidebrook's first version was declined and revised. 111 tests pass, and the isolation cases fail when the new policies are loosened.

Fixed after review: the "already Sent" message stayed after the other Proposal was declined; a Deal with a Sent Proposal could be moved to another Company, taking the offer with it; Tidebrook's dates contradicted its Activities; line items had no visible labels and marked every row on an error. Also fixed: a Monthly value too large for the database crashed the form.

Notes for later tickets:
- Ticket 07: `toCard` (lib/crm/deals.ts) and `ProposalCard` treat only Sent as live. Make Accepted count for the Monthly value, keep it unfolded, and don't offer a revised Draft on a Won Deal.
- Ticket 07: replace "Won (coming soon)" in `stage-controls.tsx`.
- Ticket 07: visitors have direct update rights on their own `proposals`, so an API call in their own Sandbox can set any status. Accepting a Proposal should go through one database function.
- Marking a Proposal Sent doesn't move the Deal's Stage; neither the ticket nor the spec asks for it.
- Drafts can be edited but not deleted.

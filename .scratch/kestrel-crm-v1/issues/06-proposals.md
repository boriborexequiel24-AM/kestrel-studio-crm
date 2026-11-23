# 06: Proposals

**What to build:** Maya drafts a Proposal for a Deal with line items and a term, sends it, and sees the Deal's Monthly value switch to the real offer. If the Company declines, the Deal stays open so she can send a revised version.

**Blocked by:** 05 (Pipeline board and Deal panel).

**Status:** ready-for-agent

- [ ] Maya can create a Draft Proposal on a Deal with a scope summary, line items (service and monthly fee) and a term in months. The monthly total comes from the line items.
- [ ] Maya can mark a Proposal Sent or Declined. Proposals keep version numbers, and earlier versions stay visible on the Deal.
- [ ] The database allows at most one Sent Proposal per Deal. Trying to send a second returns the typed "another Proposal is already Sent" result, shown in the UI.
- [ ] Declining a Proposal leaves the Deal in its Stage.
- [ ] The Deal's Monthly value reads "a month, Proposal vN" from the Sent Proposal's total, and "a month, estimated" otherwise. The board's totals use the same rule.
- [ ] The Deal Sheet shows the Proposal card (total, version, status, term, line items) beside the People card.
- [ ] The KPI strip adds Proposals out (Monthly value of Deals with a Sent Proposal).
- [ ] The Template includes Proposals for Deals in Proposal sent and Negotiation, including one with an earlier Declined version.
- [ ] Proposals and line items are covered by the isolation test.

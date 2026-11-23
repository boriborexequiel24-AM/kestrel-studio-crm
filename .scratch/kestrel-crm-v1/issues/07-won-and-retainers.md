# 07: Won and Retainers

**What to build:** Maya wins a Deal: she moves it to Won, confirms, and the Proposal is accepted and a Retainer starts, all at once. Companies with an active Retainer show as Clients. The Retainers screen lists the agency's recurring work, flags what ends soon, and lets her correct an end date.

**Blocked by:** 06 (Proposals).

**Status:** ready-for-agent

- [ ] Won is disabled in the Stage dropdown and "Move to..." menu, with "needs a Sent Proposal", until the Deal has a Sent Proposal. The CRM module returns the typed "Won needs a Sent Proposal" result if called anyway.
- [ ] Moving to Won asks "Mark Proposal accepted and start the Retainer?". Confirming accepts the Proposal, moves the Deal to Won and creates a Retainer (Company, Deal, Owner, monthly fee, start and end dates from the term) in one database transaction.
- [ ] The Template holds about 15 active Retainers, linked to Won Deals, with end dates spread so several end within 60 days.
- [ ] A Company is shown as a Client when it has an active Retainer and as a Prospect otherwise, everywhere it appears. The Companies list's Client or Prospect filter now works.
- [ ] The Retainers screen lists Retainers by end date with Company, monthly fee, end date and Owner, flagging ones ending within 60 days with a word or icon as well as color.
- [ ] Maya can edit a Retainer's end date. Retainers can't be created any other way than winning a Deal.
- [ ] The Company page shows its Deals and Retainers.
- [ ] The KPI strip adds Won this month.
- [ ] Retainers are covered by the isolation test.

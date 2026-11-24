# 11: Home

**What to build:** After "Open the demo", Maya lands on Home: her Deals that need attention, her Retainers ending soon, and the agency's pipeline value by Stage. An Everyone toggle shows the whole team's attention list.

**Blocked by:** 07 (Won and Retainers).

**Status:** done

- [x] "Open the demo" and the Home nav item land on Home instead of the Companies list.
- [x] Home lists Maya's open Deals whose Next step is overdue or missing, each linking to its Deal.
- [x] Home lists Maya's Retainers ending within 60 days, each linking to the Retainers screen or its Company.
- [x] Home shows the agency-wide Monthly value of open Deals by Stage, with Stage names and colors.
- [x] An Everyone toggle switches the two lists to the whole team. The pipeline value stays agency-wide either way.
- [x] Home uses Variant H's tokens, cards and type, and has the Sandbox line under its title.

## Comments

**2026-11-24, done.** Home lists Maya's Deals that need attention and her Retainers ending soon, beside the agency's open pipeline by Stage. Everyone switches the two lists to the whole team. "Open the demo" and Start over land here. 189 tests pass, and the page was checked at 1440 and 375px.

Fixed after review: the empty messages read as agency-wide while showing only Maya's; two tests passed with their rule removed.

Notes:
- The spec's line giving the pipeline value a Mine view disagreed with story 18 and this ticket, so it now says agency-wide.
- The Stage colors come from the spec. Proposal sent and Negotiation (amber and orange) are hard to tell apart, for color-blind people above all, so every bar is named and valued and color only helps.
- `components/app/coming-soon.tsx` has no users left and can be deleted.

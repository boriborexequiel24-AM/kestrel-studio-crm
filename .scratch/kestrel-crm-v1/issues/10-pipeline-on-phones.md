# 10: Pipeline on phones

**What to build:** Someone who opens a texted link on a phone can still use the Pipeline: below about 1060px it shows one Stage at a time, and the Deal panel takes the full screen.

**Blocked by:** 05 (Pipeline board and Deal panel).

**Status:** done

- [x] Below about 1060px the Owner x Stage grid is replaced by Stage tabs (name, color, count) and a list of that Stage's Deal cards, still respecting Mine / Everyone.
- [x] The KPI strip wraps without sideways page scrolling.
- [x] The Deal Sheet and the Ask the pipeline Sheet take the full width on phones.
- [x] The top bar works at phone width (Maya's name hidden below 1024px, initials kept, nav still reachable).
- [x] Checked by hand at 375px wide: no sideways page scroll, every control at least 44px.

## Comments

**2026-11-24, done.** Below 1120px the Pipeline shows Stage tabs with color, name and count over one Stage's cards, which name their Owner. The KPI strip is two columns on phones. The Deal Sheet takes the full width, with a bar holding its title and Close on phones. Checked by hand at 320, 375, 768, 900, 1119, 1121 and 1440px: no sideways page scroll, and at 375px every control measured at least 44px on the Pipeline, Closed, Companies, Company, Retainers and Deal screens and the Edit Deal dialog. 179 tests pass.

The Ask the pipeline Sheet doesn't exist yet (ticket 14). The shared Sheet component is full width below 1120px, so it gets this for free.

Fixed after review: the progress bar was color alone on phones, and said nothing at all on a Won Deal; a long link someone types stretched the page sideways; closing and deleting a Deal went back to different Stages; iOS would zoom in on form fields; the Proposal form's line items were too narrow to read; the Edit and Delete buttons squeezed timeline text.

Notes for later tickets:
- Ticket 14: check the Ask Sheet at 375px once it exists.
- The Closed, Companies and Retainers tables scroll sideways inside their own box on phones.
- Each Stage tab is a server request, like Mine / Everyone.

# 03: Companies, Contacts and Activities

**What to build:** Maya can find a Company in the Companies list, open its page, see its Contacts and Activity timeline, keep Companies and Contacts up to date, and log an Activity. The Template grows to the full set of Companies, Contacts and Activities.

**Blocked by:** 02 (Walking skeleton).

**Status:** done

- [x] The Template holds about 40 Companies, 80 Contacts and the Activities that belong to them, all fake and checked for clashes with real businesses, with dates relative to the anchor.
- [x] The Companies list has a text filter and an Owner filter. The Client or Prospect filter is present but treats every Company as a Prospect until ticket 07 adds Retainers.
- [x] The Company page shows its Contacts and its Activity timeline (kind icon, author, kind, when, text), using Variant H's cards and tables.
- [x] Maya can create, edit and delete Companies and Contacts.
- [x] Maya can log an Activity (Email, Call, Meeting or Note) with a date and text against a Company, optionally with a Contact.
- [x] Contacts and Activities are covered by the isolation test.
- [x] Every screen in this ticket meets the spec's accessibility rules (visible labels, focus ring, 44px targets, nothing under 12px).

## Comments

**2026-11-24, done.** The Template now holds 40 Companies (12 that become Clients in ticket 07, 28 Prospects), 80 Contacts and 125 Activities. The Companies list filters by name, Owner and Client or Prospect (all Prospect for now). The Company page shows the Activity timeline and Contacts, with dialogs to create, edit and delete Companies and Contacts and to log an Activity. 46 tests pass; the new isolation cases fail when Contact or Activity RLS is loosened.

Fixed after review: "when" labels count calendar days in the visitor's own time zone (they were off by a day for some zones); the dialog close button is a 44px target; the Template seed refuses any date after the anchor; the cross-Sandbox Contact test uses a Contact only the other Sandbox has.

Open: the 2026-11-22 decision says visitors can edit Activities, but this ticket only asks to log them. Editing and deleting an Activity is not built yet.

Notes for later tickets:
- Name check (2026-11-24, web searches): 9 names clashed with real businesses and were replaced (Peregrine Dental, Kettle Point Snacks, Bellweather Property, Alder & Ash Interiors, Glasswing Software, Moorcroft Pharmacy, Bluefen Seafood, Lowtide Surf, Cinderhouse Pizza). "Kestrel Studio" has a soft clash with Studio Kestrel, an NYC interior design firm; the name is kept per the 2026-11-22 decision.
- The spec's ~300 Activities include Deal Activities. Ticket 05 should add Deal-linked Activities (and a nullable `deal_id`) to reach that.
- Companies 1, 4, 8 to 17 are meant to be Clients (ticket 07). Wrenfield Tea, Larchmere Vineyards and Fieldvane Outdoor already mention a renewal coming up, which suits ticket 08's Renewals.
- Template ids are readable: Company 7 is `...00000000c007`, its 2nd Contact `...0000000d0072`, Activity 12 `...0000000a0012`.


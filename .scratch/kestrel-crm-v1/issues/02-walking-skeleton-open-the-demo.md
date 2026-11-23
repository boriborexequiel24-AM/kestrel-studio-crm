# 02: Walking skeleton: "Open the demo" gives a private Sandbox

**What to build:** A visitor lands on the landing page, clicks "Open the demo", and arrives on a Companies list showing a small set of Kestrel Studio sample Companies in their own private Sandbox, inside the Variant H app frame. A second visitor gets their own Sandbox and can never see the first one's data. This is the tracer bullet: app, look, auth, Sandbox, CRM module, database and tests all exist end to end, so later tickets only add to them.

See the spec in this folder for the look (tokens, type, app frame), the data model, ADR 0001 for isolation, and ADR 0002 for keeping everything in the app.

**Blocked by:** 01 (Install Docker and the Supabase CLI).

**Status:** done

- [x] The app runs locally on Next.js 16 (App Router), Tailwind v4 and shadcn/ui, against the local Supabase stack. Run, build and test commands are recorded in `CLAUDE.md`.
- [x] `.env.example` lists the variable names from the spec, with no values. `.env` stays ignored.
- [x] The Variant H look is in place as theme tokens (colors, Stage colors, Plus Jakarta Sans, radii, flat style, reduced motion), and the app frame has the sticky top bar, placeholder logo, nav (Home, Pipeline, Companies, Retainers), the "Ask the pipeline" button (inactive for now) and the "Maya, Account Director" indicator.
- [x] The landing page has the name, one line, three points, "Open the demo" and a "Built by Zeki" link.
- [x] "Open the demo" signs the visitor in anonymously and builds a Sandbox from the Template in one step, then shows the Companies list.
- [x] All tables live in the `crm` schema. Every Sandbox-owned table has a `sandbox_id` and RLS that allows only the signed-in user's Sandbox.
- [x] The Template holds a small first set of Companies plus the Persona and 4 Teammates. Building a Sandbox copies them and shifts every date by the gap between the Template's anchor and now.
- [x] All page data goes through the server-side CRM module, using the visitor's own session (never the service key in request code).
- [x] Test setup: tests call the CRM module as real anonymous users against the local stack, with a fake AI provider stub available. Tests are written test-first.
- [x] Required isolation test: with two Sandboxes, one visitor can't read, change or delete the other's Companies. Later tickets add each new table to this test.
- [x] Signed-in screens without a live Sandbox session send the visitor to the landing page.

## Comments

**2026-11-24.** From ticket 01: the local stack works on this Windows machine with `[analytics] enabled = false` in the Supabase `config.toml`. Analytics on Windows needs Docker's daemon exposed on unencrypted TCP, so keep it off.

**2026-11-24, done.** The app runs on Next.js 16.4, Tailwind v4 and shadcn/ui against the local stack; "Open the demo" signs in anonymously, builds a Sandbox from the Template (Maya, 4 Teammates, 8 Companies, dates shifted) and lands on the Companies list in the Variant H frame. 18 CRM module tests pass, including the isolation test (checked by loosening RLS on purpose: it fails). Home, Pipeline and Retainers are "still being built" placeholders behind the same Sandbox check.

Fixed after review: every `crm` function now revokes PUBLIC execute (Postgres grants it by default, so visitors could call `crm.fill_sandbox` directly); "Open the demo" survives a double click; a visitor whose anonymous user was deleted but whose token is still valid gets a fresh session instead of a 500; a missing `AI_PROVIDER` fails loudly instead of using fake answers. Each has a test.

Notes for later tickets:
- The Template is a reserved Sandbox row (`is_template`). A new Sandbox-owned table needs: `sandbox_id` defaulting to `crm.current_sandbox_id()`, a `(sandbox_id, id)` key, foreign keys that include `sandbox_id`, the RLS policy, a copy step in `crm.fill_sandbox` with dates shifted, and a case in `tests/isolation.test.ts`.
- Each new `crm` function needs `revoke execute ... from public` right after it, and an isolation case if visitors must not call it.
- Ticket 04: `sandbox.open()` already starts a fresh anonymous session when the old Sandbox expired or its user is gone, so show the "your Sandbox was reset" notice before calling it.
- The 8 sample Company names are a first set; ticket 03's clash check should cover them too.
- "Built by Zeki" links to https://workwithbori.cloud until the new portfolio is live.

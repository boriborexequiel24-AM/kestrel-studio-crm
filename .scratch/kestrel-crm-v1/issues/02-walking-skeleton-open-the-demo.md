# 02: Walking skeleton: "Open the demo" gives a private Sandbox

**What to build:** A visitor lands on the landing page, clicks "Open the demo", and arrives on a Companies list showing a small set of Kestrel Studio sample Companies in their own private Sandbox, inside the Variant H app frame. A second visitor gets their own Sandbox and can never see the first one's data. This is the tracer bullet: app, look, auth, Sandbox, CRM module, database and tests all exist end to end, so later tickets only add to them.

See the spec in this folder for the look (tokens, type, app frame), the data model, ADR 0001 for isolation, and ADR 0002 for keeping everything in the app.

**Blocked by:** 01 (Install Docker and the Supabase CLI).

**Status:** ready-for-agent

- [ ] The app runs locally on Next.js 16 (App Router), Tailwind v4 and shadcn/ui, against the local Supabase stack. Run, build and test commands are recorded in `CLAUDE.md`.
- [ ] `.env.example` lists the variable names from the spec, with no values. `.env` stays ignored.
- [ ] The Variant H look is in place as theme tokens (colors, Stage colors, Plus Jakarta Sans, radii, flat style, reduced motion), and the app frame has the sticky top bar, placeholder logo, nav (Home, Pipeline, Companies, Retainers), the "Ask the pipeline" button (inactive for now) and the "Maya, Account Director" indicator.
- [ ] The landing page has the name, one line, three points, "Open the demo" and a "Built by Zeki" link.
- [ ] "Open the demo" signs the visitor in anonymously and builds a Sandbox from the Template in one step, then shows the Companies list.
- [ ] All tables live in the `crm` schema. Every Sandbox-owned table has a `sandbox_id` and RLS that allows only the signed-in user's Sandbox.
- [ ] The Template holds a small first set of Companies plus the Persona and 4 Teammates. Building a Sandbox copies them and shifts every date by the gap between the Template's anchor and now.
- [ ] All page data goes through the server-side CRM module, using the visitor's own session (never the service key in request code).
- [ ] Test setup: tests call the CRM module as real anonymous users against the local stack, with a fake AI provider stub available. Tests are written test-first.
- [ ] Required isolation test: with two Sandboxes, one visitor can't read, change or delete the other's Companies. Later tickets add each new table to this test.
- [ ] Signed-in screens without a live Sandbox session send the visitor to the landing page.

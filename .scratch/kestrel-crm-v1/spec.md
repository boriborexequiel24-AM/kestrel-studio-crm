# Spec: Kestrel Studio CRM v1

Status: ready-for-agent

Sources: `CLAUDE.md` (Decisions), `GLOSSARY.md`, `docs/adr/0001-sandboxes-via-anonymous-auth-and-rls.md`, `docs/adr/0002-everything-runs-in-the-app-not-n8n.md`, and the look prototype on branch `prototype/pipeline-deal-look` (commit `d4e9e79`, see `prototype/VERDICT.md` there, Variant H "Sales desk").

## Problem Statement

Zeki builds automation and AI systems for small businesses. The portfolio already shows CRM sync and lead routing as n8n, Make and Zapier workflows. What's missing is a complete, multi-screen web app with real auth and AI built in, that a visitor can click through for themselves.

The visitor needs to try a realistic tool in about five minutes, without signing up, without seeing someone else's edits, and without worrying about breaking it. Zeki needs that demo to stay cheap and safe to leave online: every AI action costs money, and it lives in a Supabase project shared with other demos.

## Solution

Kestrel Studio CRM: the internal CRM of a fictional 12-person brand and performance marketing agency, framed as a custom tool built for one client rather than a SaaS product.

A visitor lands on a one-screen page and clicks "Open the demo". Behind that click the app creates a real anonymous session and a private Sandbox: a full copy of Kestrel Studio's sample data (Companies, Contacts, Deals, Proposals, Retainers, Activities) with every date shifted so the data always looks current. The visitor plays Maya, Account Director. They can work the Pipeline, open Deals, send and accept Proposals, win and lose Deals, log Activities, and try three AI features: a Company summary, a drafted follow-up for a Deal, and "Ask the pipeline", a chat that looks things up in their Sandbox and links to the records it used. Nothing ever really sends. The Sandbox disappears after 24 hours, and "Start over" restores it at any time.

AI use is capped per Sandbox and across the whole demo, and every AI action is logged so the real cost per action can be measured.

## User Stories

### Arriving and the Sandbox

1. As a visitor, I want a landing page that says in one line what this is, so that I know what I'm about to open.
2. As a visitor, I want to see three short points (private Sandbox, AI built in, resets in 24 hours), so that I know I can't break anything and nobody else will see my changes.
3. As a visitor, I want a single "Open the demo" button, so that I can start without signing up or typing anything.
4. As a visitor, I want the app to open on Home with my own private data, so that the tour starts somewhere meaningful.
5. As a visitor, I want to see that I'm signed in as Maya, Account Director, so that I understand whose desk I'm sitting at.
6. As a visitor, I want a line under each page title saying how long until my Sandbox resets, so that I'm not surprised when it disappears.
7. As a visitor, I want a "Start over" link next to that line, so that I can return to fresh sample data after experimenting.
8. As a visitor, I want "Start over" to ask me to confirm, so that I don't wipe my changes by accident.
9. As a returning visitor within 24 hours, I want to land back in my own Sandbox, so that my changes are still there.
10. As a returning visitor after my Sandbox expired, I want the landing page to tell me my Sandbox was reset, so that I understand why my changes are gone and can open a new one.
11. As a visitor, I want sample dates such as "renews in 12 days" and "last emailed 3 days ago" to be true today, so that the data feels like a live business.
12. As a visitor, I want my edits never to appear in anyone else's Sandbox, so that I can type anything.
13. As a visitor who opens too many Sandboxes in a day, I want a clear message that the daily limit is reached, so that I know to come back tomorrow.
14. As a visitor, I want a small "Built by Zeki" link on the landing page, so that I can find the person who made this.

### Home

15. As Maya, I want Home to show my Deals that need attention (Next step overdue or missing), so that I know what to do first.
16. As Maya, I want Home to show my Retainers ending within 60 days, so that renewals don't slip.
17. As Maya, I want an "Everyone" toggle on Home, so that I can see the whole team's attention list.
18. As Maya, I want Home to show the agency-wide Monthly value of open Deals by Stage, so that I can see the health of the business at a glance.
19. As Maya, I want each item on Home to link to its Deal or Retainer, so that I can act on it in one click.

### Pipeline

20. As Maya, I want a Pipeline screen with a KPI strip (Open pipeline, Proposals out, Won this month, Overdue Next steps), so that the key numbers are always on top.
21. As Maya, I want the Overdue Next steps figure to stand out when it is above zero, so that I notice slipping Deals.
22. As Maya, I want open Deals laid out in a grid of Owner rows and Stage columns, so that I can see who is working on what and where.
23. As Maya, I want each Stage column to show its name, color, count and total Monthly value, so that I can compare Stages.
24. As Maya, I want each Owner row to show the Owner's initials and open Monthly value, so that I can compare the team's load.
25. As Maya, I want my own row to stand out, so that I find my work quickly.
26. As Maya, I want each Deal card to show the Company, the Monthly value, whether it's a Renewal, the Deal title, the Next step text and its due label, so that I can judge a Deal without opening it.
27. As Maya, I want an overdue Next step shown in red with the word "Overdue", so that lateness is clear without relying on color.
28. As Maya, I want a Mine / Everyone toggle on the Pipeline, so that I can focus on my own Deals.
29. As Maya, I want an Open / Closed switch, so that I can see Won and Lost Deals in a simple table with their Lost reasons.
30. As Maya, I want to click a Deal card and have the Deal open beside the board, so that I never lose my place.
31. As Maya, I want an opened Deal to have its own link, so that the browser's back button and shared links work.
32. As a visitor on a phone, I want the Pipeline to show one Stage at a time with Stage tabs and counts, so that I can use it on a small screen.

### Deal

33. As Maya, I want the Deal's header to show its Company, whether the Company is a Client or Prospect, whether the Deal is New business or a Renewal, its title, its Stage and its Monthly value, so that I have the context at a glance.
34. As Maya, I want the Monthly value labelled "a month, estimated" before a Proposal is sent and "a month, Proposal vN" after, so that I know how firm the number is.
35. As Maya, I want a Stage stepper showing completed Stages, so that I can see how far the Deal has come.
36. As Maya, I want to change the Stage from a dropdown on the Deal, so that I can move a Deal without dragging.
37. As Maya, I want a "Move to..." menu on each board card, so that I can change Stage from the board too.
38. As Maya, I want Won to be unavailable until the Deal has a Sent Proposal, with the reason shown, so that I don't record a win without an offer.
39. As Maya, I want moving a Deal to Won to ask "Mark Proposal accepted and start the Retainer?", so that I confirm the consequences.
40. As Maya, I want confirming Won to accept the Proposal and create a Retainer from it, so that the agency's recurring work is recorded in one step.
41. As Maya, I want winning a Renewal to extend its existing Retainer with a new end date and fee, so that each Client's Retainer list stays clean.
42. As Maya, I want moving a Deal to Lost to require a Lost reason from a short list, so that the agency learns why it loses.
43. As Maya, I want a Lost Deal to show its Lost reason in a banner, so that anyone opening it knows what happened.
44. As Maya, I want to set and edit a Deal's Next step and due date, so that every Deal has one clear action.
45. As Maya, I want to create a new Deal for a Company with an estimated Monthly value, an Owner and a kind (New business or Renewal), so that I can track new work.
46. As Maya, I want to edit and delete Deals, so that the Pipeline stays accurate.

### Proposals

47. As Maya, I want to draft a Proposal for a Deal with a scope summary, line items (service and monthly fee) and a term in months, so that I can prepare an offer.
48. As Maya, I want the Proposal's monthly total calculated from its line items, so that I don't add it up myself.
49. As Maya, I want to mark a Proposal as Sent, so that the Deal's Monthly value switches to the real offer.
50. As Maya, I want only one Proposal per Deal to be Sent at a time, so that it's always clear which offer is live.
51. As Maya, I want to mark a Proposal as Declined without losing the Deal, so that I can send a revised Proposal.
52. As Maya, I want earlier Proposals kept with version numbers, so that I can see how the offer changed.

### Companies, Contacts and Activities

53. As Maya, I want a Companies list with a text filter and filters for Client or Prospect and Owner, so that I can find a Company fast.
54. As Maya, I want a Company page showing its Contacts, Deals, Retainers and Activity timeline, so that I see the whole relationship in one place.
55. As Maya, I want a Company to show as a Client when it has an active Retainer and as a Prospect otherwise, so that its status is always correct without manual upkeep.
56. As Maya, I want to create, edit and delete Companies and Contacts, so that the data stays current.
57. As Maya, I want to log an Activity (Email, Call, Meeting or Note) with a date and text against a Company and optionally a Deal and Contact, so that the history is complete.
58. As Maya, I want each Activity to show its kind, author and time, so that I know who did what and when.

### Retainers

59. As Maya, I want a Retainers list sorted by end date, with ones ending within 60 days flagged, so that I can plan renewals.
60. As Maya, I want each Retainer to show its Company, monthly fee, end date and Owner, so that I understand the agency's recurring income.
61. As Maya, I want to edit a Retainer's end date, so that I can correct a term.
62. As Maya, I want Retainers to come only from winning a Deal, so that every Retainer has a history.

### AI: summary

63. As Maya, I want a "Summarize" button on a Company page, so that I can get the relationship's story in three lines.
64. As Maya, I want a summary to stay saved until a new Activity is added, so that I don't spend an AI action on the same answer twice.
65. As Maya, I want the summary card to tell me when it's out of date and offer a refresh, so that I know when it no longer covers the latest Activity.

### AI: draft follow-up

66. As Maya, I want a "Draft follow-up" button on a Deal, so that I can get a ready-to-edit email for the Next step.
67. As Maya, I want an optional one-line instruction for the draft (for example "mention the Q3 case study"), so that I can steer it.
68. As Maya, I want the draft to use the Deal's Stage, recent Activities, Next step and main Contact, so that it reads like it knows the relationship.
69. As Maya, I want to edit the draft, copy it, or "Log as sent", so that I can use it without the app sending anything.
70. As Maya, I want "Log as sent" to add an Email Activity with the draft's text, so that the history shows what was sent.

### AI: Ask the pipeline

71. As Maya, I want an "Ask the pipeline" button in the top bar that opens a chat panel from any screen, so that I can ask questions without leaving my work.
72. As Maya, I want suggested questions in the panel, so that I know what it can answer.
73. As Maya, I want to ask questions like "Which Deals are stuck in Proposal sent?", "What renews next month?" and "Why are we losing Deals?", so that I get answers about my own data.
74. As Maya, I want answers to link to the Companies and Deals they mention, so that I can check them in one click.
75. As Maya, I want a "Looked up: ..." note under each answer, so that I can see what data the answer was based on.
76. As a visitor, I want Ask the pipeline only to read my data, never change it, so that a chat can't damage my Sandbox.
77. As a visitor, I want the chat to start fresh when I reload, so that nothing I type is stored.

### AI limits

78. As a visitor, I want to see how many AI actions I have left today, so that I can choose how to spend them.
79. As a visitor who has used all 30 AI actions, I want a friendly message and the rest of the app to keep working, so that the tour doesn't break.
80. As a visitor, I want "Start over" not to give me more AI actions, so that the limit is fair.
81. As a visitor on a busy day, I want a friendly message when the demo-wide AI limit is reached, so that I understand it's not my fault.
82. As Zeki, I want every AI action logged with its Sandbox, feature, tokens, cost and time, so that I can measure real cost and tune the limits.
83. As Zeki, I want the limits set in environment variables, so that I can change them without a code change.
84. As Zeki, I want the AI provider swappable by configuration, so that I'm not locked into one vendor.

### Running the demo

85. As Zeki, I want expired Sandboxes and their anonymous users deleted every hour by a job inside the database, so that the shared Supabase project doesn't fill up and nothing outside the app can break the reset.
86. As Zeki, I want Sandbox creation limited per hashed IP, so that anonymous sign-up can't be abused.
87. As Zeki, I want the CRM to live in its own `crm` schema, so that it can't touch the other demos' data in the shared project.
88. As Zeki, I want automated tests proving one Sandbox can never read or change another's data, so that I can leave the demo online with confidence.
89. As Zeki, I want automated tests proving the AI limits hold, so that a public demo's cost stays bounded.
90. As a prospect's developer, I want to read the code on GitHub once v1 works, so that I can judge the quality of the build.

### Look and accessibility

91. As a visitor, I want a clean, flat, professional look, so that the tool feels like something an agency would use every day.
92. As a visitor using a keyboard, I want a visible focus ring and a tab order that follows the layout, so that I can use the whole app without a mouse.
93. As a visitor, I want Stage and overdue states always shown with words or icons as well as color, so that I can read them whatever my color vision.
94. As a visitor, I want motion reduced when my system asks for it, so that panel slides don't bother me.
95. As a visitor on a phone, I want every screen usable at phone width, with Deal and chat panels taking the full width, so that a link texted to me still works.

## Implementation Decisions

### Shape of the app

- One Next.js 16 app (App Router) with Tailwind v4 and shadcn/ui, deployed on Vercel at a `.vercel.app` address. Everything runs in the app and the database; no n8n (ADR 0002).
- Routes: landing page, Home, Pipeline, Deal (renders the Pipeline with the Deal open in a right-hand Sheet; closing returns to the Pipeline), Companies, Company, Retainers. Ask the pipeline is a left-hand Sheet available on every signed-in screen, not a route.
- Signed-in screens require a live Sandbox session; without one they send the visitor to the landing page (with an "expired" notice when a session existed but its Sandbox is gone).

### Modules

- **CRM module (server-only, the one seam).** Every page's server code, form actions and route handlers call this module and nothing else for data. It takes the visitor's session and exposes operations grouped by area:
  - Sandbox: open a new Sandbox (rate-limit check, anonymous sign-in, build from Template), get Sandbox status (time left, AI actions left), Start over.
  - Home: my attention list, renewing soon (each with Mine or Everyone), pipeline value by Stage (agency-wide).
  - Pipeline: board (KPI strip, Owner x Stage grid, Mine or Everyone), closed Deals table, move a Deal to a Stage (with Lost reason, or the Won confirmation).
  - Deals, Proposals, Companies, Contacts, Activities, Retainers: the reads and writes listed in the user stories.
  - AI: summarize a Company, draft a follow-up for a Deal, log a draft as sent, ask the pipeline.
  - Rule violations come back as typed results the UI can show, not thrown errors. At least: Won needs a Sent Proposal, Lost reason required, another Proposal is already Sent, Sandbox AI limit reached, demo-wide AI limit reached, Sandbox creation limit reached, Sandbox expired.
- **AI module (server-only).** A small provider interface (instructions, input, optional tools, returns text plus tool calls and token usage). Two adapters: OpenAI (plain HTTP to the Responses API, model from configuration, default `gpt-5.4-mini`, low reasoning effort) and a fake used by tests. `AI_PROVIDER` picks the adapter. The CRM module owns prompts and limits; the AI module only talks to the provider.
- **Database (`crm` schema in the shared Supabase project).** Migrations and the Template seed live in the repo.

### Data model

- `sandboxes`: one row per Sandbox, linked to the anonymous auth user, with created and expires times (expires = created + 24 hours). "Start over" keeps the same row and expiry and replaces its data, so the AI limit and the 24-hour clock carry over.
- Every domain table carries a `sandbox_id`: teammates (the Persona and the Teammates), companies, contacts, deals, proposals, proposal line items, retainers, activities, AI summaries (cache), AI usage.
- Deal: Company, Owner, title, kind (New business or Renewal), Stage, estimated Monthly value, Next step text and due date, Lost reason, and for a Renewal the Retainer it renews.
- Proposal: Deal, version number, status (Draft, Sent, Accepted, Declined), scope summary, term in months, line items (service, monthly fee). Monthly total is derived from line items. At most one Sent Proposal per Deal, enforced by the database.
- Retainer: Company, the Deal that created it, Owner, monthly fee, start and end dates.
- Client or Prospect is derived (a Company with an active Retainer is a Client), never stored.
- Activity: Company, optional Deal, optional Contact, author (Persona or Teammate), kind (Email, Call, Meeting, Note), occurred time, text.
- AI usage: Sandbox, feature (summary, draft, ask), input and output tokens, cost, time.
- Sandbox creation log: salted hash of the visitor's IP and time, for the daily creation limit.

### Isolation and auth (ADR 0001)

- "Open the demo" signs the visitor in anonymously with Supabase Auth. The session lives in cookies via Supabase's server-side helpers.
- RLS on every `crm` table: a row is visible and writable only when its `sandbox_id` is the signed-in user's Sandbox. The CRM module uses the visitor's own session for all reads and writes, so the database enforces isolation even if application code has a bug.
- Privileged work runs in a few security-definer database functions, never through the service key in request code: build a Sandbox from the Template, Start over, record an AI action within limits, and the cleanup job.
- Stage changes with side effects run in one database transaction: Won accepts the Sent Proposal and creates or extends the Retainer; Lost requires a Lost reason.

### Template and dates

- The Template is a fixed set of sample rows (about 40 Companies with 12 Clients and 28 Prospects, 80 Contacts, 25 open Deals of which 5 are Renewals, some Won and Lost Deals, 15 active Retainers, about 300 Activities, the Persona plus 4 Teammates). All names are fake and checked for clashes with real businesses.
- Template dates are stored relative to an anchor. Building a Sandbox copies every Template row with a new `sandbox_id` and shifts every date by the gap between the anchor and now.

### Limits and usage

- Per Sandbox: `DEMO_AI_ACTIONS_PER_SANDBOX_PER_DAY` (30). Because a Sandbox lives 24 hours and Start over keeps it, this is effectively a per-Sandbox lifetime limit.
- Demo-wide: `DEMO_DAILY_AI_ACTION_CAP` per UTC day (1000 placeholder until cost per action is measured).
- Sandbox creation: `DEMO_SANDBOXES_PER_IP_PER_DAY` (5) by salted IP hash (`IP_HASH_SALT`), the same pattern as the other demos.
- One visitor request (a summary, a draft, or one chat message) is one AI action, however many tool calls it makes. The limit check and the usage row are written atomically before the provider is called, and the usage row is completed with tokens and cost afterwards.

### AI features

- Summary: three bullet lines from the Company's Activities, Deals and Retainers. Cached per Company; stale when an Activity for that Company is newer than the summary.
- Draft follow-up: built from the Deal's Stage, last few Activities, Next step, main Contact and the optional instruction. Returned as editable text. "Log as sent" creates an Email Activity authored by the Persona.
- Ask the pipeline: tool calling over fixed read-only lookups, each running through the visitor's RLS-scoped session: find Deals (by Stage, Owner, kind, overdue), Retainers ending within N days, a Company's recent Activities, Lost Deals with reasons over a period, pipeline totals by Stage. Answers name records by id so the UI can link them, and the UI lists which lookups ran. The chat history lives only in the browser tab and is sent with each message.

### Cleanup

- An hourly pg_cron job deletes expired Sandboxes, all their rows, and their anonymous auth users.

### Look (from the prototype, Variant H "Sales desk")

Flat design with Swiss minimalism: no gradients or shadows (except the Sheet edge), hover is a color or border shift of 150 to 200ms, motion drops to near zero under `prefers-reduced-motion`. Cards and panels have 12px corners, controls and chips 8px. Light mode only.

Colors (from the prototype):

| Role | Value |
|---|---|
| Primary (buttons, links, focus ring, active nav) | `#2563EB`, hover `#1D4ED8`, text on it `#FFFFFF` |
| Won green | `#059669` (hover text `#047857`) |
| Destructive and overdue | `#DC2626` |
| Background | `#F8FAFC` |
| Card and popover | `#FFFFFF` |
| Foreground | `#0F172A` |
| Muted fill | `#F1F5FD` |
| Muted text | `#475569` |
| Border | `#E4ECFC` |
| Input border | `#CBD5E1` |
| Blue tints (active nav, selected card, AI summary) | `#EFF4FF`, `#F5F8FF`, `#F8FAFF` |

Stage colors, always shown with the Stage name: New `#64748B`, Qualified `#0284C7`, Discovery `#2563EB`, Proposal sent `#D97706`, Negotiation `#EA580C`, Won `#059669`, Lost `#DC2626`.

Type: Plus Jakarta Sans everywhere. Page title 28px bold, KPI figures 26px bold with tabular numbers, Sheet title 22px bold, body 14px, labels and meta 12 to 13px, nothing under 12px.

App frame: sticky 64px white top bar with a 1px border; logo left; nav Home, Pipeline, Companies, Retainers (active item blue on a light blue fill); right side the "Ask the pipeline" button and the signed-in indicator (dark slate circle with Maya's initials, then "Maya" and "Account Director", name hidden below 1024px). The Sandbox line ("Sandbox resets in N hours. Start over") sits under each page title. Focus never hides under the sticky bar.

Pipeline: as in the prototype (KPI strip, Owner x Stage grid as a real table with a caption, Deal cards of at least 44px that are links, selected card in blue border and tint, a hint line under the grid), plus three decisions made after it:
- Each Deal card also shows the Next step text on one line, cut off when long, above the due label.
- An Open / Closed switch beside Mine / Everyone. Closed shows a table of Won and Lost Deals with Lost reasons; Won and Lost never appear on the grid.
- Below about 1060px the grid becomes Stage tabs with counts and a list of that Stage's cards; Sheets go full width.
- There is no drag on the board. Stage changes through the Deal's Stage dropdown or the card's "Move to..." menu.

Deal Sheet: right side, up to 672px wide, 200ms slide. Sticky header (Company, Client or Prospect, New business or Renewal, Deal title, Stage dropdown with color dots and Won disabled with "needs a Sent Proposal" until one is Sent, Monthly value with its label). Then the Stage stepper, the Lost reason banner when Lost, the Next step card with the AI follow-up (labelled optional instruction field, "Draft follow-up" button, editable draft with Copy, Log as sent and "N of 30 AI actions left today"), the Summary card for the Company (light blue tint, sparkle icon, "Cached until new Activity"), the Proposal card beside a People card, and the Activity list with "Log an Activity".

Ask the pipeline Sheet: left side; question as a blue bubble, answer in a card with linked names and a "Looked up: ..." note, suggested questions, labelled input at the bottom.

Home, Companies, Company and Retainers were not prototyped. They use the same tokens, type, cards and tables.

Logo: a placeholder in the prototype's direction (blue rounded square with a flat two-tone folded wing chevron in white and `#93C5FD`, wordmark "Kestrel Studio"). A proper mark is a later pass.

### Configuration

Environment variable names (values only in `.env`, documented in `.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_PROVIDER`, `IP_HASH_SALT`, `DEMO_AI_ACTIONS_PER_SANDBOX_PER_DAY`, `DEMO_DAILY_AI_ACTION_CAP`, `DEMO_SANDBOXES_PER_IP_PER_DAY`. The other demos use the same Supabase variable names.

## Testing Decisions

- **A good test checks external behavior only**: what a visitor can see or do through the CRM module, never table layouts, private helpers or prompt wording. If the internals are rewritten and the behavior is unchanged, no test should break.
- **One seam: the CRM module.** Tests call it as real anonymous users, signed in through a local Supabase stack (Supabase CLI in Docker, with the repo's migrations and Template seed applied), with the AI module set to the fake provider. No test calls OpenAI.
- **Required tests** (the two failures that would hurt most in a public demo):
  - Sandbox isolation: with two Sandboxes, nothing one visitor reads, writes, deletes or asks the pipeline about ever touches the other's data.
  - AI limits: the 31st AI action for a Sandbox is refused with the typed result and the rest of the module keeps working; Start over doesn't reset the count; the demo-wide limit refuses across Sandboxes; every action writes one usage row.
- **Also tested at the same seam**: building a Sandbox from the Template with shifted dates; Start over; the cleanup function (called directly with backdated Sandboxes) removing Sandboxes, rows and anonymous users; Sandbox creation limit by IP hash; Won requiring a Sent Proposal and creating a Retainer; a won Renewal extending its Retainer; Lost requiring a Lost reason; one Sent Proposal per Deal; Declined keeping the Deal open; Client or Prospect derived from Retainers; summary cache going stale on a new Activity; Log as sent creating an Email Activity; Ask the pipeline's lookups returning only the visitor's own records, driven by scripted tool calls from the fake provider.
- **No automated UI tests in v1.** Screens are checked by hand in a browser against the look above.
- **Prior art: none.** No project in this workspace has tests yet, so this sets the pattern.
- Tests are written test-first, one behavior at a time, with `/tdd`.

## Out of Scope

- Deal scoring (v2).
- Sending real email or any other message.
- Roles, permissions, team switching, editing the Persona or Teammates.
- Login forms, real accounts, sign-up, CAPTCHA.
- Contact pages (Contacts live on their Company) and a task module (Deals have a Next step).
- Global search.
- Drag and drop on the board.
- Proposal PDFs or a document builder.
- Storing chat history.
- Dark mode, a custom domain, a final logo, a more ownable accent color.
- Keyboard shortcuts, a "Path to Won" checklist, and other ideas from the losing prototype variants.
- Automated UI or browser tests.
- Currencies other than USD.
- Imports, exports, notifications, analytics.
- Renaming the project folder (happens after this spec, between sessions).

## Further Notes

- **Prerequisites only Zeki can do** (good candidates for a `/wizard`): install Docker Desktop (WSL2) and the Supabase CLI for local tests; in the shared Supabase project, turn on anonymous sign-ins, add `crm` to the schemas exposed to the API, and enable pg_cron; create the Vercel project; fill `.env` from `.env.example`.
- The shared Supabase project also hosts the `public`, `leads` and `ops` schemas. None of them uses auth, so turning on anonymous sign-ins doesn't affect them, but every migration must stay inside `crm`.
- The prototype code on `prototype/pipeline-deal-look` is a reference for the look only. It is throwaway and is never merged; rebuild screens in the real app rather than copying variant files.
- Sample names in the prototype were prototype-only. The decided Persona is "Maya, Account Director".
- The repo goes public on GitHub once v1 works, so secrets stay in `.env` only and all data stays fake.
- The demo-wide AI limit of 1000 is a placeholder. Set it from the usage table once real cost per action is known.

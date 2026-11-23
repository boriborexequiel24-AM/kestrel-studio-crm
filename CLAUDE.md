# Big Test

## Overview
A portfolio and demo project by Zeki (Exequiel). A full CRM web app with AI built in,
made to impress prospective clients. It's a standalone product for a fictional
marketing agency, separate from the Copperline demos (`../Lead Capture/`,
`../Real Work Systems/`, `../TBD/`).

**Why this project:** Zeki's portfolio already shows CRM sync and lead routing as
n8n/Make/Zapier workflows. This project shows something new: a complete, multi-screen
web app with real logins and AI features, written as code. Don't turn it into another
workflow demo.

## Decisions
- **Standalone CRM for a fictional marketing agency** (decided 2026-11-21). Not tied to
  Copperline. An agency is close to the clients Zeki pitches, so they can picture using it.
  Pipeline runs from prospect to signed retainer, with proposals, client accounts and renewals.
- **AI built in** (decided 2026-11-21). Normal CRM screens plus AI features, e.g. summarize a
  contact's history, draft follow-ups, score deals, answer questions about the pipeline.
- **Each visitor gets their own sandbox** (decided 2026-11-21). No sign-up: a visitor gets a
  private copy filled with sample data, can change anything, and it resets after 24 hours.
- **Same stack as the other demos** (decided 2026-11-21). Next.js + Tailwind on Vercel,
  Supabase for the database and auth, OpenAI for AI (Zeki's existing credits; keep the
  provider swappable, don't push Anthropic credits).
- **v1 is sized for a 5-minute self-guided tour** (decided 2026-11-22). Anything that doesn't
  help a prospect's first look waits for v2.
- **Visitor plays one persona, Maya, Account Director** (decided 2026-11-22). Teammates appear
  only as owners of Deals and Activities. No roles or permissions in v1.
- **Core terms: Company, Contact, Deal, Proposal, Retainer, Activity** (decided 2026-11-22).
  Client and Prospect are a Company's status, derived from Retainers. See `GLOSSARY.md`.
- **Framed as a custom internal tool for one agency, not SaaS** (decided 2026-11-22). It mirrors
  what Zeki sells: a client's own tool with their name on it.
- **Agency: Kestrel Studio, a 12-person brand and performance agency** (decided 2026-11-22,
  pending a name clash check).
- **v1 AI features: summary, draft follow-up, ask the pipeline** (decided 2026-11-22). Deal
  scoring waits for v2: it needs batch runs and history to be trusted.
- **Nothing really sends** (decided 2026-11-22). Drafts can be edited and copied; "Log as sent"
  only records an Activity.
- **AI cap: about 30 AI actions per Sandbox per day, plus a demo-wide daily cap**
  (decided 2026-11-22). Protects Zeki's OpenAI credits; same pattern as the other demos.
- **Entry: landing page with one "Open the demo" button, real session behind it, no login
  form** (decided 2026-11-22). Keeps "no sign-up" while still using real auth.
- **Desktop-first, usable on a phone** (decided 2026-11-22). Prospects review a CRM at a desk.
- **Keep the name Kestrel Studio** (decided 2026-11-22). No exact real match; easy to rename later.
- **Pipeline: New, Qualified, Discovery, Proposal sent, Negotiation, Won, Lost** (decided
  2026-11-22). Won means the Proposal was accepted and creates a Retainer.
- **A Company can hold several Retainers; each won Deal creates one** (decided 2026-11-22).
  Matches how agencies sell separate services.
- **Renewal is a kind of Deal, present in the sample data** (decided 2026-11-22). A 24-hour
  Sandbox is too short for automatic creation; Retainers ending within 60 days are flagged.
- **Proposal is a plain record with line items and a status** (decided 2026-11-22). No PDF or
  document builder in v1; Accepted moves the Deal to Won.
- **Sample data dates are relative to Sandbox creation** (decided 2026-11-22). The data always
  looks current, whenever someone visits.
- **Sample data size: ~40 Companies, 80 Contacts, 25 open Deals, 15 Retainers, ~300
  Activities, 4 Teammates** (decided 2026-11-22). Looks real, loads fast.
- **v1 screens: Home, Pipeline, Deal, Companies, Company, Retainers, Ask the pipeline panel**
  (decided 2026-11-22). No Contact pages and no task module; Deals have a Next step.
- **Database: a `crm` schema in the shared Supabase project** (decided 2026-11-22). Both free
  projects are in use; follows the `public` / `leads` / `ops` pattern.
- **Sandboxes use anonymous sign-in plus RLS** (decided 2026-11-22). See
  `docs/adr/0001-sandboxes-via-anonymous-auth-and-rls.md`.
- **Hourly pg_cron job resets expired Sandboxes, not n8n** (decided 2026-11-22). The project
  shows code, not workflows, and nothing outside the app can break the reset.
- **"Start over" button resets a Sandbox but not its AI cap** (decided 2026-11-22).
- **AI calls run in the app's server code through one AI module, `gpt-5.4-mini`**
  (decided 2026-11-22). Plain HTTP to the Responses API; `AI_PROVIDER` keeps it swappable.
- **Ask the pipeline uses tool calling over fixed read-only lookups** (decided 2026-11-22).
  Honest about how it would work on a real client's data; answers link to records.
- **A Deal can have several Proposals, one Sent at a time; Declined does not lose the Deal**
  (decided 2026-11-22). Leaves room for a revised offer.
- **Dropping a Deal on Won needs a Sent Proposal; a confirm accepts it and starts the Retainer**
  (decided 2026-11-22). Keeps Won and Retainers consistent.
- **Lost needs a Lost reason from a short list** (decided 2026-11-22). Lets Ask the pipeline
  answer "why are we losing deals?"
- **A won Renewal extends the same Retainer** (decided 2026-11-22). New end date and fee, plus
  an Activity; no second Retainer.
- **Money is USD, shown as Monthly value** (decided 2026-11-22). Agencies talk in monthly fees;
  estimated until a Proposal is sent.
- **Visitor can edit Companies, Contacts, Deals, Proposals, Activities** (decided 2026-11-22).
  Retainers only come from winning a Deal (end date editable); Teammates and Persona are fixed.
- **AI summary runs on a button and is cached until new Activity** (decided 2026-11-22).
- **Draft follow-up: one button plus an optional one-line instruction** (decided 2026-11-22).
- **Ask the pipeline is read-only and its chat is not stored** (decided 2026-11-22).
- **One visitor request = one AI action; limits live in `.env`** (decided 2026-11-22).
  `DEMO_AI_ACTIONS_PER_SANDBOX_PER_DAY=30`, `DEMO_DAILY_AI_ACTION_CAP=1000` (placeholder until
  cost per action is measured), `DEMO_SANDBOXES_PER_IP_PER_DAY=5`.
- **One database function builds a Sandbox from the Template and shifts dates**
  (decided 2026-11-22). "Start over" reuses it; the Template lives in the repo as a SQL seed.
- **Next.js 16 (App Router), Tailwind v4, shadcn/ui** (decided 2026-11-22). Matches Automations;
  shadcn added because seven screens need tables, dialogs and panels.
- **Landing page: name, one line, three points, "Open the demo", "Built by Zeki" link**
  (decided 2026-11-22).
- **Settle the look with a `/prototype` of the Pipeline and Deal screens before `/to-spec`**
  (decided 2026-11-22). Visual choices are easier to judge by seeing them.
- **Rename the folder after the spec is written, not mid-session** (decided 2026-11-22).
- **Everything runs in the app, not n8n** (decided 2026-11-22). See
  `docs/adr/0002-everything-runs-in-the-app-not-n8n.md`.
- **Home shows Maya's own work with an "Everyone" toggle; pipeline value is agency-wide**
  (decided 2026-11-22). Feels like her desk, still shows the whole business.
- **Stage can change by dropdown or a "Move to..." menu, not only drag** (decided 2026-11-22).
  Works on phones and by keyboard; same Won and Lost rules.
- **No global search in v1; Companies list has a text filter** (decided 2026-11-22). Ask the
  pipeline covers finding things.
- **Every AI action is logged to one usage table** (decided 2026-11-22). Enforces both caps and
  measures real cost per action.
- **Required tests: Sandbox isolation and AI caps; a fake AI provider in tests**
  (decided 2026-11-22). The two failures that would hurt most in a public demo.
- **Public GitHub repo once v1 works; local until then** (decided 2026-11-22). The code is the
  point, so prospects should be able to read it.
- **Deploy on Vercel at a `.vercel.app` address** (decided 2026-11-22). Custom domain later.
- **Look: Variant H "Sales desk", flat Swiss minimalism, professional blue, Plus Jakarta Sans**
  (decided 2026-11-23). Shows the whole agency at a glance, a Deal opens beside the board so a
  tour never loses its place, and it passed the accessibility checks. Prototype on branch
  `prototype/pipeline-deal-look`; logo is still a placeholder.
- **Deal cards show the Next step text on one line** (decided 2026-11-23). The board is about
  what happens next.
- **Won and Lost stay off the board; an Open / Closed switch shows them in a table**
  (decided 2026-11-23). Keeps the grid about live work while still showing Lost reasons.
- **Below ~1060px the Pipeline shows one Stage at a time with Stage tabs** (decided 2026-11-23).
  The Owner x Stage grid doesn't fit a phone.
- **One test seam: the server-side CRM module, against a local Supabase in Docker, with a fake
  AI provider** (decided 2026-11-23). Tests real RLS and auth without touching the shared live
  project. No automated UI tests in v1.
- **v1 spec written** (2026-11-23): `.scratch/kestrel-crm-v1/spec.md`.

## Open questions
- A proper logo mark (the prototype's is a placeholder).
- Project name (folder is still `Big Test`).

## Tech stack
- **App:** Next.js + Tailwind CSS, deployed on Vercel
- **Database and auth:** Supabase
- **AI:** OpenAI API
- Versions and commands: TBD once the app is scaffolded.

## Structure
_TBD: main folders and files, once they exist._

## Commands
_TBD: how to run, build, and test._

## Conventions
- Only fake sample data. Never commit secrets; use `.env` and `.env.example`.
- Write every decision in the Decisions section with a date and a one-line reason.
- Never use em dashes in anything written for this project.

## Agent skills

### Issue tracker

Local markdown: specs and tickets live as files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on a `Status:` line in each ticket. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Notes
- Platform: Windows 11 (PowerShell / Git Bash).
- Git repo initialized 2026-11-22 (branch `main`, no remote yet).

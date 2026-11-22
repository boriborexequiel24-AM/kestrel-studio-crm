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

## Open questions
- Agency name and branding.
- Exact feature list and screens for v1.
- Supabase: both free projects are in use. The shared project already holds `public`
  (invoices), `leads` and `ops`, so this likely needs its own schema there. To confirm.
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

## Notes
- Platform: Windows 11 (PowerShell / Git Bash).
- Git repo initialized 2026-11-22 (branch `main`, no remote yet).

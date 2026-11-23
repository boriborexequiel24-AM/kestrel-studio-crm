# 01: Install Docker and the Supabase CLI

**What to build:** Zeki's machine can start a local Supabase stack, so every later ticket's tests can run against a real Postgres with real RLS and real anonymous auth, without touching the shared live Supabase project. Only a human can install these. A `/wizard` script is a good way to walk through it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [ ] Docker Desktop is installed on Windows 11 with the WSL2 backend and starts without errors.
- [ ] The Supabase CLI is installed and its version command works from PowerShell and Git Bash.
- [ ] In an empty scratch folder, the Supabase CLI can start and stop a local stack (Postgres, Auth, API) cleanly.
- [ ] Nothing is configured against the shared live Supabase project in this ticket.

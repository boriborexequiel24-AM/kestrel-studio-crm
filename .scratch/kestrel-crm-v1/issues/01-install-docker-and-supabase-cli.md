# 01: Install Docker and the Supabase CLI

**What to build:** Zeki's machine can start a local Supabase stack, so every later ticket's tests can run against a real Postgres with real RLS and real anonymous auth, without touching the shared live Supabase project. Only a human can install these. A `/wizard` script is a good way to walk through it.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Docker Desktop is installed on Windows 11 with the WSL2 backend and starts without errors.
- [x] The Supabase CLI is installed and its version command works from PowerShell and Git Bash.
- [x] In an empty scratch folder, the Supabase CLI can start and stop a local stack (Postgres, Auth, API) cleanly.
- [x] Nothing is configured against the shared live Supabase project in this ticket.

## Comments

**2026-11-24, done.** Docker Desktop (engine 29.9.3, WSL 2 backend) and the Supabase CLI 3.3.0 (installed with Scoop) work from PowerShell and Git Bash. A throwaway local stack started with Postgres, Auth, the API and the other services healthy, then stopped with no containers or volumes left over. The first wizard run's start failed with an error that wasn't captured; the retry worked with every image already downloaded.

Note for ticket 02: the smoke test ran with `[analytics] enabled = false` in `config.toml`. On Windows, Supabase's log analytics needs Docker's daemon exposed on unencrypted TCP, so keep analytics off in the real project's local config unless that changes.

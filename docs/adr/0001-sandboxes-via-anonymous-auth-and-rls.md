# Sandboxes use Supabase anonymous sign-in and row-level security

Each visitor gets a private Sandbox without signing up. "Open the demo" creates a real Supabase anonymous user, every row in the `crm` schema carries a `sandbox_id`, and RLS policies only let a user see their own Sandbox's rows. We chose this over the server-only, token-link approach used in Lead Capture because the point of this project is to show a real multi-user app with real auth, and RLS is how a client's production version would isolate its data.

## Consequences

- Anonymous sign-ins must be turned on in the shared Supabase project. The other demos there (`public`, `leads`, `ops`) use no auth, so they are not affected.
- The hourly cleanup has to delete expired anonymous users along with their Sandboxes, or `auth.users` grows forever.
- Sandbox creation is rate-limited by hashed IP, since anonymous sign-up is otherwise free to abuse.

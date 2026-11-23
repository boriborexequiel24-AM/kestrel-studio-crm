-- Kestrel Studio CRM lives in its own schema so it never touches the other
-- demos (public, leads, ops) in the shared Supabase project.

create schema if not exists crm;

-- Visitors are anonymous Supabase users, so they arrive as `authenticated`.
-- The `anon` role (no session) gets nothing in this schema.
grant usage on schema crm to authenticated, service_role;

-- service_role is only used by tests and by the operator, never in request code.
alter default privileges in schema crm grant all on tables to service_role;
alter default privileges in schema crm grant all on functions to service_role;

-- Postgres lets PUBLIC execute every new function, and a per-schema default
-- privilege can't undo that. So every function in this schema revokes PUBLIC
-- itself, right after it is created, and grants only what it needs.

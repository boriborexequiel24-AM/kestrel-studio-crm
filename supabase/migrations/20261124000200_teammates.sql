-- The Persona (Maya, the visitor) and the Teammates who own Deals and
-- Activities. Fixed sample data: visitors can read them but not change them.
--
-- Every Sandbox-owned table follows the same pattern:
--   * sandbox_id defaults to the visitor's live Sandbox and is part of the
--     primary key, so a Sandbox copy keeps the Template's ids and links;
--   * foreign keys include sandbox_id, so a row can only point at rows in the
--     same Sandbox;
--   * RLS allows only rows of the visitor's live Sandbox.

create table crm.teammates (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  role text not null,
  initials text not null,
  is_persona boolean not null default false,
  primary key (sandbox_id, id)
);

create unique index teammates_one_persona on crm.teammates (sandbox_id) where is_persona;

alter table crm.teammates enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.teammates for select to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()));

grant select on crm.teammates to authenticated;

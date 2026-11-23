-- Companies: organizations Kestrel Studio sells to or works for. Client or
-- Prospect is derived from Retainers, never stored.

create table crm.companies (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  industry text not null default '',
  city text not null default '',
  owner_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (sandbox_id, id),
  foreign key (sandbox_id, owner_id) references crm.teammates (sandbox_id, id)
);

alter table crm.companies enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.companies for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.companies to authenticated;

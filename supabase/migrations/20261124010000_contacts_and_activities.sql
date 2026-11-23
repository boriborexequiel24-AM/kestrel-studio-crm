-- Contacts (people at a Company) and Activities (recorded interactions with a
-- Company). Same Sandbox pattern as teammates and companies: see
-- 20261124000200_teammates.sql.

create table crm.contacts (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  company_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  job_title text not null default '',
  email text not null default '',
  phone text not null default '',
  primary key (sandbox_id, id),
  -- Lets an Activity require that its Contact works at its Company.
  unique (sandbox_id, company_id, id),
  foreign key (sandbox_id, company_id) references crm.companies (sandbox_id, id) on delete cascade
);

alter table crm.contacts enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.contacts for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.contacts to authenticated;

create type crm.activity_kind as enum ('Email', 'Call', 'Meeting', 'Note');

create table crm.activities (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  company_id uuid not null,
  contact_id uuid,
  author_id uuid not null,
  kind crm.activity_kind not null,
  occurred_at timestamptz not null default now(),
  text text not null check (length(trim(text)) > 0),
  primary key (sandbox_id, id),
  foreign key (sandbox_id, company_id) references crm.companies (sandbox_id, id) on delete cascade,
  -- The Contact must work at the same Company. Deleting the Contact keeps the
  -- Activity and just unlinks it.
  constraint activities_contact_at_company
    foreign key (sandbox_id, company_id, contact_id) references crm.contacts (sandbox_id, company_id, id)
    on delete set null (contact_id),
  foreign key (sandbox_id, author_id) references crm.teammates (sandbox_id, id)
);

create index activities_timeline on crm.activities (sandbox_id, company_id, occurred_at desc);

alter table crm.activities enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.activities for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.activities to authenticated;

grant usage on type crm.activity_kind to authenticated;

-- Building a Sandbox now copies Contacts and Activities too.
create or replace function crm.fill_sandbox(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_id uuid;
  shift interval;
begin
  select t.id, s.created_at - t.created_at
    into template_id, shift
    from crm.sandboxes t, crm.sandboxes s
   where t.is_template and s.id = target;

  if template_id is null then
    raise exception 'The Template is missing; load supabase/seeds/template.sql.';
  end if;

  insert into crm.teammates (sandbox_id, id, first_name, last_name, role, initials, is_persona)
  select target, id, first_name, last_name, role, initials, is_persona
    from crm.teammates where sandbox_id = template_id;

  insert into crm.companies (sandbox_id, id, name, industry, city, owner_id, added_at)
  select target, id, name, industry, city, owner_id, added_at + shift
    from crm.companies where sandbox_id = template_id;

  insert into crm.contacts (sandbox_id, id, company_id, name, job_title, email, phone)
  select target, id, company_id, name, job_title, email, phone
    from crm.contacts where sandbox_id = template_id;

  insert into crm.activities (sandbox_id, id, company_id, contact_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

-- create or replace keeps existing grants, but say it again so this file stands alone.
revoke execute on function crm.fill_sandbox(uuid) from public;

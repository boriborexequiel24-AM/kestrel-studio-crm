-- Deals: one chance to win paid work from a Company, moving through the
-- Pipeline. Same Sandbox pattern as the other tables (see 20261124000200_teammates.sql).

create type crm.deal_stage as enum ('New', 'Qualified', 'Discovery', 'Proposal sent', 'Negotiation', 'Won', 'Lost');
create type crm.deal_kind as enum ('New business', 'Renewal');

create table crm.deals (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  company_id uuid not null,
  owner_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  kind crm.deal_kind not null default 'New business',
  stage crm.deal_stage not null default 'New',
  -- Whole US dollars a month. The Monthly value until a Proposal is sent.
  estimated_monthly_value integer not null check (estimated_monthly_value >= 0),
  next_step text not null default '',
  -- A calendar day, compared with the visitor's own "today".
  next_step_due date,
  created_at timestamptz not null default now(),
  primary key (sandbox_id, id),
  -- Lets an Activity require that its Deal is about its Company.
  unique (sandbox_id, company_id, id),
  foreign key (sandbox_id, company_id) references crm.companies (sandbox_id, id) on delete cascade,
  foreign key (sandbox_id, owner_id) references crm.teammates (sandbox_id, id)
);

alter table crm.deals enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.deals for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.deals to authenticated;
grant usage on type crm.deal_stage, crm.deal_kind to authenticated;

-- An Activity may be about one Deal of its Company. Deleting the Deal keeps
-- the Activity on the Company and just unlinks it.
alter table crm.activities add column deal_id uuid;
alter table crm.activities add constraint activities_deal_at_company
  foreign key (sandbox_id, company_id, deal_id) references crm.deals (sandbox_id, company_id, id)
  on delete set null (deal_id);

create index activities_by_deal on crm.activities (sandbox_id, deal_id, occurred_at desc) where deal_id is not null;

-- Building a Sandbox now copies Deals too. Moments shift by the time since
-- the anchor; calendar days (Next step due dates) shift by whole days.
create or replace function crm.fill_sandbox(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_id uuid;
  shift interval;
  day_shift integer;
begin
  select id, now() - created_at, (now() at time zone 'utc')::date - (created_at at time zone 'utc')::date
    into template_id, shift, day_shift
    from crm.sandboxes
   where is_template;

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

  insert into crm.deals (sandbox_id, id, company_id, owner_id, title, kind, stage, estimated_monthly_value,
                         next_step, next_step_due, created_at)
  select target, id, company_id, owner_id, title, kind, stage, estimated_monthly_value,
         next_step, next_step_due + day_shift, created_at + shift
    from crm.deals where sandbox_id = template_id;

  insert into crm.activities (sandbox_id, id, company_id, contact_id, deal_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, deal_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid) from public;

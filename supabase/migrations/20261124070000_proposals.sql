-- Proposals: offers sent to a Company for a Deal, with line items. Same
-- Sandbox pattern as the other tables (see 20261124000200_teammates.sql).

create type crm.proposal_status as enum ('Draft', 'Sent', 'Accepted', 'Declined');

create table crm.proposals (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  deal_id uuid not null,
  version integer not null check (version > 0),
  status crm.proposal_status not null default 'Draft',
  scope_summary text not null check (length(trim(scope_summary)) > 0),
  term_months integer not null check (term_months between 1 and 60),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (sandbox_id, id),
  unique (sandbox_id, deal_id, version),
  foreign key (sandbox_id, deal_id) references crm.deals (sandbox_id, id) on delete cascade,
  -- A Draft hasn't been sent; anything else has.
  constraint proposals_sent_at check ((status = 'Draft') = (sent_at is null))
);

-- It's always clear which offer is live.
create unique index proposals_one_sent on crm.proposals (sandbox_id, deal_id) where status = 'Sent';

alter table crm.proposals enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.proposals for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.proposals to authenticated;
grant usage on type crm.proposal_status to authenticated;

-- The same cap on a Deal's estimate.
alter table crm.deals add constraint deals_estimate_cap check (estimated_monthly_value <= 10000000);

-- The monthly total is always the sum of these, never stored.
create table crm.proposal_line_items (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  proposal_id uuid not null,
  position integer not null,
  service text not null check (length(trim(service)) > 0),
  -- Whole US dollars a month.
  monthly_fee integer not null check (monthly_fee between 0 and 10000000),
  primary key (sandbox_id, id),
  unique (sandbox_id, proposal_id, position),
  foreign key (sandbox_id, proposal_id) references crm.proposals (sandbox_id, id) on delete cascade
);

alter table crm.proposal_line_items enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.proposal_line_items for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.proposal_line_items to authenticated;

-- A Proposal and its line items are saved together or not at all. These run
-- as the visitor (security invoker), so RLS still decides what they can touch.

-- A new Draft on a Deal, with the Deal's next version number.
create function crm.draft_proposal(deal uuid, scope text, term integer, items jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  drafted uuid;
begin
  -- Locks the Deal, so two Drafts at once can't take the same version.
  perform 1 from crm.deals d where d.id = deal for update;
  if not found then
    raise exception 'not_found';
  end if;

  insert into crm.proposals (deal_id, version, scope_summary, term_months)
  values (deal, (select coalesce(max(p.version), 0) + 1 from crm.proposals p where p.deal_id = deal), scope, term)
  returning id into drafted;

  insert into crm.proposal_line_items (proposal_id, position, service, monthly_fee)
  select drafted, item.position, item.value ->> 'service', (item.value ->> 'monthly_fee')::integer
    from jsonb_array_elements(items) with ordinality as item (value, position);

  return drafted;
end;
$$;

revoke execute on function crm.draft_proposal(uuid, text, integer, jsonb) from public;
grant execute on function crm.draft_proposal(uuid, text, integer, jsonb) to authenticated;

-- Replaces a Draft's scope, term and line items. A Proposal that has been sent
-- is a real offer and stays as it is.
create function crm.edit_proposal_draft(proposal uuid, scope text, term integer, items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_status crm.proposal_status;
begin
  select p.status into current_status from crm.proposals p where p.id = proposal for update;
  if not found then
    raise exception 'not_found';
  end if;
  if current_status <> 'Draft' then
    raise exception 'proposal_not_draft';
  end if;

  update crm.proposals p set scope_summary = scope, term_months = term where p.id = proposal;

  delete from crm.proposal_line_items i where i.proposal_id = proposal;
  insert into crm.proposal_line_items (proposal_id, position, service, monthly_fee)
  select proposal, item.position, item.value ->> 'service', (item.value ->> 'monthly_fee')::integer
    from jsonb_array_elements(items) with ordinality as item (value, position);
end;
$$;

revoke execute on function crm.edit_proposal_draft(uuid, text, integer, jsonb) from public;
grant execute on function crm.edit_proposal_draft(uuid, text, integer, jsonb) to authenticated;

-- Building a Sandbox now copies Proposals and their line items too. Otherwise
-- unchanged (see 20261124060000_visitor_day.sql).
create or replace function crm.fill_sandbox(target uuid, today date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_id uuid;
  shift interval;
  day_shift integer;
  utc_day date := (now() at time zone 'utc')::date;
begin
  -- No time zone is more than a day from UTC, so hold the claimed day to that.
  select id, now() - created_at,
         least(greatest(coalesce(today, utc_day), utc_day - 1), utc_day + 1) - (created_at at time zone 'utc')::date
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

  insert into crm.proposals (sandbox_id, id, deal_id, version, status, scope_summary, term_months, created_at, sent_at)
  select target, id, deal_id, version, status, scope_summary, term_months, created_at + shift, sent_at + shift
    from crm.proposals where sandbox_id = template_id;

  insert into crm.proposal_line_items (sandbox_id, id, proposal_id, position, service, monthly_fee)
  select target, id, proposal_id, position, service, monthly_fee
    from crm.proposal_line_items where sandbox_id = template_id;

  insert into crm.activities (sandbox_id, id, company_id, contact_id, deal_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, deal_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid, date) from public;

-- Retainers, and winning a Deal. A Retainer only ever comes from winning a
-- Deal, so visitors can read Retainers and correct an end date, nothing more.
-- Same Sandbox pattern as the other tables (see 20261124000200_teammates.sql).

-- The day a Deal was Won (and, with ticket 09, Lost), in the visitor's calendar.
alter table crm.deals add column closed_on date;
alter table crm.deals add constraint deals_closed_on check ((stage in ('Won', 'Lost')) = (closed_on is not null));

create table crm.retainers (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  company_id uuid not null,
  deal_id uuid not null,
  owner_id uuid not null,
  -- Whole US dollars a month, from the accepted Proposal.
  monthly_fee integer not null check (monthly_fee between 0 and 10000000),
  -- Calendar days; the Retainer runs through its end date.
  start_date date not null,
  end_date date not null,
  primary key (sandbox_id, id),
  -- Each won Deal starts one Retainer.
  unique (sandbox_id, deal_id),
  constraint retainers_dates check (end_date >= start_date and isfinite(end_date)),
  foreign key (sandbox_id, company_id) references crm.companies (sandbox_id, id) on delete cascade,
  -- The Deal is the Retainer's history, so it can't be deleted on its own.
  constraint retainers_deal_at_company
    foreign key (sandbox_id, company_id, deal_id) references crm.deals (sandbox_id, company_id, id),
  foreign key (sandbox_id, owner_id) references crm.teammates (sandbox_id, id)
);

alter table crm.retainers enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.retainers for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, update (end_date) on crm.retainers to authenticated;

-- A Deal becomes Won, and a Proposal Accepted, only inside win_deal (which
-- runs as its owner, not as the visitor). Won is final, and so is its day.
create function crm.guard_won_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.stage = 'Won' then
        raise exception 'only_by_winning';
      end if;
    elsif old.stage = 'Won' and (new.stage <> 'Won' or new.closed_on <> old.closed_on) then
      raise exception 'deal_already_won';
    elsif new.stage = 'Won' and old.stage <> 'Won' then
      raise exception 'only_by_winning';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function crm.guard_won_deal() from public;

create trigger guard_won_deal before insert or update of stage, closed_on on crm.deals
  for each row execute function crm.guard_won_deal();

-- What was accepted stays as it was, line items included. (When a whole
-- Company is deleted, the database cascades as the tables' owner, so these
-- guards let it through.)
create function crm.guard_accepted_proposal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  deal_stage crm.deal_stage;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if 'Accepted' in (old.status, new.status) then
    raise exception 'only_by_winning';
  end if;
  -- Waits for a win in progress, so nothing new is offered on a Won Deal.
  if tg_op = 'INSERT' or new.status = 'Sent' then
    select d.stage into deal_stage from crm.deals d
     where d.sandbox_id = new.sandbox_id and d.id = new.deal_id for share;
    if deal_stage = 'Won' then
      raise exception 'deal_already_won';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function crm.guard_accepted_proposal() from public;

create trigger guard_accepted_proposal before insert or update or delete on crm.proposals
  for each row execute function crm.guard_accepted_proposal();

create function crm.guard_accepted_line_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  proposal_status crm.proposal_status;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  -- An update can touch two Proposals: the one the line item was on and the one
  -- it moves to. The lock waits for a win in progress.
  for proposal_status in
    select p.status from crm.proposals p
     where (p.sandbox_id, p.id) in ((old.sandbox_id, old.proposal_id), (new.sandbox_id, new.proposal_id))
       for share
  loop
    if proposal_status = 'Accepted' then
      raise exception 'only_by_winning';
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

revoke execute on function crm.guard_accepted_line_items() from public;

create trigger guard_accepted_line_items before insert or update or delete on crm.proposal_line_items
  for each row execute function crm.guard_accepted_line_items();

-- The visitor's own today. No time zone is more than a day from UTC, so a
-- claimed day is held to that.
create function crm.visitor_day(claimed date)
returns date
language sql
stable
set search_path = ''
as $$
  select least(greatest(coalesce(claimed, utc_day), utc_day - 1), utc_day + 1)
    from (select (now() at time zone 'utc')::date as utc_day) as clock
$$;

revoke execute on function crm.visitor_day(date) from public;

-- The last day of a term: the day before the same date, months later.
create function crm.last_day(start_date date, months integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (start_date + make_interval(months => months) - interval '1 day')::date
$$;

revoke execute on function crm.last_day(date, integer) from public;

-- Wins a Deal: accepts its Sent Proposal, moves it to Won and starts the
-- Retainer from the Proposal's fee and term, all or nothing. Won is final, so
-- it can be told which Proposal was confirmed and refuse any other.
create function crm.win_deal(deal uuid, today date, proposal_version integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := crm.current_sandbox_id();
  won_on date := crm.visitor_day(win_deal.today);
  won crm.deals;
  accepted crm.proposals;
begin
  -- Locks the Deal, so it can only be won once.
  select * into won from crm.deals d where d.sandbox_id = target and d.id = win_deal.deal for update;
  if not found then
    raise exception 'not_found';
  end if;
  if won.stage = 'Won' then
    raise exception 'deal_already_won';
  end if;

  update crm.proposals p set status = 'Accepted'
   where p.sandbox_id = target and p.deal_id = won.id and p.status = 'Sent'
  returning * into accepted;
  if not found then
    raise exception 'won_needs_sent_proposal';
  end if;
  if accepted.version <> win_deal.proposal_version then
    raise exception 'proposal_changed';
  end if;

  update crm.deals d set stage = 'Won', closed_on = won_on where d.sandbox_id = target and d.id = won.id;

  insert into crm.retainers (sandbox_id, company_id, deal_id, owner_id, monthly_fee, start_date, end_date)
  values (
    target, won.company_id, won.id, won.owner_id,
    (select coalesce(sum(i.monthly_fee), 0) from crm.proposal_line_items i
      where i.sandbox_id = target and i.proposal_id = accepted.id),
    won_on,
    crm.last_day(won_on, accepted.term_months)
  );
end;
$$;

revoke execute on function crm.win_deal(uuid, date, integer) from public;
grant execute on function crm.win_deal(uuid, date, integer) to authenticated;

-- Building a Sandbox now copies Retainers too. Otherwise unchanged (see
-- 20261124070000_proposals.sql).
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
begin
  select id, now() - created_at, crm.visitor_day(today) - (created_at at time zone 'utc')::date
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
                         next_step, next_step_due, created_at, closed_on)
  select target, id, company_id, owner_id, title, kind, stage, estimated_monthly_value,
         next_step, next_step_due + day_shift, created_at + shift, closed_on + day_shift
    from crm.deals where sandbox_id = template_id;

  insert into crm.proposals (sandbox_id, id, deal_id, version, status, scope_summary, term_months, created_at, sent_at)
  select target, id, deal_id, version, status, scope_summary, term_months, created_at + shift, sent_at + shift
    from crm.proposals where sandbox_id = template_id;

  insert into crm.proposal_line_items (sandbox_id, id, proposal_id, position, service, monthly_fee)
  select target, id, proposal_id, position, service, monthly_fee
    from crm.proposal_line_items where sandbox_id = template_id;

  insert into crm.retainers (sandbox_id, id, company_id, deal_id, owner_id, monthly_fee, start_date, end_date)
  -- Months differ in length, so the end date comes from the term, not the shift.
  select target, r.id, r.company_id, r.deal_id, r.owner_id, r.monthly_fee, r.start_date + day_shift,
         crm.last_day(r.start_date + day_shift, p.term_months)
    from crm.retainers r
    join crm.proposals p on p.sandbox_id = r.sandbox_id and p.deal_id = r.deal_id and p.status = 'Accepted'
   where r.sandbox_id = template_id;

  insert into crm.activities (sandbox_id, id, company_id, contact_id, deal_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, deal_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid, date) from public;

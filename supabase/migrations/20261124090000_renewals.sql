-- Renewals: Deals that extend a Retainer instead of starting one.

alter table crm.retainers add constraint retainers_at_company unique (sandbox_id, company_id, id);

-- The Retainer a Renewal renews, always at the Deal's own Company. Deferrable
-- because Deals and Retainers point at each other (see fill_sandbox below).
alter table crm.deals add column renews_retainer_id uuid;
alter table crm.deals add constraint deals_renews_retainer
  foreign key (sandbox_id, company_id, renews_retainer_id) references crm.retainers (sandbox_id, company_id, id)
  deferrable initially immediate;
alter table crm.deals add constraint deals_renewal check ((kind = 'Renewal') = (renews_retainer_id is not null));

-- Renewing adds to the end date, and days are compared as text, so it stays a
-- four-digit year.
alter table crm.retainers add constraint retainers_end_date_in_range check (end_date <= '9999-12-31');

-- A second open Renewal would count the same work twice in the Pipeline.
create unique index deals_one_open_renewal on crm.deals (sandbox_id, renews_retainer_id)
  where renews_retainer_id is not null and stage not in ('Won', 'Lost');

-- A Won Deal also keeps its kind and the Retainer it renewed, and can't be
-- deleted on its own. (A New business one was already held by its Retainer.)
create or replace function crm.guard_won_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if new.stage = 'Won' then
      raise exception 'only_by_winning';
    end if;
  elsif old.stage = 'Won' then
    if tg_op = 'DELETE'
       or (new.stage, new.closed_on, new.kind, new.renews_retainer_id)
          is distinct from (old.stage, old.closed_on, old.kind, old.renews_retainer_id) then
      raise exception 'deal_already_won';
    end if;
  elsif tg_op = 'UPDATE' and new.stage = 'Won' then
    raise exception 'only_by_winning';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function crm.guard_won_deal() from public;

drop trigger guard_won_deal on crm.deals;
create trigger guard_won_deal before insert or delete or update of stage, closed_on, kind, renews_retainer_id on crm.deals
  for each row execute function crm.guard_won_deal();

-- Wins a Deal: accepts its Sent Proposal and moves it to Won, then starts a
-- Retainer from the Proposal's fee and term or, for a Renewal, extends the one
-- it renews. All or nothing. Won is final, so it can be told which Proposal was
-- confirmed and refuse any other.
create or replace function crm.win_deal(deal uuid, today date, proposal_version integer default null)
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
  fee integer;
  renewed crm.retainers;
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

  select coalesce(sum(i.monthly_fee), 0) into fee from crm.proposal_line_items i
   where i.sandbox_id = target and i.proposal_id = accepted.id;

  if won.kind = 'New business' then
    insert into crm.retainers (sandbox_id, company_id, deal_id, owner_id, monthly_fee, start_date, end_date)
    values (target, won.company_id, won.id, won.owner_id, fee, won_on, crm.last_day(won_on, accepted.term_months));
    return;
  end if;

  -- The new term follows the old one, or starts today if that has already ended.
  update crm.retainers r
     set monthly_fee = fee,
         end_date = crm.last_day(greatest(r.end_date + 1, won_on), accepted.term_months)
   where r.sandbox_id = target and r.id = won.renews_retainer_id
  returning * into renewed;

  insert into crm.activities (sandbox_id, company_id, deal_id, author_id, kind, text)
  select target, won.company_id, won.id, persona.id, 'Note',
         format('Renewed the Retainer "%s" through %s, at $%s a month.',
                started.title, to_char(renewed.end_date, 'Mon FMDD, YYYY'), to_char(fee, 'FM999,999,999'))
    from crm.teammates persona, crm.deals started
   where persona.sandbox_id = target and persona.is_persona
     and started.sandbox_id = target and started.id = renewed.deal_id;
end;
$$;

revoke execute on function crm.win_deal(uuid, date, integer) from public;
grant execute on function crm.win_deal(uuid, date, integer) to authenticated;

-- Building a Sandbox now copies which Retainer each Renewal renews. Otherwise
-- unchanged (see 20261124080000_retainers.sql).
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

  -- Deals and Retainers point at each other, so the links are checked once both are in.
  set constraints crm.deals_renews_retainer deferred;

  insert into crm.deals (sandbox_id, id, company_id, owner_id, title, kind, renews_retainer_id, stage, estimated_monthly_value,
                         next_step, next_step_due, created_at, closed_on)
  select target, id, company_id, owner_id, title, kind, renews_retainer_id, stage, estimated_monthly_value,
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

  set constraints crm.deals_renews_retainer immediate;

  insert into crm.activities (sandbox_id, id, company_id, contact_id, deal_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, deal_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid, date) from public;

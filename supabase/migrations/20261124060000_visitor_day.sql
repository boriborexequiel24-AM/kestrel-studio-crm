-- Sample due dates follow the visitor's own calendar. Building a Sandbox and
-- Start over take the visitor's today, because their day can be one ahead of
-- or behind UTC, and "Due tomorrow" has to mean tomorrow for them.

drop function crm.start_over();
drop function crm.open_sandbox(text, int);
drop function crm.fill_sandbox(uuid);

-- Copies the Template into a Sandbox. Moments shift by the time since the
-- anchor; calendar days (Next step due dates) shift so that the anchor's day
-- becomes the visitor's today. Internal: visitors can't call it.
create function crm.fill_sandbox(target uuid, today date)
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

  insert into crm.activities (sandbox_id, id, company_id, contact_id, deal_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, deal_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid, date) from public;

-- "Open the demo". Same rules as before (see 20261124030000_sandbox_openings.sql).
create function crm.open_sandbox(ip_hash text, daily_limit int, today date)
returns crm.sandboxes
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sandbox crm.sandboxes;
  -- The limit comes from the app's configuration; cap it so a caller can't lift it.
  max_per_day int := least(greatest(daily_limit, 0), 50);
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;

  select * into sandbox from crm.sandboxes where user_id = uid;
  if found then
    if sandbox.expires_at > now() then
      return sandbox;
    end if;
    raise exception 'sandbox_expired';
  end if;

  -- One network at a time, so two visitors on it can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('crm.sandbox_openings:' || open_sandbox.ip_hash));

  if (select count(*) from crm.sandbox_openings o
       where o.ip_hash = open_sandbox.ip_hash and o.opened_at > now() - interval '24 hours') >= max_per_day then
    raise exception 'sandbox_limit_reached';
  end if;

  insert into crm.sandboxes (user_id, expires_at)
  values (uid, now() + interval '24 hours')
  on conflict (user_id) do nothing
  returning * into sandbox;

  if not found then
    -- Another request (a double click) built it a moment ago.
    select * into sandbox from crm.sandboxes where user_id = uid;
    return sandbox;
  end if;

  insert into crm.sandbox_openings (ip_hash) values (open_sandbox.ip_hash);
  perform crm.fill_sandbox(sandbox.id, open_sandbox.today);
  return sandbox;
end;
$$;

revoke execute on function crm.open_sandbox(text, int, date) from public;
grant execute on function crm.open_sandbox(text, int, date) to authenticated;

-- Start over. Same rules as before (see 20261124020000_start_over.sql).
create function crm.start_over(today date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := crm.current_sandbox_id();
begin
  if target is null then
    raise exception 'no_live_sandbox';
  end if;

  -- Deleting Companies cascades to everything that belongs to them. Teammates
  -- go last, since Companies, Deals and Activities point at them. A new table
  -- that doesn't hang off a Company needs its own delete here; the row-count
  -- tests catch a miss.
  delete from crm.companies where sandbox_id = target;
  delete from crm.teammates where sandbox_id = target;

  perform crm.fill_sandbox(target, start_over.today);
end;
$$;

revoke execute on function crm.start_over(date) from public;
grant execute on function crm.start_over(date) to authenticated;

-- Start over: replace a Sandbox's data with a fresh copy of the Template,
-- keeping the same Sandbox row (so its expiry, and later its AI limit, carry over).

-- Dates now shift by the gap between the anchor and the moment of copying, so
-- a Sandbox that starts over looks as current as a new one.
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
  select id, now() - created_at
    into template_id, shift
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

  insert into crm.activities (sandbox_id, id, company_id, contact_id, author_id, kind, occurred_at, text)
  select target, id, company_id, contact_id, author_id, kind, occurred_at + shift, text
    from crm.activities where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid) from public;

-- Empties the visitor's live Sandbox and copies the Template in again.
create function crm.start_over()
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

  -- Deleting Companies cascades to everything that belongs to them
  -- (Contacts, Activities, and later Deals). Teammates go last, since
  -- Companies and Activities point at them. A new table that doesn't hang off
  -- a Company needs its own delete here; the row-count tests catch a miss.
  delete from crm.companies where sandbox_id = target;
  delete from crm.teammates where sandbox_id = target;

  perform crm.fill_sandbox(target);
end;
$$;

revoke execute on function crm.start_over() from public;
grant execute on function crm.start_over() to authenticated;

-- For tests and the operator: rows per Sandbox-owned table, found from the
-- catalog so every table with a sandbox_id is covered without listing it.
create function crm.sandbox_row_counts(target uuid)
returns table (table_name text, row_count bigint)
language plpgsql
stable
set search_path = ''
as $$
declare
  owned record;
begin
  for owned in
    select c.table_name::text as name
      from information_schema.columns c
      join information_schema.tables t using (table_schema, table_name)
     where c.table_schema = 'crm' and c.column_name = 'sandbox_id' and t.table_type = 'BASE TABLE'
     order by c.table_name
  loop
    table_name := owned.name;
    execute format('select count(*) from crm.%I where sandbox_id = $1', owned.name) into row_count using target;
    return next;
  end loop;
end;
$$;

revoke execute on function crm.sandbox_row_counts(uuid) from public;
grant execute on function crm.sandbox_row_counts(uuid) to service_role;

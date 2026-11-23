-- The hourly cleanup (ADR 0001, ADR 0002): expired Sandboxes, every row they
-- own, and their anonymous users disappear inside the database, with nothing
-- outside the app involved.
--
-- The Supabase project is shared with other demos, so this only ever deletes
-- users that are certainly this app's: owners of expired Sandboxes, and
-- anonymous users tagged `kestrel-crm` at sign-in that never got a Sandbox.

create function crm.clean_up_expired_sandboxes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  -- Deleting the user cascades to their Sandbox, and the Sandbox cascades to
  -- every row it owns.
  with expired as (
    select user_id from crm.sandboxes
     where not is_template and expires_at <= now()
  ), gone as (
    delete from auth.users u using expired e
     where u.id = e.user_id and u.is_anonymous
    returning 1
  )
  select count(*) into removed from gone;

  -- An expired Sandbox whose user was already gone or isn't anonymous.
  delete from crm.sandboxes where not is_template and expires_at <= now();

  -- This app's anonymous users that never got a Sandbox (a failed open, or a
  -- network at its daily limit), once they are a day old.
  delete from auth.users u
   where u.is_anonymous
     and u.raw_user_meta_data ->> 'app' = 'kestrel-crm'
     and u.created_at < now() - interval '24 hours'
     and not exists (select 1 from crm.sandboxes s where s.user_id = u.id);

  -- Network records only matter for the last 24 hours.
  delete from crm.sandbox_openings where opened_at < now() - interval '24 hours';

  return removed;
end;
$$;

revoke execute on function crm.clean_up_expired_sandboxes() from public;
grant execute on function crm.clean_up_expired_sandboxes() to service_role;

create extension if not exists pg_cron;

-- At 7 minutes past every hour. Scheduling by name replaces any earlier version.
select cron.schedule(
  'crm-clean-up-expired-sandboxes',
  '7 * * * *',
  $$select crm.clean_up_expired_sandboxes()$$
);

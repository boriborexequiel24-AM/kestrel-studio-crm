-- Two Start overs at once, or one while something is being saved, used to trip
-- over each other's rows. Now they take turns: Start overs of one Sandbox queue
-- up, and one that meets a save lets it finish. Otherwise unchanged (see
-- 20261124060000_visitor_day.sql).
create or replace function crm.start_over(today date)
returns void
language plpgsql
security definer
set search_path = ''
set lock_timeout = 0
as $$
declare
  target uuid := crm.current_sandbox_id();
  attempts integer := 0;
begin
  if target is null then
    raise exception 'no_live_sandbox';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('crm.start_over:' || target, 0));

  -- A save may hold a Deal and wait for the Sandbox while this holds the Sandbox
  -- and waits for the Deal. This gives way well before Postgres would call that
  -- a deadlock (1 second) and fail one of them: the block's locks are let go,
  -- the save goes through, and this tries again.
  perform set_config('lock_timeout', '200ms', true);
  loop
    begin
      -- New rows wait for this, since their foreign keys share-lock the Sandbox.
      perform 1 from crm.sandboxes s where s.id = target for update;
      if not found then
        raise exception 'no_live_sandbox';
      end if;

      -- Deleting Companies cascades to everything that belongs to them. Teammates
      -- go last, since Companies, Deals and Activities point at them. A new table
      -- that doesn't hang off a Company needs its own delete here; the row-count
      -- tests catch a miss.
      delete from crm.companies where sandbox_id = target;
      delete from crm.teammates where sandbox_id = target;

      perform crm.fill_sandbox(target, start_over.today);
      return;
    exception when lock_not_available or deadlock_detected then
      attempts := attempts + 1;
      if attempts = 15 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function crm.start_over(date) from public;
grant execute on function crm.start_over(date) to authenticated;

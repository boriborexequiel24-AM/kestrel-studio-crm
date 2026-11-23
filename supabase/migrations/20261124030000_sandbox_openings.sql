-- The daily Sandbox limit per network. Each new Sandbox records a salted hash
-- of the visitor's IP address (never the address itself). Visitors can't read
-- or write this table; only the functions below and the operator can.

create table crm.sandbox_openings (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  opened_at timestamptz not null default now()
);

create index sandbox_openings_recent on crm.sandbox_openings (ip_hash, opened_at);

alter table crm.sandbox_openings enable row level security;
-- No policies and no grants to visitors: RLS denies everything to them.

-- "Open the demo": returns the visitor's live Sandbox, or builds a new one if
-- their network hasn't opened `daily_limit` Sandboxes in the last 24 hours.
-- Raises `sandbox_expired` when this visitor's Sandbox has run out, and
-- `sandbox_limit_reached` when their network is at the limit.
--
-- What this trusts: the app's server reports the visitor's network (as a
-- salted hash) and the limit. The database only ever sees the server's own
-- address, so it can't check either. The anon key never reaches browsers in
-- this app, and anyone calling the API directly is still held to Supabase's
-- own limit on anonymous sign-ins per IP address.
drop function crm.open_sandbox();

create function crm.open_sandbox(ip_hash text, daily_limit int)
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
  perform crm.fill_sandbox(sandbox.id);
  return sandbox;
end;
$$;

revoke execute on function crm.open_sandbox(text, int) from public;
grant execute on function crm.open_sandbox(text, int) to authenticated;

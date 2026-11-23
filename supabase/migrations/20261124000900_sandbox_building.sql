-- Copies the Template into a Sandbox, shifting every date by the gap between
-- the Template's anchor and the Sandbox's creation. Internal: only other
-- functions here call it; visitors can't. Every Sandbox-owned table needs a
-- copy step here, with its date columns shifted.
create function crm.fill_sandbox(target uuid)
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
    raise exception 'The Template is missing; run the Template seed.';
  end if;

  insert into crm.teammates (sandbox_id, id, first_name, last_name, role, initials, is_persona)
  select target, id, first_name, last_name, role, initials, is_persona
    from crm.teammates where sandbox_id = template_id;

  insert into crm.companies (sandbox_id, id, name, industry, city, owner_id, added_at)
  select target, id, name, industry, city, owner_id, added_at + shift
    from crm.companies where sandbox_id = template_id;
end;
$$;

revoke execute on function crm.fill_sandbox(uuid) from public;

-- "Open the demo": returns the visitor's live Sandbox, building it from the
-- Template the first time. Raises `sandbox_expired` when this visitor's
-- Sandbox has run out, so the app can start a fresh anonymous session.
create function crm.open_sandbox()
returns crm.sandboxes
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sandbox crm.sandboxes;
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

  insert into crm.sandboxes (user_id, expires_at)
  values (uid, now() + interval '24 hours')
  on conflict (user_id) do nothing
  returning * into sandbox;

  if not found then
    -- Another request (a double click) built it a moment ago.
    select * into sandbox from crm.sandboxes where user_id = uid;
    return sandbox;
  end if;

  perform crm.fill_sandbox(sandbox.id);
  return sandbox;
end;
$$;

revoke execute on function crm.open_sandbox() from public;
grant execute on function crm.open_sandbox() to authenticated;

-- Sandboxes (ADR 0001): each anonymous visitor gets one private Sandbox that
-- lasts 24 hours. One reserved row, the Template, holds the sample data every
-- Sandbox is copied from; its created_at is the anchor that sample dates are
-- written against.

create table crm.sandboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint sandbox_or_template check (
    (is_template and user_id is null and expires_at is null)
    or (not is_template and user_id is not null and expires_at is not null)
  )
);

create unique index sandboxes_one_template on crm.sandboxes (is_template) where is_template;

alter table crm.sandboxes enable row level security;

create policy "Visitors see their own Sandbox"
  on crm.sandboxes for select to authenticated
  using (user_id = (select auth.uid()));

grant select on crm.sandboxes to authenticated;

-- The signed-in visitor's live Sandbox, or null. Every Sandbox-owned table's
-- RLS policy compares its sandbox_id with this, so an expired Sandbox shows
-- nothing even before the cleanup job removes it.
create function crm.current_sandbox_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from crm.sandboxes
  where user_id = auth.uid() and expires_at > now()
$$;

revoke execute on function crm.current_sandbox_id() from public;
grant execute on function crm.current_sandbox_id() to authenticated;

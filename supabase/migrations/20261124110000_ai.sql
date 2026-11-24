-- AI usage and the limits that keep the public demo from draining the OpenAI
-- credits, plus saved Company summaries.

create type crm.ai_feature as enum ('summary', 'draft', 'ask');
grant usage on type crm.ai_feature to authenticated;

-- One row per AI action, written before the provider is called. It outlives its
-- Sandbox: the demo-wide limit still has to count it after the Sandbox is cleaned
-- up, and the cost of each action has to stay measurable.
create table crm.ai_usage (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid references crm.sandboxes (id) on delete set null,
  feature crm.ai_feature not null,
  started_at timestamptz not null default now(),
  -- Filled in once the provider has answered; empty if it never did.
  finished_at timestamptz,
  -- Bounded, so a visitor calling the API directly can't log nonsense that would
  -- skew what an action seems to cost.
  input_tokens integer check (input_tokens between 0 and 1000000),
  output_tokens integer check (output_tokens between 0 and 1000000),
  cost_usd numeric(12, 6) check (cost_usd between 0 and 5)
);

create index ai_usage_by_sandbox on crm.ai_usage (sandbox_id);
create index ai_usage_by_time on crm.ai_usage (started_at);

alter table crm.ai_usage enable row level security;

create policy "The visitor's own AI actions"
  on crm.ai_usage for select to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()));

-- Visitors only read it. The functions below write it.
grant select on crm.ai_usage to authenticated;

-- Starts an AI action: checks both limits and writes the usage row, or raises
-- `ai_sandbox_limit_reached` or `ai_daily_cap_reached`.
--
-- What this trusts: the app's server passes the limits and, below, the cost. The
-- anon key never reaches browsers in this app. Someone who had it could start
-- actions up to the ceilings here (lib/crm/ai.ts has the same numbers) and use up
-- the demo-wide limit, but never reach the provider or spend credits.
create function crm.begin_ai_action(feature crm.ai_feature, sandbox_limit integer, daily_cap integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := crm.current_sandbox_id();
  started uuid;
begin
  if target is null then
    raise exception 'no_live_sandbox';
  end if;

  -- One at a time, so actions started together can't slip past a limit.
  perform pg_advisory_xact_lock(hashtext('crm.ai_usage'));

  if (select count(*) from crm.ai_usage u where u.sandbox_id = target) >= least(greatest(sandbox_limit, 0), 50) then
    raise exception 'ai_sandbox_limit_reached';
  end if;
  if (select count(*) from crm.ai_usage u
       where u.started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')
     >= least(greatest(daily_cap, 0), 10000) then
    raise exception 'ai_daily_cap_reached';
  end if;

  insert into crm.ai_usage (sandbox_id, feature) values (target, begin_ai_action.feature) returning id into started;
  return started;
end;
$$;

revoke execute on function crm.begin_ai_action(crm.ai_feature, integer, integer) from public;
grant execute on function crm.begin_ai_action(crm.ai_feature, integer, integer) to authenticated;

-- Completes an AI action with what it used. Once only.
create function crm.finish_ai_action(action uuid, input_tokens integer, output_tokens integer, cost_usd numeric default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update crm.ai_usage u
     set finished_at = now(),
         input_tokens = finish_ai_action.input_tokens,
         output_tokens = finish_ai_action.output_tokens,
         cost_usd = finish_ai_action.cost_usd
   where u.id = finish_ai_action.action and u.sandbox_id = crm.current_sandbox_id() and u.finished_at is null
$$;

revoke execute on function crm.finish_ai_action(uuid, integer, integer, numeric) from public;
grant execute on function crm.finish_ai_action(uuid, integer, integer, numeric) to authenticated;

-- The saved summary of a Company. Same Sandbox pattern as the other tables.
create table crm.ai_summaries (
  sandbox_id uuid not null default crm.current_sandbox_id() references crm.sandboxes (id) on delete cascade,
  company_id uuid not null,
  lines text[] not null check (
    cardinality(lines) = 3 and array_position(lines, null) is null and length(array_to_string(lines, '')) <= 2000
  ),
  -- A fingerprint of the Activities it covers. A different one now means it's out of date.
  activities_seen text not null,
  written_at timestamptz not null default now(),
  primary key (sandbox_id, company_id),
  foreign key (sandbox_id, company_id) references crm.companies (sandbox_id, id) on delete cascade
);

alter table crm.ai_summaries enable row level security;

create policy "Rows of the visitor's Sandbox"
  on crm.ai_summaries for all to authenticated
  using (sandbox_id = (select crm.current_sandbox_id()))
  with check (sandbox_id = (select crm.current_sandbox_id()));

grant select, insert, update, delete on crm.ai_summaries to authenticated;

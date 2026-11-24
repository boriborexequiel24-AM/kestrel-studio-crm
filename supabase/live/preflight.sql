-- Run this first, on the live project. It only reads.
-- Every row should say "ok" or "info". Stop and look at any "STOP" row.
--
-- The last three checks matter because turning on anonymous sign-ins makes every
-- visitor `authenticated`: nothing outside `crm` may give that role more than
-- the public key (`anon`) already has.
with app_schemas as (
  select n.oid, n.nspname from pg_namespace n
   where n.nspname !~ '^pg_'
     and n.nspname not in ('information_schema', 'auth', 'cron', 'crm', 'extensions', 'graphql', 'graphql_public', 'net',
                           'pgbouncer', 'pgmq', 'realtime', 'storage', 'supabase_functions', 'supabase_migrations', 'vault')
),
more_than_anon as (
  select format('%I.%I (%s)', s.nspname, c.relname, p.privilege) as what
    from app_schemas s
    join pg_class c on c.relnamespace = s.oid and c.relkind in ('r', 'p', 'v', 'm', 'f')
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(privilege)
   where (has_table_privilege('authenticated', c.oid, p.privilege) and not has_table_privilege('anon', c.oid, p.privilege))
      or (p.privilege <> 'DELETE'
          and exists (select 1 from pg_attribute a
                       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                         and has_column_privilege('authenticated', c.oid, a.attnum, p.privilege)
                         and not has_column_privilege('anon', c.oid, a.attnum, p.privilege)))
  union all
  select f.oid::regprocedure::text || ' (EXECUTE)'
    from app_schemas s
    join pg_proc f on f.pronamespace = s.oid
   where has_function_privilege('authenticated', f.oid, 'EXECUTE') and not has_function_privilege('anon', f.oid, 'EXECUTE')
),
signed_in_policies as (
  select format('%I.%I: %s', schemaname, tablename, policyname) as what
    from pg_policies
   where schemaname not in ('crm', 'cron', 'realtime', 'pgmq')
     and (('authenticated' = any (roles) and not 'anon' = any (roles))
          or concat(qual, ' ', with_check) ~ 'auth\.|request\.jwt')
),
checks (place, check_name, state, detail) as (
  select 1, 'Postgres 15 or newer',
         case when current_setting('server_version_num')::int >= 150000 then 'ok' else 'STOP' end, current_setting('server_version')
  union all
  select 2, 'the crm schema is not there yet',
         case when to_regnamespace('crm') is null then 'ok' else 'STOP' end, coalesce(to_regnamespace('crm')::text, '')
  union all
  select 3, 'pg_cron is enabled',
         case when exists (select 1 from pg_extension where extname = 'pg_cron') then 'ok' else 'STOP' end, ''
  union all
  select 5, 'auth.users can mark anonymous users',
         case when exists (select 1 from pg_attribute where attrelid = 'auth.users'::regclass and attname = 'is_anonymous') then 'ok' else 'STOP' end, ''
  union all
  select 6, 'nothing else runs when someone signs in',
         case when count(*) = 0 then 'ok' else 'STOP' end, coalesce(string_agg(tgname, ', '), '')
    from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal
  union all
  select 7, 'other schemas in this project', 'info', coalesce(string_agg(nspname, ', ' order by nspname), 'none') from app_schemas
  union all
  select 8, 'signed-in visitors get no more rights than the public key',
         case when count(*) = 0 then 'ok' else 'STOP' end, coalesce(string_agg(what, '; ' order by what), '') from more_than_anon
  union all
  select 9, 'no policy treats signed-in visitors differently',
         case when count(*) = 0 then 'ok' else 'STOP' end, coalesce(string_agg(what, '; ' order by what), '') from signed_in_policies
)
select check_name, state, detail from checks order by place;

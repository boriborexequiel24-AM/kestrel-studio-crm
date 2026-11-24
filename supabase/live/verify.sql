-- Run this after setup.sql, on the live project. It only reads.
-- Every row should say "ok".
with checks (place, check_name, state, detail) as (
  select 1, 'every crm table has row-level security on',
         case when bool_and(c.relrowsecurity) then 'ok' else 'STOP' end, count(*) || ' tables'
    from pg_class c where c.relnamespace = 'crm'::regnamespace and c.relkind in ('r', 'p')
  union all
  select 2, 'the public key can reach nothing in crm',
         case when not has_schema_privilege('anon', 'crm', 'USAGE') then 'ok' else 'STOP' end, ''
  union all
  select 3, 'no crm function is open to everyone',
         case when count(*) = 0 then 'ok' else 'STOP' end, coalesce(string_agg(f.oid::regprocedure::text, ', '), '')
    from pg_proc f
   where f.pronamespace = 'crm'::regnamespace
     and (f.proacl is null or exists (select 1 from aclexplode(f.proacl) g where g.grantee = 0))
  union all
  select 4, 'the Template is loaded',
         case when count(*) = 1 then 'ok' else 'STOP' end,
         (select string_agg(t.table_name || ' ' || t.row_count, ', ' order by t.table_name)
            from crm.sandboxes s cross join lateral crm.sandbox_row_counts(s.id) t where s.is_template and t.row_count > 0)
    from crm.sandboxes where is_template
  union all
  select 5, 'the hourly cleanup is scheduled',
         case when count(*) filter (where active) = 1 then 'ok' else 'STOP' end, coalesce(string_agg(schedule, ', '), '')
    from cron.job where jobname = 'crm-clean-up-expired-sandboxes'
)
select check_name, state, detail from checks order by place;

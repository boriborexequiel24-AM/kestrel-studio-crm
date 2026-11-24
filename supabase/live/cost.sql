-- What AI actions really cost, by feature. It only reads.
select feature,
       count(*) as actions,
       count(cost_usd) as with_cost,
       round(avg(cost_usd), 5) as average_usd,
       round(max(cost_usd), 5) as highest_usd,
       round(sum(cost_usd), 4) as total_usd
  from crm.ai_usage
 group by rollup (feature)
 order by feature nulls last;

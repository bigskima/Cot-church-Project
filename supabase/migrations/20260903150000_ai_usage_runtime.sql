-- Reliable AI usage aggregation for organization-scoped budget enforcement.
-- Service-role callers can aggregate in SQL without fetching a capped result set.

create or replace function public.ai_usage_totals(
  target_organization_id uuid,
  target_capability_code text,
  period_start timestamptz
)
returns table(
  request_count bigint,
  token_count bigint,
  cost_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::bigint as request_count,
    coalesce(sum(coalesce(r.input_tokens, 0) + coalesce(r.output_tokens, 0)), 0)::bigint as token_count,
    coalesce(sum(coalesce(r.estimated_cost_minor, 0)), 0)::bigint as cost_minor
  from public.ai_generation_runs r
  where r.organization_id = target_organization_id
    and r.created_at >= period_start
    and (target_capability_code is null or r.capability_code = target_capability_code);
$$;

revoke all on function public.ai_usage_totals(uuid,text,timestamptz) from public;
grant execute on function public.ai_usage_totals(uuid,text,timestamptz) to service_role;

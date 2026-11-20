insert into public.ai_capabilities(code,name,risk_level,requires_human_review,description)
values (
  'admin.help',
  'Admin guidance',
  'low',
  false,
  'Explain Platform Administration pages, settings and workflows in clear operational language.'
)
on conflict(code) do update set
  name=excluded.name,
  risk_level=excluded.risk_level,
  requires_human_review=excluded.requires_human_review,
  description=excluded.description;

create or replace function public.ai_usage_totals(
  target_organization_id uuid,
  target_capability_code text,
  period_start timestamptz
)
returns table(request_count bigint, token_count bigint, cost_minor bigint)
language sql
stable
security definer
set search_path=''
as $$
  select
    count(*)::bigint,
    coalesce(sum(coalesce(r.input_tokens,0)+coalesce(r.output_tokens,0)),0)::bigint,
    coalesce(sum(coalesce(r.estimated_cost_minor,0)),0)::bigint
  from public.ai_generation_runs r
  where r.organization_id is not distinct from target_organization_id
    and r.created_at>=period_start
    and (target_capability_code is null or r.capability_code=target_capability_code);
$$;

revoke all on function public.ai_usage_totals(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ai_usage_totals(uuid,text,timestamptz) to service_role;

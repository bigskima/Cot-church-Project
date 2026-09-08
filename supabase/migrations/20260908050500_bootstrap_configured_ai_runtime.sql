-- Bootstrap an active configured AI provider into a usable runtime.
-- Routing remains database-driven and can be replaced from Platform Administration.

update public.ai_providers
set configuration = coalesce(configuration, '{}'::jsonb) ||
  jsonb_build_object(
    'defaultModelKey', coalesce(nullif(configuration->>'defaultModelKey',''), 'gemini-3.8-flash'),
    'defaultModelName', coalesce(nullif(configuration->>'defaultModelName',''), 'Gemini 3.8 Flash'),
    'defaultContextWindow', coalesce((configuration->>'defaultContextWindow')::int, 1048576)
  )
where code='gemini'
  and status='active';

with provider as (
  select
    id,
    configuration->>'defaultModelKey' as model_key,
    coalesce(configuration->>'defaultModelName', configuration->>'defaultModelKey') as display_name,
    nullif(configuration->>'defaultContextWindow','')::int as context_window
  from public.ai_providers
  where status='active'
    and nullif(configuration->>'defaultModelKey','') is not null
), inserted as (
  insert into public.ai_models(
    provider_id,model_key,display_name,context_window,is_active,configuration
  )
  select
    id,model_key,display_name,context_window,true,jsonb_build_object('managedBy','provider-bootstrap')
  from provider
  on conflict(provider_id,model_key)
  do update set
    display_name=excluded.display_name,
    context_window=excluded.context_window,
    is_active=true,
    configuration=coalesce(public.ai_models.configuration,'{}'::jsonb) || excluded.configuration
  returning id,provider_id,model_key
), selected_model as (
  select id from inserted order by model_key limit 1
)
insert into public.ai_routes(
  organization_id,capability_code,primary_model_id,fallback_model_ids,timeout_ms,max_retries,is_active
)
select null,cap.code,sm.id,'{}'::uuid[],30000,1,true
from selected_model sm
cross join (values
  ('assistant.answer'),
  ('admin.help'),
  ('sermon.summarize'),
  ('translate.text'),
  ('content.moderate'),
  ('pastoral.triage'),
  ('admin.insight')
) as cap(code)
on conflict(organization_id,capability_code)
do update set
  primary_model_id=excluded.primary_model_id,
  fallback_model_ids=excluded.fallback_model_ids,
  timeout_ms=excluded.timeout_ms,
  max_retries=excluded.max_retries,
  is_active=true,
  updated_at=now();

-- A generation model is not an embedding model. Remove only the accidental
-- bootstrap route if search.embed currently points at Gemini Flash.
delete from public.ai_routes r
using public.ai_models m
where r.primary_model_id=m.id
  and r.organization_id is null
  and r.capability_code='search.embed'
  and m.model_key='gemini-3.8-flash';

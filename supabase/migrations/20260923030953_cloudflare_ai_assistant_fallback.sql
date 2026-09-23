alter table public.ai_providers
  drop constraint if exists ai_providers_code_check;

alter table public.ai_providers
  add constraint ai_providers_code_check
  check (code = any (array['openai'::text,'gemini'::text,'anthropic'::text,'cloudflare'::text]));

insert into public.ai_providers(
  code,name,adapter_version,status,secret_reference,configuration
)
values (
  'cloudflare',
  'Cloudflare Workers AI',
  '1.0',
  'active',
  'CLOUDFLARE_AI_TOKEN',
  '{"accountIdSecret":"CLOUDFLARE_ACCOUNT_ID","managedBy":"assistant-reliability-fallback"}'::jsonb
)
on conflict (code) do update set
  name=excluded.name,
  adapter_version=excluded.adapter_version,
  status=excluded.status,
  secret_reference=excluded.secret_reference,
  configuration=excluded.configuration,
  updated_at=now();

insert into public.ai_models(
  provider_id,model_key,display_name,input_cost_per_million,output_cost_per_million,
  context_window,is_active,configuration
)
select
  p.id,
  '@cf/meta/llama-3.2-3b-instruct',
  'Cloudflare Llama 3.2 3B Instruct',
  0,0,131072,true,
  '{"managedBy":"assistant-reliability-fallback"}'::jsonb
from public.ai_providers p
where p.code='cloudflare'
on conflict (provider_id,model_key) do update set
  display_name=excluded.display_name,
  input_cost_per_million=excluded.input_cost_per_million,
  output_cost_per_million=excluded.output_cost_per_million,
  context_window=excluded.context_window,
  is_active=excluded.is_active,
  configuration=excluded.configuration;

with cloudflare_model as (
  select m.id
  from public.ai_models m
  join public.ai_providers p on p.id=m.provider_id
  where p.code='cloudflare'
    and m.model_key='@cf/meta/llama-3.2-3b-instruct'
),
gemini_fallback as (
  select m.id
  from public.ai_models m
  join public.ai_providers p on p.id=m.provider_id
  where p.code='gemini'
    and m.model_key='gemini-2.5-flash'
)
update public.ai_routes r
set
  fallback_model_ids=array[
    (select id from cloudflare_model),
    (select id from gemini_fallback)
  ]::uuid[],
  max_retries=0,
  updated_at=now()
where r.organization_id is null
  and r.capability_code='assistant.answer'
  and r.is_active=true;

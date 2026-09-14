-- Keep the organization owner role aligned with its documented full organization authority.
do $$
declare
  owner_role_id uuid;
begin
  select id into owner_role_id
  from public.roles
  where code = 'owner'
  limit 1;

  if owner_role_id is not null then
    insert into public.role_permissions (role_id, permission_code)
    select owner_role_id, permission_code
    from unnest(array[
      'finance.manage',
      'finance.read',
      'testimonies.manage',
      'testimonies.review',
      'pastoral.followups.receive',
      'prayer.intake.receive',
      'prayer.pastoral.receive',
      'prayer.team.receive'
    ]::text[]) as permissions(permission_code)
    on conflict do nothing;
  end if;
end $$;

-- Browser voice recording uses Opus/WebM. The API already accepts audio/webm,
-- so keep Storage policy in sync with the signed-upload contract.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(coalesce(allowed_mime_types, '{}'::text[]) || array['audio/webm']::text[]) as values(mime)
)
where id in ('community-public-media', 'content-media');

-- Keep one lower-demand Gemini model available as a route fallback. AI routing
-- remains database driven; the app and gateway do not hardcode a provider.
insert into public.ai_models (
  provider_id,
  model_key,
  display_name,
  input_cost_per_million,
  output_cost_per_million,
  context_window,
  is_active,
  configuration
)
select
  provider.id,
  'gemini-2.5-flash',
  'Gemini 2.5 Flash',
  0,
  0,
  1048576,
  true,
  jsonb_build_object('managedBy', 'reliability-fallback')
from public.ai_providers provider
where provider.code = 'gemini'
on conflict (provider_id, model_key) do update
set is_active = true,
    display_name = excluded.display_name,
    context_window = excluded.context_window,
    configuration = coalesce(public.ai_models.configuration, '{}'::jsonb) || excluded.configuration;

update public.ai_routes route
set fallback_model_ids = case
      when fallback.id = any(coalesce(route.fallback_model_ids, '{}'::uuid[])) then coalesce(route.fallback_model_ids, '{}'::uuid[])
      else coalesce(route.fallback_model_ids, '{}'::uuid[]) || fallback.id
    end,
    max_retries = greatest(route.max_retries, 1),
    updated_at = now()
from public.ai_models fallback,
     public.ai_providers fallback_provider,
     public.ai_models primary_model,
     public.ai_providers primary_provider
where fallback_provider.id = fallback.provider_id
  and fallback_provider.code = 'gemini'
  and fallback.model_key = 'gemini-2.5-flash'
  and fallback.is_active = true
  and primary_model.id = route.primary_model_id
  and primary_provider.id = primary_model.provider_id
  and primary_provider.code = 'gemini'
  and route.is_active = true;
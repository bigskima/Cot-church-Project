-- COT launch streaming routes:
--   General COT -> public YouTube Live source
--   Expression Live -> Agora RTC
--   Mux retained but disabled until deliberately funded/enabled.

insert into public.streaming_providers (
  code, name, adapter_version, capabilities, is_active
)
values
  (
    'youtube',
    'YouTube Live',
    '2026-09-18',
    array['public_live_discovery','embedded_playback','scheduled_live_discovery']::text[],
    true
  ),
  (
    'agora',
    'Agora RTC',
    '2026-09-18',
    array['webrtc','rtc_broadcast','token_auth','low_latency','expression_private']::text[],
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  adapter_version = excluded.adapter_version,
  capabilities = excluded.capabilities,
  is_active = excluded.is_active,
  updated_at = now();

update public.streaming_providers
set is_active = false,
    updated_at = now()
where code = 'mux';

update public.streaming_provider_configs c
set is_active = false,
    is_default = false,
    configuration = coalesce(c.configuration, '{}'::jsonb)
      || jsonb_build_object('launchStatus','disabled_until_funded'),
    updated_at = now()
from public.streaming_providers p
where c.provider_id = p.id
  and p.code = 'mux';

insert into public.streaming_provider_configs (
  organization_id,
  provider_id,
  secret_reference,
  webhook_secret_reference,
  signing_key_reference,
  configuration,
  is_default,
  is_active
)
select
  null,
  p.id,
  'STREAMING_YOUTUBE_DATA_API',
  'STREAMING_YOUTUBE_DATA_API',
  null,
  jsonb_build_object(
    'routingScopes', jsonb_build_array('general'),
    'channelId', '',
    'includeUpcoming', true
  ),
  false,
  false
from public.streaming_providers p
where p.code = 'youtube'
on conflict (organization_id, provider_id) do update
set
  secret_reference = excluded.secret_reference,
  webhook_secret_reference = excluded.webhook_secret_reference,
  signing_key_reference = excluded.signing_key_reference,
  configuration = public.streaming_provider_configs.configuration
    || jsonb_build_object(
      'routingScopes', jsonb_build_array('general'),
      'includeUpcoming', true
    ),
  updated_at = now();

insert into public.streaming_provider_configs (
  organization_id,
  provider_id,
  secret_reference,
  webhook_secret_reference,
  signing_key_reference,
  configuration,
  is_default,
  is_active
)
select
  null,
  p.id,
  'STREAMING_AGORA_PRIMARY',
  'STREAMING_AGORA_PRIMARY',
  null,
  jsonb_build_object(
    'routingScopes', jsonb_build_array('expression'),
    'tokenTtlSeconds', 3600,
    'cohostAuthenticationEnabled', false,
    'freeTierMonthlyParticipantMinutes', 10000,
    'usageWarningPercent', 85
  ),
  false,
  false
from public.streaming_providers p
where p.code = 'agora'
on conflict (organization_id, provider_id) do update
set
  secret_reference = excluded.secret_reference,
  webhook_secret_reference = excluded.webhook_secret_reference,
  signing_key_reference = excluded.signing_key_reference,
  configuration = public.streaming_provider_configs.configuration
    || jsonb_build_object(
      'routingScopes', jsonb_build_array('expression'),
      'tokenTtlSeconds', coalesce((public.streaming_provider_configs.configuration->>'tokenTtlSeconds')::int, 3600),
      'cohostAuthenticationEnabled', coalesce((public.streaming_provider_configs.configuration->>'cohostAuthenticationEnabled')::boolean, false),
      'freeTierMonthlyParticipantMinutes', 10000,
      'usageWarningPercent', coalesce((public.streaming_provider_configs.configuration->>'usageWarningPercent')::int, 85)
    ),
  updated_at = now();

create table if not exists public.general_live_source_cache (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  provider_config_id uuid not null
    references public.streaming_provider_configs(id) on delete cascade,
  provider_code text not null default 'youtube',
  channel_id text not null,
  external_video_id text,
  stream_payload jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  expires_at timestamptz,
  refresh_claimed_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint general_live_source_cache_provider_code_check
    check (provider_code in ('youtube')),
  constraint general_live_source_cache_payload_check
    check (jsonb_typeof(stream_payload) = 'object')
);

comment on table public.general_live_source_cache is
  'Server-only cache for General COT external live-source discovery. Client roles have no table privileges.';

create index if not exists general_live_source_cache_provider_config_idx
  on public.general_live_source_cache(provider_config_id);

create index if not exists general_live_source_cache_expiry_idx
  on public.general_live_source_cache(expires_at);

alter table public.general_live_source_cache enable row level security;

revoke all on table public.general_live_source_cache from public;
revoke all on table public.general_live_source_cache from anon;
revoke all on table public.general_live_source_cache from authenticated;
grant select, insert, update, delete on table public.general_live_source_cache to service_role;

create or replace function public.claim_general_live_source_refresh(
  target_organization_id uuid,
  target_provider_config_id uuid,
  target_channel_id text,
  claim_seconds integer default 20
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  claimed boolean := false;
  safe_claim_seconds integer;
begin
  if target_organization_id is null
     or target_provider_config_id is null
     or nullif(btrim(target_channel_id), '') is null then
    return false;
  end if;

  safe_claim_seconds := greatest(5, least(coalesce(claim_seconds, 20), 60));

  insert into public.general_live_source_cache (
    organization_id,
    provider_config_id,
    provider_code,
    channel_id,
    stream_payload,
    expires_at,
    refresh_claimed_until
  )
  values (
    target_organization_id,
    target_provider_config_id,
    'youtube',
    btrim(target_channel_id),
    '{}'::jsonb,
    now(),
    null
  )
  on conflict (organization_id) do nothing;

  update public.general_live_source_cache
  set
    provider_config_id = target_provider_config_id,
    provider_code = 'youtube',
    channel_id = btrim(target_channel_id),
    refresh_claimed_until = now() + make_interval(secs => safe_claim_seconds),
    updated_at = now()
  where organization_id = target_organization_id
    and (expires_at is null or expires_at <= now())
    and (refresh_claimed_until is null or refresh_claimed_until <= now());

  get diagnostics claimed = row_count;
  return claimed;
end;
$function$;

revoke all on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) from public;
revoke all on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) from anon;
revoke all on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) from authenticated;
grant execute on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) to service_role;

create or replace function public.write_general_live_source_cache(
  target_organization_id uuid,
  target_provider_config_id uuid,
  target_channel_id text,
  target_external_video_id text,
  target_stream_payload jsonb,
  target_ttl_seconds integer,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  safe_ttl_seconds integer;
begin
  if target_organization_id is null
     or target_provider_config_id is null
     or nullif(btrim(target_channel_id), '') is null then
    raise exception 'Invalid General live cache target';
  end if;

  if target_stream_payload is null
     or jsonb_typeof(target_stream_payload) <> 'object' then
    raise exception 'General live cache payload must be a JSON object';
  end if;

  safe_ttl_seconds := greatest(30, least(coalesce(target_ttl_seconds, 300), 3600));

  insert into public.general_live_source_cache (
    organization_id,
    provider_config_id,
    provider_code,
    channel_id,
    external_video_id,
    stream_payload,
    last_checked_at,
    expires_at,
    refresh_claimed_until,
    last_error,
    updated_at
  )
  values (
    target_organization_id,
    target_provider_config_id,
    'youtube',
    btrim(target_channel_id),
    nullif(btrim(target_external_video_id), ''),
    target_stream_payload,
    now(),
    now() + make_interval(secs => safe_ttl_seconds),
    null,
    target_error,
    now()
  )
  on conflict (organization_id) do update
  set
    provider_config_id = excluded.provider_config_id,
    provider_code = 'youtube',
    channel_id = excluded.channel_id,
    external_video_id = excluded.external_video_id,
    stream_payload = excluded.stream_payload,
    last_checked_at = excluded.last_checked_at,
    expires_at = excluded.expires_at,
    refresh_claimed_until = null,
    last_error = excluded.last_error,
    updated_at = now();
end;
$function$;

revoke all on function public.write_general_live_source_cache(uuid,uuid,text,text,jsonb,integer,text) from public;
revoke all on function public.write_general_live_source_cache(uuid,uuid,text,text,jsonb,integer,text) from anon;
revoke all on function public.write_general_live_source_cache(uuid,uuid,text,text,jsonb,integer,text) from authenticated;
grant execute on function public.write_general_live_source_cache(uuid,uuid,text,text,jsonb,integer,text) to service_role;

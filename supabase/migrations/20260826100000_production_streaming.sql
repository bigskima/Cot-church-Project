-- Production streaming control-plane. Video bytes are sent directly to configured providers, never Supabase.
alter type public.stream_status add value if not exists 'provisioning';
alter type public.stream_status add value if not exists 'ready';
alter type public.stream_status add value if not exists 'processing';
alter type public.stream_status add value if not exists 'replay_ready';
alter type public.stream_status add value if not exists 'failed';

insert into public.permissions(code,name,description,category) values
 ('streams.broadcast','Broadcast live video','Provision ingest endpoints and control authorized broadcasts.','media'),
 ('streams.moderate','Moderate live rooms','Moderate live chat, questions, polls, mute and ban participants.','media'),
 ('streams.recordings.manage','Manage recordings','Create clips and manage replay assets.','media')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

create table public.streaming_providers(
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[a-z][a-z0-9_]{1,39}$'), name text not null,
 adapter_version text not null, capabilities text[] not null default '{}', is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.streaming_provider_configs(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 provider_id uuid not null references public.streaming_providers(id) on delete restrict, secret_reference text not null,
 webhook_secret_reference text not null, signing_key_reference text, configuration jsonb not null default '{}' check(jsonb_typeof(configuration)='object'),
 is_default boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(organization_id,provider_id), unique(id,organization_id)
);
alter table public.live_streams add column if not exists provider_config_id uuid references public.streaming_provider_configs(id) on delete restrict;
alter table public.live_streams add column if not exists provider_broadcast_id text;
alter table public.live_streams add column if not exists provider_asset_id text;
alter table public.live_streams add column if not exists latency_mode text not null default 'standard' check(latency_mode in('standard','reduced','low'));
alter table public.live_streams add column if not exists reconnect_window_seconds integer not null default 60 check(reconnect_window_seconds between 0 and 1800);
alter table public.live_streams add column if not exists lifecycle_error text;
alter table public.live_streams add column if not exists provider_metadata jsonb not null default '{}' check(jsonb_typeof(provider_metadata)='object');
create unique index live_stream_provider_broadcast_unique on public.live_streams(provider_config_id,provider_broadcast_id) where provider_broadcast_id is not null;

create table public.live_access_grants(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 stream_id uuid not null, profile_id uuid references public.profiles(id) on delete cascade, anonymous_session_hash text,
 token_jti_hash text not null unique, scope text not null default 'playback', issued_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, last_used_at timestamptz, ip_hash text, user_agent_hash text,
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade,
 check(profile_id is not null or anonymous_session_hash is not null), check(expires_at>issued_at)
);
create table public.live_recordings(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 stream_id uuid not null, provider_asset_id text not null, playback_id text, status text not null check(status in('preparing','ready','errored','deleted')),
 duration_seconds numeric, aspect_ratio text, max_resolution text, audio_only_url text, download_url text, metadata jsonb not null default '{}',
 created_at timestamptz not null default now(), ready_at timestamptz, updated_at timestamptz not null default now(),
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade, unique(stream_id,provider_asset_id)
);
create table public.live_clips(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 recording_id uuid not null references public.live_recordings(id) on delete cascade, provider_clip_id text, title text not null,
 start_seconds numeric not null check(start_seconds>=0), end_seconds numeric not null check(end_seconds>start_seconds), status text not null default 'queued' check(status in('queued','processing','ready','failed')),
 playback_id text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.live_webhook_events(
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.streaming_providers(id) on delete restrict,
 provider_event_id text not null, event_type text not null, signature_valid boolean not null, payload_sha256 text not null,
 stream_id uuid references public.live_streams(id) on delete set null, received_at timestamptz not null default now(), processed_at timestamptz,
 processing_error text, unique(provider_id,provider_event_id)
);
create table public.live_moderation_actions(
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
 stream_id uuid not null, target_profile_id uuid references public.profiles(id), moderator_profile_id uuid not null references public.profiles(id),
 action text not null check(action in('hide_message','mute','unmute','ban','unban','slow_mode')), reason text, expires_at timestamptz, created_at timestamptz not null default now(),
 foreign key(stream_id,organization_id) references public.live_streams(id,organization_id) on delete cascade
);

create index live_access_active_idx on public.live_access_grants(stream_id,profile_id,expires_at) where revoked_at is null;
create index live_recordings_stream_idx on public.live_recordings(stream_id,status,created_at desc);
create index live_webhooks_unprocessed_idx on public.live_webhook_events(received_at) where processed_at is null;
create index live_moderation_target_idx on public.live_moderation_actions(stream_id,target_profile_id,created_at desc);
create trigger streaming_providers_updated before update on public.streaming_providers for each row execute function public.set_updated_at();
create trigger streaming_configs_updated before update on public.streaming_provider_configs for each row execute function public.set_updated_at();
create trigger live_recordings_updated before update on public.live_recordings for each row execute function public.set_updated_at();
create trigger live_clips_updated before update on public.live_clips for each row execute function public.set_updated_at();

alter table public.streaming_providers enable row level security; alter table public.streaming_provider_configs enable row level security;
alter table public.live_access_grants enable row level security; alter table public.live_recordings enable row level security;
alter table public.live_clips enable row level security; alter table public.live_webhook_events enable row level security; alter table public.live_moderation_actions enable row level security;
create policy streaming_providers_authenticated_read on public.streaming_providers for select to authenticated using(is_active);
create policy streaming_configs_admin on public.streaming_provider_configs for select to authenticated using(organization_id is not null and public.has_permission(organization_id,'integrations.manage'));
create policy live_grants_self on public.live_access_grants for select to authenticated using(profile_id=auth.uid());
create policy recordings_scoped_read on public.live_recordings for select to authenticated using(public.can_access_stream(stream_id));
create policy clips_scoped_read on public.live_clips for select to authenticated using(exists(select 1 from public.live_recordings r where r.id=recording_id and public.can_access_stream(r.stream_id)));
create policy moderation_admin_read on public.live_moderation_actions for select to authenticated using(public.has_permission(organization_id,'streams.moderate'));

-- Seed the implemented adapter; credentials remain external and are referenced by environment/Vault name only.
insert into public.streaming_providers(code,name,adapter_version,capabilities) values('mux','Mux Video','2026-08-01',array['rtmp_ingest','srt_ingest','adaptive_hls','low_latency','signed_playback','recording','clips','analytics','webhooks'])
on conflict(code) do update set adapter_version=excluded.adapter_version,capabilities=excluded.capabilities,is_active=true;

revoke all on public.streaming_provider_configs,public.live_access_grants,public.live_webhook_events from anon,authenticated;
grant select on public.streaming_providers to authenticated;
grant select on public.live_recordings,public.live_clips,public.live_moderation_actions to authenticated;

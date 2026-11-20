-- Database-driven platform feature availability and per-organization overrides.
-- The application consumes effective state from the backend; feature state is not
-- compiled into the mobile or admin clients.

create table if not exists public.platform_feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,95}$'),
  name text not null check (char_length(trim(name)) between 1 and 160),
  category text not null check (category ~ '^[a-z][a-z0-9_]{1,63}$'),
  description text not null default '',
  global_enabled boolean not null default false,
  rollout_percentage smallint not null default 100 check (rollout_percentage between 0 and 100),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.organization_feature_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null references public.platform_feature_flags(key) on delete cascade,
  enabled boolean,
  rollout_percentage smallint check (rollout_percentage is null or rollout_percentage between 0 and 100),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (organization_id, feature_key)
);

create index if not exists organization_feature_overrides_feature_idx
  on public.organization_feature_overrides(feature_key, organization_id);

create trigger platform_feature_flags_updated
before update on public.platform_feature_flags
for each row execute function public.set_updated_at();

create trigger organization_feature_overrides_updated
before update on public.organization_feature_overrides
for each row execute function public.set_updated_at();

alter table public.platform_feature_flags enable row level security;
alter table public.organization_feature_overrides enable row level security;

-- Clients may read feature definitions, but only active organizations may read their
-- own override rows. Writes are performed through Level-1 platform APIs.
create policy platform_feature_flags_read on public.platform_feature_flags
for select to anon, authenticated using (true);

create policy organization_feature_overrides_member_read on public.organization_feature_overrides
for select to authenticated using (public.is_organization_member(organization_id));

insert into public.platform_feature_flags(key, name, category, description, global_enabled, rollout_percentage)
values
  ('social_community_feed', 'Community Social Feed', 'social', 'Church-scoped posts, reactions, comments, and community discovery.', true, 100),
  ('livestream_realtime_chat', 'Livestream Real-Time Chat', 'media', 'Interactive chat and reactions attached to live broadcasts.', true, 100),
  ('ai_sermon_intelligence', 'AI Sermon Intelligence', 'intelligence', 'Provider-routed transcription, summarisation, extraction, and review workflows for sermon media.', true, 100),
  ('giving_reconciliation_engine', 'Giving Reconciliation Engine', 'finance', 'Donation receipts, provider event processing, refunds, and reconciliation workflows.', true, 100),
  ('prayer_request_ministry', 'Prayer Request Ministry', 'ministry', 'Prayer request intake and permission-scoped ministry workflows.', true, 100)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

comment on table public.platform_feature_flags is
  'Level-1 database-driven feature catalog. global_enabled and rollout_percentage provide platform defaults.';
comment on table public.organization_feature_overrides is
  'Per-organization overrides layered over platform feature defaults.';

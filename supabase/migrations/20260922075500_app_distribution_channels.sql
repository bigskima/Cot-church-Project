-- Public app distribution registry. The browser/native clients never need a hosting-provider URL.
-- The public API exposes only active release metadata; writes stay server/admin controlled.

create table if not exists public.app_distribution_channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('android','ios')),
  channel text not null,
  distribution text not null check (distribution in ('apk','play_store','app_store')),
  download_url text not null,
  version_name text,
  version_code bigint,
  minimum_supported_version_code bigint,
  release_notes text,
  remind_after_hours integer not null default 24 check (remind_after_hours between 1 and 720),
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform, channel)
);

alter table public.app_distribution_channels enable row level security;

insert into public.app_distribution_channels (
  platform,
  channel,
  distribution,
  download_url,
  version_name,
  release_notes,
  remind_after_hours,
  is_active
)
values (
  'android',
  'testing',
  'apk',
  'https://github.com/bigskima/Cot-church-Project/releases/download/cot-android-latest/COT.apk',
  '1.0.0',
  'Church testing build distributed directly as an Android APK.',
  24,
  true
)
on conflict (platform, channel) do update
set distribution = excluded.distribution,
    download_url = excluded.download_url,
    release_notes = excluded.release_notes,
    is_active = true,
    updated_at = now();

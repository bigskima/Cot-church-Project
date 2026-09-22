-- Provider-agnostic visual assets for Daily Bible, Daily Quote and Daily Devotional.
-- Generated images are stored once and reused on Home + dedicated screens.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'daily-visuals',
  'daily-visuals',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.cot_image_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'active' check (status in ('active','disabled','degraded')),
  secret_reference text not null check (char_length(secret_reference) between 1 and 120),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.cot_image_providers(code,name,status,secret_reference,configuration)
values (
  'cloudflare',
  'Cloudflare Workers AI',
  'active',
  'CLOUDFLARE_AI_TOKEN',
  jsonb_build_object(
    'accountIdSecret','CLOUDFLARE_ACCOUNT_ID',
    'model','@cf/black-forest-labs/flux-1-schnell',
    'width',1200,
    'height',525
  )
)
on conflict (code) do update
set name=excluded.name,
    configuration=public.cot_image_providers.configuration || excluded.configuration,
    updated_at=now();

create table if not exists public.cot_daily_visuals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visual_date date not null,
  content_kind text not null check (content_kind in ('bible','quote','devotional')),
  image_url text,
  storage_path text,
  image_source text not null default 'ai' check (image_source in ('ai','upload','inherited')),
  provider_code text references public.cot_image_providers(code) on update cascade on delete set null,
  prompt text not null default '' check (char_length(prompt) <= 4000),
  status text not null default 'ready' check (status in ('queued','generating','ready','failed')),
  last_error text not null default '' check (char_length(last_error) <= 1000),
  generated_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, visual_date, content_kind),
  check ((status <> 'ready') or (image_url is not null and char_length(image_url) > 0))
);

create index if not exists cot_daily_visuals_org_date_idx
  on public.cot_daily_visuals(organization_id,visual_date,content_kind);

alter table public.cot_image_providers enable row level security;
alter table public.cot_daily_visuals enable row level security;

revoke all on table public.cot_image_providers from anon, authenticated;
revoke all on table public.cot_daily_visuals from anon, authenticated;
grant all on table public.cot_image_providers to service_role;
grant all on table public.cot_daily_visuals to service_role;

do $$ begin
  alter publication supabase_realtime add table public.cot_daily_visuals;
exception when duplicate_object then null;
end $$;

comment on table public.cot_daily_visuals is
  'One stored visual per organization/date for Daily Bible, COT Daily Quote and Daily Devotional. Generated once, reused everywhere.';
comment on table public.cot_image_providers is
  'Provider registry for COT visual generation. Credentials are referenced by environment secret name, never stored in rows.';

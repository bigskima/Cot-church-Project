-- COT engagement hub: home spotlight banners, configurable forms and event interest.
-- These records are accessed through the engagement-hub Edge Function so the
-- ministry permission model stays server-side and members never receive broad table writes.

create table if not exists public.cot_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','closed','hidden')),
  fields jsonb not null default '[]'::jsonb,
  submit_label text not null default 'Submit',
  success_message text not null default 'Thank you. Your response has been received.',
  requires_auth boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists cot_forms_org_status_idx
  on public.cot_forms(organization_id,status,updated_at desc);

create table if not exists public.cot_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.cot_forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  values jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cot_form_submissions_form_idx
  on public.cot_form_submissions(form_id,status,created_at desc);

create table if not exists public.cot_home_banners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  image_url text,
  destination_type text not null default 'none'
    check (destination_type in ('none','route','external','event','announcement','form')),
  destination_value text,
  status text not null default 'draft' check (status in ('draft','published','hidden','archived')),
  priority integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cot_home_banners_active_idx
  on public.cot_home_banners(organization_id,status,priority desc,created_at desc);

create table if not exists public.cot_event_interests (
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id,profile_id)
);

create index if not exists cot_event_interests_org_event_idx
  on public.cot_event_interests(organization_id,event_id,created_at desc);

alter table public.events
  add column if not exists response_form_id uuid references public.cot_forms(id) on delete set null;

alter table public.announcements
  add column if not exists response_form_id uuid references public.cot_forms(id) on delete set null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'home-banners',
  'home-banners',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

alter table public.cot_forms enable row level security;
alter table public.cot_form_submissions enable row level security;
alter table public.cot_home_banners enable row level security;
alter table public.cot_event_interests enable row level security;

comment on table public.cot_forms is 'Schema-driven ministry forms rendered inside COT.';
comment on table public.cot_home_banners is 'Official General COT spotlight banners shown alongside daily Bible/devotional content.';
comment on table public.cot_event_interests is 'Member interest responses kept separate from formal event registrations.';

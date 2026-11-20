-- Reusable ministry-only AI artwork storage and audit trail.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'ministry-generated-media',
  'ministry-generated-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.cot_ministry_generated_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  use_case text not null check (use_case in (
    'event_banner',
    'announcement_banner',
    'home_banner',
    'form_banner',
    'sermon_artwork',
    'library_cover'
  )),
  image_url text not null check (char_length(image_url) > 0),
  storage_path text not null check (char_length(storage_path) > 0),
  provider_code text references public.cot_image_providers(code) on update cascade on delete set null,
  model text not null default '',
  prompt text not null default '' check (char_length(prompt) <= 5000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cot_ministry_generated_media_org_created_idx
  on public.cot_ministry_generated_media(organization_id,created_at desc);

alter table public.cot_ministry_generated_media enable row level security;
revoke all on table public.cot_ministry_generated_media from anon, authenticated;
grant all on table public.cot_ministry_generated_media to service_role;

comment on table public.cot_ministry_generated_media is
  'AI-generated content artwork created by authorized ministry roles. Real-person identity photos remain upload-only.';

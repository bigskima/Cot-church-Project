create table public.general_home_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null default 'COT UPDATE',
  message text not null,
  status text not null default 'draft',
  is_enabled boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  background_color text not null default '#082F49',
  text_color text not null default '#F8FAFC',
  accent_color text not null default '#38BDF8',
  link_label text null,
  link_path text null,
  priority smallint not null default 0,
  published_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint general_home_notices_status_check check (status in ('draft', 'published')),
  constraint general_home_notices_label_length_check check (char_length(label) between 1 and 60),
  constraint general_home_notices_message_length_check check (char_length(message) between 1 and 800),
  constraint general_home_notices_dates_check check (ends_at is null or ends_at > starts_at),
  constraint general_home_notices_background_color_check check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint general_home_notices_text_color_check check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint general_home_notices_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint general_home_notices_link_path_check check (link_path is null or link_path = '/general' or link_path like '/general/%'),
  constraint general_home_notices_link_label_length_check check (link_label is null or char_length(link_label) <= 80)
);

create index general_home_notices_active_idx
  on public.general_home_notices (organization_id, priority desc, starts_at desc)
  where status = 'published' and is_enabled = true;

create index general_home_notices_manage_idx
  on public.general_home_notices (organization_id, created_at desc);

alter table public.general_home_notices enable row level security;
revoke all on table public.general_home_notices from anon, authenticated;
grant select, insert, update, delete on table public.general_home_notices to service_role;

comment on table public.general_home_notices is 'General COT-only moving header notices. Public reads and authorized management are mediated by the general-home-notices Edge Function.';

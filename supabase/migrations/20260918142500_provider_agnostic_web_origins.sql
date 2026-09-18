-- Provider-agnostic browser-origin allowlist for COT web clients.
-- Hosting providers are configuration data, never runtime code branches.

create table if not exists public.platform_web_origins (
  id uuid primary key default gen_random_uuid(),
  origin_pattern text not null unique
    check (
      char_length(trim(origin_pattern)) between 1 and 255
      and (
        trim(origin_pattern) = '*'
        or trim(origin_pattern) ~ '^https?://[^/[:space:]]+$'
      )
    ),
  label text not null default '' check (char_length(label) <= 160),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

drop trigger if exists platform_web_origins_updated on public.platform_web_origins;
create trigger platform_web_origins_updated
before update on public.platform_web_origins
for each row execute function public.set_updated_at();

alter table public.platform_web_origins enable row level security;

revoke all on table public.platform_web_origins from anon, authenticated;
grant select on table public.platform_web_origins to service_role;

insert into public.platform_web_origins(origin_pattern, label, is_active)
values
  ('https://cot-pr54-live-preview.netlify.app', 'COT Netlify preview primary alias', true),
  ('https://*--cot-pr54-live-preview.netlify.app', 'COT Netlify deploy previews', true)
on conflict (origin_pattern) do update
set label = excluded.label,
    is_active = excluded.is_active,
    updated_at = now();

comment on table public.platform_web_origins is
  'Server-only provider-agnostic browser-origin allowlist. Supports exact origins and wildcard host patterns; clients have no direct table privileges.';

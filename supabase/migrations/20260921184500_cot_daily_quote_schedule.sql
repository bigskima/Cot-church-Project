-- Daily COT quote scheduling and ministry overrides.
-- Daily Bible Scripture continues to use bible_daily_schedule / resolve_daily_scripture.
-- This table stores only the original COT reflection quote layer so Bible text is
-- never duplicated or silently altered.

create table if not exists public.cot_daily_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_date date not null,
  body text not null check (char_length(body) between 1 and 500),
  source_reference text not null default '' check (char_length(source_reference) <= 120),
  theme text not null default 'general' check (char_length(theme) <= 80),
  source text not null default 'ministry' check (source in ('ministry','provisioned')),
  status text not null default 'published' check (status in ('published','hidden')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_date)
);

create index if not exists cot_daily_quotes_org_date_idx
  on public.cot_daily_quotes(organization_id, quote_date desc);

alter table public.cot_daily_quotes enable row level security;

revoke all on table public.cot_daily_quotes from anon, authenticated;
grant all on table public.cot_daily_quotes to service_role;

comment on table public.cot_daily_quotes is
  'Original COT daily reflection quotes inspired by Scripture. Bible verses themselves remain in the Bible daily schedule/runtime.';

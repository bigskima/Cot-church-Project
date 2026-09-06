create table if not exists public.onboarding_experiences (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('member')),
  version text not null unique check (char_length(trim(version)) between 3 and 80),
  policy_version text not null check (char_length(trim(policy_version)) between 3 and 80),
  title text not null check (char_length(trim(title)) between 1 and 160),
  subtitle text not null default '' check (char_length(subtitle) <= 500),
  policy_title text not null check (char_length(trim(policy_title)) between 1 and 160),
  policy_summary text not null check (char_length(trim(policy_summary)) between 1 and 1200),
  policy_points jsonb not null default '[]'::jsonb check (jsonb_typeof(policy_points) = 'array'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists onboarding_experiences_one_active_per_audience
  on public.onboarding_experiences(audience)
  where is_active;

create table if not exists public.profile_onboarding_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null references public.onboarding_experiences(id) on delete cascade,
  policy_accepted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, experience_id),
  check (completed_at is null or policy_accepted_at is not null)
);

create index if not exists profile_onboarding_progress_experience_idx
  on public.profile_onboarding_progress(experience_id, completed_at);

drop trigger if exists onboarding_experiences_updated on public.onboarding_experiences;
create trigger onboarding_experiences_updated
before update on public.onboarding_experiences
for each row execute function public.set_updated_at();

drop trigger if exists profile_onboarding_progress_updated on public.profile_onboarding_progress;
create trigger profile_onboarding_progress_updated
before update on public.profile_onboarding_progress
for each row execute function public.set_updated_at();

alter table public.onboarding_experiences enable row level security;
alter table public.profile_onboarding_progress enable row level security;

revoke all on table public.onboarding_experiences from anon, authenticated;
revoke all on table public.profile_onboarding_progress from anon, authenticated;

insert into public.onboarding_experiences (
  audience,
  version,
  policy_version,
  title,
  subtitle,
  policy_title,
  policy_summary,
  policy_points,
  is_active
) values (
  'member',
  'cot-member-2026-09-v1',
  'cot-community-policy-2026-09-v1',
  'Welcome to City of Transformation',
  'A short guided tour of public COT, your member identity and any Expression spaces you belong to.',
  'Before you continue',
  'COT is a church community space. Public content remains open to everyone, while member interactions and Expression spaces use your signed-in identity and the access granted to you.',
  jsonb_build_array(
    'Treat people, prayer requests and community conversations with care and respect.',
    'Expression content stays inside the Expression unless it is deliberately published to a public COT surface.',
    'Your account permissions come from church membership and assigned responsibilities; the app does not grant roles by itself.',
    'Use reporting and pastoral channels for sensitive concerns rather than exposing private information publicly.'
  ),
  true
)
on conflict (version) do update set
  policy_version = excluded.policy_version,
  title = excluded.title,
  subtitle = excluded.subtitle,
  policy_title = excluded.policy_title,
  policy_summary = excluded.policy_summary,
  policy_points = excluded.policy_points,
  is_active = excluded.is_active;

update public.onboarding_experiences
set is_active = (version = 'cot-member-2026-09-v1')
where audience = 'member';

comment on table public.onboarding_experiences is
  'Versioned member onboarding and policy presentation. Clients consume the active experience through the onboarding Edge Function.';
comment on table public.profile_onboarding_progress is
  'Per-profile acknowledgement and completion state for each onboarding experience version.';

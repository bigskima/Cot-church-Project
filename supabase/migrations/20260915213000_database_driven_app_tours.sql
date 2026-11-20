create table if not exists public.app_tour_experiences (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('general', 'expression')),
  version text not null check (char_length(trim(version)) between 3 and 80),
  title text not null check (char_length(trim(title)) between 1 and 160),
  subtitle text not null default '' check (char_length(subtitle) <= 600),
  auto_start boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, version)
);

create unique index if not exists app_tour_experiences_one_active_per_scope
  on public.app_tour_experiences(scope)
  where is_active;

create table if not exists public.app_tour_steps (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.app_tour_experiences(id) on delete cascade,
  step_order integer not null check (step_order between 0 and 200),
  target_key text not null check (char_length(trim(target_key)) between 2 and 120),
  route_template text not null check (char_length(trim(route_template)) between 1 and 300),
  title text not null check (char_length(trim(title)) between 1 and 180),
  body text not null check (char_length(trim(body)) between 1 and 1200),
  icon text not null default 'sparkles-outline' check (char_length(trim(icon)) between 1 and 80),
  placement text not null default 'auto' check (placement in ('auto', 'above', 'below', 'center')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experience_id, step_order)
);

create index if not exists app_tour_steps_experience_order_idx
  on public.app_tour_steps(experience_id, step_order);

create table if not exists public.profile_app_tour_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null references public.app_tour_experiences(id) on delete cascade,
  scope_key text not null check (char_length(trim(scope_key)) between 1 and 120),
  current_step integer not null default 0 check (current_step between 0 and 200),
  started_at timestamptz,
  completed_at timestamptz,
  snoozed_until timestamptz,
  never_remind boolean not null default false,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, experience_id, scope_key)
);

create index if not exists profile_app_tour_due_idx
  on public.profile_app_tour_progress(profile_id, completed_at, never_remind, snoozed_until);

create index if not exists profile_app_tour_experience_idx
  on public.profile_app_tour_progress(experience_id, scope_key);

drop trigger if exists app_tour_experiences_updated on public.app_tour_experiences;
create trigger app_tour_experiences_updated
before update on public.app_tour_experiences
for each row execute function public.set_updated_at();

drop trigger if exists app_tour_steps_updated on public.app_tour_steps;
create trigger app_tour_steps_updated
before update on public.app_tour_steps
for each row execute function public.set_updated_at();

drop trigger if exists profile_app_tour_progress_updated on public.profile_app_tour_progress;
create trigger profile_app_tour_progress_updated
before update on public.profile_app_tour_progress
for each row execute function public.set_updated_at();

alter table public.app_tour_experiences enable row level security;
alter table public.app_tour_steps enable row level security;
alter table public.profile_app_tour_progress enable row level security;

revoke all on table public.app_tour_experiences from anon, authenticated;
revoke all on table public.app_tour_steps from anon, authenticated;
revoke all on table public.profile_app_tour_progress from anon, authenticated;

with general_tour as (
  insert into public.app_tour_experiences (scope, version, title, subtitle, auto_start, is_active)
  values (
    'general',
    'general-cot-tour-2026-09-v2',
    'Find your way around General COT',
    'A short guided walk through the real screens you will use most often.',
    true,
    true
  )
  on conflict (scope, version) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    auto_start = excluded.auto_start,
    is_active = excluded.is_active
  returning id
), selected_general as (
  select id from general_tour
  union all
  select id from public.app_tour_experiences where scope = 'general' and version = 'general-cot-tour-2026-09-v2' limit 1
)
insert into public.app_tour_steps (experience_id, step_order, target_key, route_template, title, body, icon, placement)
select id, step_order, target_key, route_template, title, body, icon, placement
from selected_general
cross join (values
  (0, 'general.topbar', '/general', 'General COT starts here', 'Search, notifications, your profile and church-wide tools stay in this top area. The tour points to the real controls, not a sample screen.', 'globe-outline', 'below'),
  (1, 'general.home.actions', '/general', 'Share without hunting for a button', 'Use these quick actions to create a post or voice update. They always publish through the scope and permissions attached to your account.', 'create-outline', 'below'),
  (2, 'general.home.feed', '/general', 'This is the public COT feed', 'Posts, Reels, videos, sermons, events and announcements are arranged here as focused discovery instead of one endless mixed stream.', 'newspaper-outline', 'above'),
  (3, 'general.reels.scope', '/general/reels', 'Reels keep you inside General COT', 'This label shows that you are watching public General COT Reels. Swipe vertically to move between videos.', 'play-outline', 'below'),
  (4, 'general.messages.header', '/general/chat', 'Messages are one-to-one', 'Search a username or member name here to start a private COT conversation. Group discussions remain inside Groups and Expressions.', 'chatbubbles-outline', 'below'),
  (5, 'general.profile.header', '/general/profile', 'Your COT lives under You', 'Profile, Expressions, saved content, notifications, prayer, giving and the option to restart this tour are grouped here.', 'person-circle-outline', 'below')
) as steps(step_order, target_key, route_template, title, body, icon, placement)
on conflict (experience_id, step_order) do update set
  target_key = excluded.target_key,
  route_template = excluded.route_template,
  title = excluded.title,
  body = excluded.body,
  icon = excluded.icon,
  placement = excluded.placement;

with expression_tour as (
  insert into public.app_tour_experiences (scope, version, title, subtitle, auto_start, is_active)
  values (
    'expression',
    'expression-tour-2026-09-v2',
    'Get to know this Expression',
    'This tour starts only after you enter an Expression you belong to.',
    true,
    true
  )
  on conflict (scope, version) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    auto_start = excluded.auto_start,
    is_active = excluded.is_active
  returning id
), selected_expression as (
  select id from expression_tour
  union all
  select id from public.app_tour_experiences where scope = 'expression' and version = 'expression-tour-2026-09-v2' limit 1
)
insert into public.app_tour_steps (experience_id, step_order, target_key, route_template, title, body, icon, placement)
select id, step_order, target_key, route_template, title, body, icon, placement
from selected_expression
cross join (values
  (0, 'expression.header', '/expressions/{expressionId}', 'You are inside an Expression', 'The header keeps the current Expression visible. Use the menu on the left for Expression-only routes and the switch control on the right to move between Expressions.', 'people-circle-outline', 'below'),
  (1, 'expression.home.hero', '/expressions/{expressionId}', 'This home belongs to this Expression', 'Private community content, announcements, media and activity stay inside this Expression unless something is deliberately published to General COT.', 'home-outline', 'below'),
  (2, 'expression.home.quick-links', '/expressions/{expressionId}', 'Use the quick routes', 'Announcements, prayer, events, polls, giveaways, Groups and discussion are reachable here without scrolling through the whole home feed.', 'grid-outline', 'above'),
  (3, 'expression.feed.header', '/expressions/{expressionId}/feed', 'The Expression feed works like General COT', 'Posts use the same familiar card style and interaction pattern, but everything here stays scoped to this Expression.', 'newspaper-outline', 'below'),
  (4, 'expression.discussion.header', '/expressions/{expressionId}/chat', 'General discussion is shared by the Expression', 'Use this for the main Expression conversation. Search messages, jump to pinned items and use moderation tools only when your role allows it.', 'chatbubbles-outline', 'below')
) as steps(step_order, target_key, route_template, title, body, icon, placement)
on conflict (experience_id, step_order) do update set
  target_key = excluded.target_key,
  route_template = excluded.route_template,
  title = excluded.title,
  body = excluded.body,
  icon = excluded.icon,
  placement = excluded.placement;

update public.app_tour_experiences
set is_active = (version = 'general-cot-tour-2026-09-v2')
where scope = 'general';

update public.app_tour_experiences
set is_active = (version = 'expression-tour-2026-09-v2')
where scope = 'expression';

update public.onboarding_experiences
set
  title = 'Welcome to City of Transformation',
  subtitle = 'Review the community policy once. After that, COT will guide you through the real app screens when you enter General COT and any Expression you join.',
  updated_at = now()
where audience = 'member' and is_active = true;

comment on table public.app_tour_experiences is 'Versioned, database-driven app tours for General COT and Expression scopes.';
comment on table public.app_tour_steps is 'Ordered app-tour content and real-screen target mapping. route_template may contain {expressionId}.';
comment on table public.profile_app_tour_progress is 'Per-profile tour progress, reminder schedule and never-remind preference. Expression progress is keyed by the Expression id in scope_key.';

-- Realign the in-app tours with the September 2026 General + Expression UI restructure.
-- v4 intentionally uses real TourAnchor targets instead of broad screen guesses.

do $$
declare
  old_general_id uuid;
  old_expression_id uuid;
  general_id uuid;
  expression_id uuid;
begin
  select id into old_general_id
  from public.app_tour_experiences
  where scope = 'general' and is_active = true
  limit 1;

  select id into old_expression_id
  from public.app_tour_experiences
  where scope = 'expression' and is_active = true
  limit 1;

  update public.app_tour_experiences
  set is_active = false, updated_at = now()
  where scope in ('general','expression') and is_active = true;

  insert into public.app_tour_experiences
    (scope, version, title, subtitle, auto_start, is_active, updated_at)
  values
    (
      'general',
      'general-cot-tour-2026-09-v4',
      'Explore General COT',
      'A current guided tour mapped to the controls and sections you actually see.',
      true,
      true,
      now()
    )
  on conflict (scope, version) do update
  set title = excluded.title,
      subtitle = excluded.subtitle,
      auto_start = excluded.auto_start,
      is_active = true,
      updated_at = now()
  returning id into general_id;

  insert into public.app_tour_experiences
    (scope, version, title, subtitle, auto_start, is_active, updated_at)
  values
    (
      'expression',
      'expression-tour-2026-09-v4',
      'Explore this Expression',
      'A scoped tour mapped to this Expression’s current navigation, Home and community controls.',
      true,
      true,
      now()
    )
  on conflict (scope, version) do update
  set title = excluded.title,
      subtitle = excluded.subtitle,
      auto_start = excluded.auto_start,
      is_active = true,
      updated_at = now()
  returning id into expression_id;

  delete from public.app_tour_steps where experience_id in (general_id, expression_id);

  insert into public.app_tour_steps
    (experience_id, step_order, target_key, route_template, title, body, icon, placement)
  values
    (general_id, 0, 'general.topbar', '/general',
      'General COT starts here',
      'The top bar keeps the General COT identity, search, notifications and church-wide controls together.',
      'home-outline', 'below'),
    (general_id, 1, 'general.home.actions', '/general',
      'Explore COT',
      'These current Home shortcuts take you straight to Sermons, Events, Live and the wider COT tools without searching through menus.',
      'grid-outline', 'below'),
    (general_id, 2, 'general.home.spotlight', '/general',
      'Official spotlight',
      'This rotating area carries official COT banners, Daily Bible, Daily Quote, Daily Devotional and other highlighted ministry content.',
      'images-outline', 'above'),
    (general_id, 3, 'general.home.feed', '/general',
      'Your community feed',
      'The For you section begins the personalized community stream. Open Discover when you want to browse beyond what Home is prioritizing.',
      'newspaper-outline', 'above'),
    (general_id, 4, 'general.navigation', '/general',
      'Your main navigation',
      'Home, Discover, Reels, Messages and You are the primary General COT destinations. Secondary tools stay out of this bar.',
      'navigate-outline', 'above'),
    (general_id, 5, 'general.reels.scope', '/general/reels',
      'General COT Reels',
      'This scope label confirms that you are browsing public General COT Reels rather than private Expression media.',
      'play-outline', 'below'),
    (general_id, 6, 'general.messages.search', '/general/chat',
      'Find someone to message',
      'Search a name or @username here to start a private direct conversation. Expression and Group discussions remain in their own spaces.',
      'search-outline', 'below'),
    (general_id, 7, 'general.profile.header', '/general/profile',
      'You',
      'Your profile and account area brings together your identity, public profile, saved content, notifications and personal controls.',
      'person-circle-outline', 'below'),
    (general_id, 8, 'general.tour.restart', '/general/tour',
      'Restart a tour anytime',
      'App tour & help lets you replay the General or Expression guide whenever the interface changes or you want a refresher.',
      'refresh-outline', 'above');

  insert into public.app_tour_steps
    (experience_id, step_order, target_key, route_template, title, body, icon, placement)
  values
    (expression_id, 0, 'expression.shell.navigation', '/expressions/{expressionId}',
      'Your Expression navigation',
      'The menu, Expression identity and switch control keep this private community separate from General COT and from your other Expressions.',
      'people-outline', 'below'),
    (expression_id, 1, 'expression.home.notifications', '/expressions/{expressionId}',
      'Expression notifications',
      'This card opens notifications that belong to the active Expression so scoped updates do not get confused with General COT.',
      'notifications-outline', 'below'),
    (expression_id, 2, 'expression.home.explore', '/expressions/{expressionId}',
      'Explore this Expression',
      'These current shortcuts open the tools available in this Expression, such as updates, prayer, events, Groups and discussion when enabled.',
      'grid-outline', 'below'),
    (expression_id, 3, 'expression.feed.header', '/expressions/{expressionId}/feed',
      'Expression feed',
      'Posts and community activity created inside this Expression stay scoped here instead of being treated as General COT content.',
      'newspaper-outline', 'below'),
    (expression_id, 4, 'expression.discussion.header', '/expressions/{expressionId}/chat',
      'General discussion',
      'This is the shared conversation for members of the active Expression, with search, pinned messages and calling tools where available.',
      'chatbubbles-outline', 'below'),
    (expression_id, 5, 'expression.reels.scope', '/expressions/{expressionId}/reels',
      'Expression Reels',
      'This scope label confirms that these short videos belong to the active Expression rather than the public General COT Reel catalogue.',
      'play-outline', 'below');

  -- Carry forward completed/snoozed/never-remind choices so a UI refresh does not
  -- disrespect an existing preference. Incomplete tours restart at the new first step.
  if old_general_id is not null and old_general_id <> general_id then
    insert into public.profile_app_tour_progress
      (profile_id, experience_id, scope_key, current_step, started_at, completed_at,
       snoozed_until, never_remind, last_seen_at, updated_at)
    select
      profile_id,
      general_id,
      scope_key,
      case when completed_at is not null then 9 else 0 end,
      case when completed_at is not null then started_at else null end,
      completed_at,
      snoozed_until,
      never_remind,
      last_seen_at,
      now()
    from public.profile_app_tour_progress
    where experience_id = old_general_id
    on conflict (profile_id, experience_id, scope_key) do update
    set current_step = excluded.current_step,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        snoozed_until = excluded.snoozed_until,
        never_remind = excluded.never_remind,
        last_seen_at = excluded.last_seen_at,
        updated_at = now();
  end if;

  if old_expression_id is not null and old_expression_id <> expression_id then
    insert into public.profile_app_tour_progress
      (profile_id, experience_id, scope_key, current_step, started_at, completed_at,
       snoozed_until, never_remind, last_seen_at, updated_at)
    select
      profile_id,
      expression_id,
      scope_key,
      case when completed_at is not null then 6 else 0 end,
      case when completed_at is not null then started_at else null end,
      completed_at,
      snoozed_until,
      never_remind,
      last_seen_at,
      now()
    from public.profile_app_tour_progress
    where experience_id = old_expression_id
    on conflict (profile_id, experience_id, scope_key) do update
    set current_step = excluded.current_step,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        snoozed_until = excluded.snoozed_until,
        never_remind = excluded.never_remind,
        last_seen_at = excluded.last_seen_at,
        updated_at = now();
  end if;
end $$;

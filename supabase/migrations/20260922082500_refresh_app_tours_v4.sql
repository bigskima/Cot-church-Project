-- Refresh member app tours after the General/Expression UI restructure.
-- Idempotent because v4 may already be live before this repository migration is replayed.

do $$
declare
  general_id uuid;
  expression_id uuid;
begin
  update public.app_tour_experiences
  set is_active = false, updated_at = now()
  where scope in ('general','expression') and is_active = true;

  insert into public.app_tour_experiences (
    scope, version, title, subtitle, auto_start, is_active
  ) values (
    'general',
    'general-cot-tour-2026-09-v4',
    'Explore General COT',
    'A current guided tour mapped to the controls and sections you actually see.',
    true,
    true
  )
  on conflict (scope, version) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    auto_start = excluded.auto_start,
    is_active = true,
    updated_at = now()
  returning id into general_id;

  delete from public.app_tour_steps where experience_id = general_id;

  insert into public.app_tour_steps (
    experience_id, step_order, target_key, route_template, title, body, icon, placement
  ) values
    (general_id, 0, 'general.topbar', '/general',
      'General COT starts here',
      'This is the current General COT header. Church identity, search, notifications and the more menu stay here.',
      'globe-outline', 'below'),
    (general_id, 1, 'general.home.actions', '/general',
      'Explore COT',
      'These are the current Home shortcuts for sermons, events, Live and the rest of General COT.',
      'grid-outline', 'below'),
    (general_id, 2, 'general.home.spotlight', '/general',
      'Official spotlight',
      'This rotating card area carries official church banners, daily content and other highlighted updates.',
      'images-outline', 'above'),
    (general_id, 3, 'general.home.feed', '/general',
      'Your community feed',
      'This is the current For you feed entry point. Posts, Reels, videos and focused content layers continue below it.',
      'newspaper-outline', 'above'),
    (general_id, 4, 'general.navigation', '/general',
      'Your main navigation',
      'Use this bottom navigation for Home, Discover, Reels, Messages and You.',
      'navigate-outline', 'above'),
    (general_id, 5, 'general.reels.scope', '/general/reels',
      'General COT Reels',
      'This scope control confirms that you are viewing public General COT Reels.',
      'play-outline', 'below'),
    (general_id, 6, 'general.messages.search', '/general/chat',
      'Find someone to message',
      'Search here by name or @username to start or reopen a private direct conversation.',
      'search-outline', 'below'),
    (general_id, 7, 'general.profile.header', '/general/profile',
      'You',
      'Your current account and public-profile area keeps identity, saved content, notifications, Expressions, ministry access and app controls together.',
      'person-circle-outline', 'below'),
    (general_id, 8, 'general.tour.restart', '/general/tour',
      'Restart a tour anytime',
      'Replay the General COT tour or start an Expression tour from this help area whenever you want a refresher.',
      'navigate-circle-outline', 'above');

  insert into public.app_tour_experiences (
    scope, version, title, subtitle, auto_start, is_active
  ) values (
    'expression',
    'expression-tour-2026-09-v4',
    'Explore this Expression',
    'A scoped tour mapped to this Expression’s current navigation, Home and community controls.',
    true,
    true
  )
  on conflict (scope, version) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    auto_start = excluded.auto_start,
    is_active = true,
    updated_at = now()
  returning id into expression_id;

  delete from public.app_tour_steps where experience_id = expression_id;

  insert into public.app_tour_steps (
    experience_id, step_order, target_key, route_template, title, body, icon, placement
  ) values
    (expression_id, 0, 'expression.shell.navigation', '/expressions/{expressionId}',
      'Your Expression navigation',
      'On mobile, use this header to open Expression navigation or switch Expressions. On larger screens the same scoped navigation becomes a sidebar.',
      'menu-outline', 'below'),
    (expression_id, 1, 'expression.home.notifications', '/expressions/{expressionId}',
      'Expression notifications',
      'Open this card for updates that belong to this Expression only.',
      'notifications-outline', 'below'),
    (expression_id, 2, 'expression.home.explore', '/expressions/{expressionId}',
      'Explore this Expression',
      'These shortcuts reflect the tools currently enabled for this Expression.',
      'grid-outline', 'below'),
    (expression_id, 3, 'expression.feed.header', '/expressions/{expressionId}/feed',
      'Expression feed',
      'Posts and community activity here remain scoped to this Expression.',
      'chatbubbles-outline', 'below'),
    (expression_id, 4, 'expression.discussion.header', '/expressions/{expressionId}/chat',
      'General discussion',
      'This is the shared conversation for members of this Expression.',
      'chatbubble-ellipses-outline', 'below'),
    (expression_id, 5, 'expression.reels.scope', '/expressions/{expressionId}/reels',
      'Expression Reels',
      'This scope control confirms that these short videos belong to the active private Expression.',
      'play-outline', 'below');
end $$;

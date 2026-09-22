-- Refresh member app tours after the General/Expression UI restructure.
-- v4 intentionally prefers measurable real controls over broad screen guesses.

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
    'A guided walk through the current General COT Home, navigation, Reels, Messages and account controls.',
    true,
    true
  )
  returning id into general_id;

  insert into public.app_tour_steps (
    experience_id, step_order, target_key, route_template, title, body, icon, placement
  ) values
    (general_id, 0, 'general.topbar', '/general',
      'General COT header',
      'This is the current General COT header. Church identity, search, notifications and the more menu stay here.',
      'globe-outline', 'below'),
    (general_id, 1, 'general.home.actions', '/general',
      'Explore COT',
      'These are the current Home shortcuts. Use them to reach sermons, events, Live and the rest of General COT without searching through older menus.',
      'grid-outline', 'below'),
    (general_id, 2, 'general.home.spotlight', '/general',
      'Home spotlight',
      'This rotating card area carries official church banners, daily content and other highlighted updates. Open the arrow on a card to follow its destination.',
      'images-outline', 'below'),
    (general_id, 3, 'general.home.feed', '/general',
      'For you',
      'This is the current community feed entry point. Posts, Reels, videos and focused content layers continue below it.',
      'newspaper-outline', 'above'),
    (general_id, 4, 'general.navigation', '/general',
      'Main navigation',
      'Use this bottom navigation for Home, Discover, Reels, Messages and You. It stays focused on the destinations members use most often.',
      'navigate-outline', 'above'),
    (general_id, 5, 'general.reels.scope', '/general/reels',
      'General COT Reels',
      'This scope control confirms that you are viewing public General COT Reels. Expression Reels remain inside their own Expression.',
      'play-outline', 'below'),
    (general_id, 6, 'general.messages.search', '/general/chat',
      'Find a person to message',
      'Search here by name or @username to start or reopen a private direct conversation.',
      'search-outline', 'below'),
    (general_id, 7, 'general.profile.header', '/general/profile',
      'You',
      'This is your current account and public-profile area. Profile editing, saved content, notifications, Expressions, ministry access and app controls flow from here.',
      'person-circle-outline', 'below'),
    (general_id, 8, 'general.tour.restart', '/general/tour',
      'Restart the tour anytime',
      'You can replay the General COT tour or start an Expression tour from this help area whenever the interface changes or you want a refresher.',
      'navigate-circle-outline', 'above');

  insert into public.app_tour_experiences (
    scope, version, title, subtitle, auto_start, is_active
  ) values (
    'expression',
    'expression-tour-2026-09-v4',
    'Explore this Expression',
    'A guided walk through the current Expression shell, Home tools, feed, discussion and scoped Reels.',
    true,
    true
  )
  returning id into expression_id;

  insert into public.app_tour_steps (
    experience_id, step_order, target_key, route_template, title, body, icon, placement
  ) values
    (expression_id, 0, 'expression.shell.navigation', '/expressions/{expressionId}',
      'Expression navigation',
      'This is the active Expression shell. On mobile, the menu opens Expression routes and the switch control moves between Expressions. The same scoped navigation becomes a sidebar on larger screens.',
      'menu-outline', 'below'),
    (expression_id, 1, 'expression.home.notifications', '/expressions/{expressionId}',
      'Expression notifications',
      'Open this card for updates that belong to this Expression only.',
      'notifications-outline', 'below'),
    (expression_id, 2, 'expression.home.explore', '/expressions/{expressionId}',
      'Explore this Expression',
      'These shortcuts are generated from the tools enabled for this Expression, such as updates, prayer, events, participation, Groups and discussion.',
      'grid-outline', 'below'),
    (expression_id, 3, 'expression.feed.header', '/expressions/{expressionId}/feed',
      'Expression feed',
      'Posts and community activity here remain scoped to this Expression instead of being mixed into General COT.',
      'chatbubbles-outline', 'below'),
    (expression_id, 4, 'expression.discussion.header', '/expressions/{expressionId}/chat',
      'General discussion',
      'This is the shared conversation for members of this Expression. Search, pinned messages, calling and moderation appear according to your access.',
      'chatbubble-ellipses-outline', 'below'),
    (expression_id, 5, 'expression.reels.scope', '/expressions/{expressionId}/reels',
      'Expression Reels',
      'This scope control confirms that these short videos belong to the active private Expression rather than General COT.',
      'play-outline', 'below');
end $$;

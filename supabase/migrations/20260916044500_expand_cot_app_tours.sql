do $$
declare
  general_experience_id uuid;
  expression_experience_id uuid;
begin
  update public.app_tour_experiences
  set is_active = false, updated_at = now()
  where scope in ('general', 'expression') and is_active = true;

  insert into public.app_tour_experiences (scope, version, title, subtitle, auto_start, is_active)
  values (
    'general',
    'general-cot-tour-2026-09-v3',
    'Explore General COT',
    'A complete guided walkthrough of the main General COT spaces, actions and church resources.',
    true,
    true
  )
  returning id into general_experience_id;

  insert into public.app_tour_experiences (scope, version, title, subtitle, auto_start, is_active)
  values (
    'expression',
    'expression-tour-2026-09-v3',
    'Explore this Expression',
    'A complete guided walkthrough of the private Expression home, community, media and people spaces.',
    true,
    true
  )
  returning id into expression_experience_id;

  insert into public.app_tour_steps (experience_id, step_order, target_key, route_template, title, body, icon, placement, is_active)
  values
    (general_experience_id, 0, 'general.topbar', '/general', 'Your General COT home', 'This top area keeps General COT identity, notifications and the main church context within reach.', 'home-outline', 'below', true),
    (general_experience_id, 1, 'general.home.actions', '/general', 'Quick actions', 'Use these shortcuts to create, pray, give, open ministry tools and move into common COT actions without hunting through menus.', 'flash-outline', 'below', true),
    (general_experience_id, 2, 'general.home.feed', '/general', 'Your layered Home feed', 'Home is arranged into focused sections for urgent updates, sermons, events, videos, Reels, community posts and other church activity.', 'albums-outline', 'above', true),
    (general_experience_id, 3, 'screen.general.discover', '/general/explore', 'Discover COT', 'Discover helps you find church resources, people, Expressions and content beyond what is currently visible on Home.', 'compass-outline', 'center', true),
    (general_experience_id, 4, 'general.reels.scope', '/general/reels', 'General COT Reels', 'Browse short public COT videos here. Expression Reels remain inside their own private Expression space.', 'flash-outline', 'center', true),
    (general_experience_id, 5, 'screen.general.watch', '/general/watch', 'Watch', 'Longer videos and recorded teaching live in Watch so they do not compete with short Reels.', 'videocam-outline', 'center', true),
    (general_experience_id, 6, 'screen.general.live', '/general/live', 'Live broadcasts', 'Open current, upcoming and replayed General COT broadcasts from this screen.', 'radio-outline', 'center', true),
    (general_experience_id, 7, 'screen.general.announcements', '/general/announcements', 'Official announcements', 'Published church-wide announcements appear here, including their flyer media when one was attached.', 'megaphone-outline', 'center', true),
    (general_experience_id, 8, 'screen.general.location', '/general/location', 'Official church location', 'This is the dedicated precise-location screen. It shows the published General COT address and Google Maps preview when a location has been configured.', 'location-outline', 'center', true),
    (general_experience_id, 9, 'screen.general.prayer', '/general/prayer', 'Prayer', 'Send a General COT prayer request and review the prayer experience from here. Expression prayer stays inside the selected Expression.', 'heart-outline', 'center', true),
    (general_experience_id, 10, 'screen.general.giving', '/general/giving', 'Giving', 'Use the church-wide Giving screen for available giving destinations, receipts and statements.', 'gift-outline', 'center', true),
    (general_experience_id, 11, 'general.messages.header', '/general/chat', 'Direct Messages', 'Your normal inbox prioritizes people you follow or who follow you. Search can still find other COT accounts when you need to start a conversation.', 'chatbubbles-outline', 'below', true),
    (general_experience_id, 12, 'screen.general.expressions', '/expressions', 'Your Expressions', 'Open or join private Expressions here. Entering one changes the app into that Expression’s own scoped church space.', 'business-outline', 'center', true),
    (general_experience_id, 13, 'general.profile.header', '/general/profile', 'You', 'Your profile brings together identity, saved content, notifications and the account controls that belong to you.', 'person-circle-outline', 'below', true),
    (general_experience_id, 14, 'screen.general.tools', '/general/tools', 'Tools & settings', 'General COT tools keep secondary actions such as Location, Prayer, Giving, Saved, Ministry tools and appearance away from the main navigation.', 'grid-outline', 'center', true),
    (general_experience_id, 15, 'general.tour.restart', '/general/tour', 'Restart this tour anytime', 'Return here whenever you want the full walkthrough again. Restarting now begins immediately instead of only reloading the page.', 'refresh-outline', 'above', true);

  insert into public.app_tour_steps (experience_id, step_order, target_key, route_template, title, body, icon, placement, is_active)
  values
    (expression_experience_id, 0, 'expression.header', '/expressions/{expressionId}', 'Your Expression shell', 'This header and navigation belong only to the active Expression. Use them without mixing private Expression activity into General COT.', 'people-outline', 'below', true),
    (expression_experience_id, 1, 'expression.home.hero', '/expressions/{expressionId}', 'Expression Home', 'Home gathers this Expression’s announcements, events, sermons, media and community activity into a scoped experience.', 'home-outline', 'above', true),
    (expression_experience_id, 2, 'screen.expression.location', '/expressions/{expressionId}/location', 'Expression location', 'This dedicated screen shows the official address and Google Maps preview when this Expression has published a location.', 'location-outline', 'center', true),
    (expression_experience_id, 3, 'screen.expression.announcements', '/expressions/{expressionId}/announcements', 'Expression announcements', 'Official updates published specifically for this Expression appear here, including attached flyer media.', 'megaphone-outline', 'center', true),
    (expression_experience_id, 4, 'expression.feed.header', '/expressions/{expressionId}/feed', 'Expression feed', 'Posts and community activity created inside this Expression remain scoped here instead of leaking into General COT.', 'chatbubbles-outline', 'below', true),
    (expression_experience_id, 5, 'expression.discussion.header', '/expressions/{expressionId}/chat', 'General discussion', 'Use this Expression-wide discussion for conversation that belongs to the selected Expression.', 'chatbubble-ellipses-outline', 'below', true),
    (expression_experience_id, 6, 'screen.expression.prayer', '/expressions/{expressionId}/prayer', 'Expression prayer', 'Prayer submitted here is scoped to this Expression rather than the General COT prayer destination.', 'heart-outline', 'center', true),
    (expression_experience_id, 7, 'screen.expression.events', '/expressions/{expressionId}/events', 'Expression events', 'Events created for this Expression appear here and open through the Expression-scoped event route.', 'calendar-outline', 'center', true),
    (expression_experience_id, 8, 'screen.expression.sermons', '/expressions/{expressionId}/sermons', 'Expression sermons', 'Teaching published for this Expression stays available within its own sermon catalogue.', 'mic-outline', 'center', true),
    (expression_experience_id, 9, 'screen.expression.videos', '/expressions/{expressionId}/videos', 'Expression videos', 'Long-form videos scoped to this Expression live here.', 'videocam-outline', 'center', true),
    (expression_experience_id, 10, 'screen.expression.reels', '/expressions/{expressionId}/reels', 'Expression Reels', 'Short-form media made for this Expression stays separate from General COT Reels.', 'flash-outline', 'center', true),
    (expression_experience_id, 11, 'screen.expression.groups', '/expressions/{expressionId}/groups', 'Groups', 'Groups are smaller communities inside an Expression. Their chats and tools remain membership-scoped.', 'people-circle-outline', 'center', true),
    (expression_experience_id, 12, 'screen.expression.members', '/expressions/{expressionId}/members', 'Members', 'Browse the member-facing Expression directory here while private account information remains protected.', 'people-outline', 'center', true),
    (expression_experience_id, 13, 'screen.expression.leadership', '/expressions/{expressionId}/leadership', 'Expression leadership', 'See the leaders assigned to this Expression and their published member-facing information.', 'ribbon-outline', 'center', true),
    (expression_experience_id, 14, 'screen.expression.birthdays', '/expressions/{expressionId}/birthdays', 'Birthdays', 'Birthday celebrations that belong to this Expression appear here according to member visibility preferences.', 'gift-outline', 'center', true);
end $$;

-- Replace implementation language in the member-facing General COT and Expression tours.
-- This is copy-only: routes, tour progress, permissions, and feed behavior are unchanged.

update public.app_tour_experiences
set subtitle = case scope
  when 'general' then 'A quick guide to Home, messages and the wider COT community.'
  when 'expression' then 'A guide to this Expression’s Home, people and community tools.'
  else subtitle
end
where is_active = true
  and scope in ('general', 'expression');

update public.app_tour_steps as step
set title = copy.title,
    body = copy.body
from public.app_tour_experiences as experience,
     (values
       ('general', 'general.topbar', 'Find your way around', 'Search, notifications and your profile are always available at the top.'),
       ('general', 'general.home.actions', 'Share and take part', 'Use these shortcuts to create a post or voice update, or open popular COT services.'),
       ('general', 'general.home.spotlight', 'Church highlights', 'See official COT announcements, Daily Bible, Daily Quote, Daily Devotional and other featured updates here.'),
       ('general', 'general.home.feed', 'Your community', 'See posts and updates from COT here. Open Discover to find more people, messages and church content.'),
       ('general', 'general.navigation', 'Move around COT', 'Use the bottom menu to visit Home, Discover, Reels, Messages and your account.'),
       ('general', 'general.reels.scope', 'Reels from General COT', 'Watch public short videos from General COT. Reels shared within an Expression stay in that community.'),
       ('general', 'general.messages.search', 'Find someone to message', 'Search by name or @username to start a private conversation. Group and Expression discussions have their own spaces.'),
       ('general', 'general.profile.header', 'Your account', 'Manage your profile, saved posts, notifications, prayer, giving and personal settings here.'),
       ('general', 'general.tour.restart', 'Replay this guide', 'You can replay the General COT or Expression guide whenever you need a reminder.'),
       ('expression', 'expression.shell.navigation', 'Your Expression', 'The menu helps you reach this community’s pages. Use the switch to move between your joined Expressions and return to General COT when you need.'),
       ('expression', 'expression.home.notifications', 'Updates from this Expression', 'See notifications and announcements from this community here. They stay separate from General COT updates.'),
       ('expression', 'expression.home.explore', 'Explore this Expression', 'Open updates, prayer, events, Groups and discussions using these shortcuts.'),
       ('expression', 'expression.feed.header', 'Community posts', 'Posts and conversations shared in this Expression appear here for its members.'),
       ('expression', 'expression.discussion.header', 'Expression chat', 'Chat with other members, search messages, find pinned conversations and use calling tools where available.'),
       ('expression', 'expression.reels.scope', 'Reels from this Expression', 'Watch short videos shared with this Expression. General COT Reels are available separately.')
     ) as copy(scope, target_key, title, body)
where step.experience_id = experience.id
  and experience.is_active = true
  and experience.scope = copy.scope
  and step.target_key = copy.target_key;

update public.onboarding_experiences
set subtitle = 'Review the community guidelines once. COT will then guide you through General COT and any Expression you join.',
    updated_at = now()
where audience = 'member'
  and is_active = true;

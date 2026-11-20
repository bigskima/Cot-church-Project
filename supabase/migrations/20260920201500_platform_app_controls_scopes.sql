begin;

create table if not exists public.expression_feature_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid not null references public.branches(id) on delete cascade,
  feature_key text not null references public.platform_feature_flags(key) on delete cascade,
  enabled boolean,
  rollout_percentage smallint check (rollout_percentage is null or rollout_percentage between 0 and 100),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (expression_id, feature_key),
  foreign key (expression_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create table if not exists public.group_feature_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  feature_key text not null references public.platform_feature_flags(key) on delete cascade,
  enabled boolean,
  rollout_percentage smallint check (rollout_percentage is null or rollout_percentage between 0 and 100),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (group_id, feature_key),
  foreign key (group_id, organization_id) references public.groups(id, organization_id) on delete cascade
);

create index if not exists expression_feature_overrides_feature_idx
  on public.expression_feature_overrides(feature_key, organization_id, expression_id);

create index if not exists group_feature_overrides_feature_idx
  on public.group_feature_overrides(feature_key, organization_id, expression_id, group_id);

drop trigger if exists expression_feature_overrides_updated on public.expression_feature_overrides;
create trigger expression_feature_overrides_updated
before update on public.expression_feature_overrides
for each row execute function public.set_updated_at();

drop trigger if exists group_feature_overrides_updated on public.group_feature_overrides;
create trigger group_feature_overrides_updated
before update on public.group_feature_overrides
for each row execute function public.set_updated_at();

alter table public.expression_feature_overrides enable row level security;
alter table public.group_feature_overrides enable row level security;

drop policy if exists expression_feature_overrides_member_read on public.expression_feature_overrides;
create policy expression_feature_overrides_member_read on public.expression_feature_overrides
for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists group_feature_overrides_member_read on public.group_feature_overrides;
create policy group_feature_overrides_member_read on public.group_feature_overrides
for select to authenticated
using (public.is_organization_member(organization_id));

-- The platform catalog is deliberately broad, but defaults preserve current behavior.
-- New operational switches are enabled unless an older release lock already controls them.
insert into public.platform_feature_flags (
  key, name, category, description, global_enabled, rollout_percentage, configuration
)
values
  ('calls', 'Calls', 'communication', 'Master availability for COT audio and video calling.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression","group"]}'::jsonb),
  ('audio_calls', 'Audio Calls', 'communication', 'Audio calling wherever COT calling is supported.', true, 100, '{"operationalVisible":true,"parentKey":"calls","scopes":["organization","expression","group"]}'::jsonb),
  ('video_calls', 'Video Calls', 'communication', 'Video calling wherever COT calling is supported.', true, 100, '{"operationalVisible":true,"parentKey":"calls","scopes":["organization","expression","group"]}'::jsonb),
  ('dm_calls', 'Direct Message Calls', 'communication', 'One-to-one calls from direct messages.', true, 100, '{"operationalVisible":true,"parentKey":"calls","scopes":["organization"]}'::jsonb),
  ('group_calls', 'Group Calls', 'communication', 'Calls inside COT groups.', true, 100, '{"operationalVisible":true,"parentKey":"calls","scopes":["organization","expression","group"]}'::jsonb),
  ('expression_calls', 'Expression Calls', 'communication', 'Calls inside Expression discussion spaces.', true, 100, '{"operationalVisible":true,"parentKey":"calls","scopes":["organization","expression"]}'::jsonb),
  ('direct_messages', 'Direct Messages', 'communication', 'Private one-to-one messaging across COT.', true, 100, '{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('group_chat', 'Group Chat', 'communication', 'Messaging inside General and Expression groups.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression","group"]}'::jsonb),
  ('expression_discussion', 'Expression Discussion', 'communication', 'Member discussion inside an Expression.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('voice_notes', 'Voice Notes', 'communication', 'Voice-note recording and playback inside chat.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression","group"]}'::jsonb),
  ('chat_media', 'Chat Photos & Files', 'communication', 'Photo, video and file attachments in chat.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression","group"]}'::jsonb),

  ('general_posting', 'General COT Posting', 'community', 'Creating posts in General COT.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization"]}'::jsonb),
  ('expression_posting', 'Expression Posting', 'community', 'Creating member posts inside Expressions.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('photo_posts', 'Photo Posts', 'community', 'Publishing photos in COT community posts.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('voice_posts', 'Voice / Audio Posts', 'community', 'Publishing voice and audio posts.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('reels', 'Reels', 'community', 'Short-form Reel viewing and publishing.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('long_form_video', 'Long-form Video', 'community', 'Long-form video viewing and publishing.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('comments', 'Comments', 'community', 'Comments and threaded replies on supported content.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('reactions', 'Reactions', 'community', 'Likes and reactions on supported content.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),
  ('bookmarks', 'Saved Content', 'community', 'Bookmarks and saved-content library.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization"]}'::jsonb),
  ('content_sharing', 'Sharing & Quoted Content', 'community', 'Sharing, forwarding and quoted content surfaces.', true, 100, '{"operationalVisible":true,"parentKey":"social_community_feed","scopes":["organization","expression"]}'::jsonb),

  ('live_streaming', 'Live Streaming', 'live_media', 'Master availability for COT live broadcasting and viewing.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('general_live', 'General COT Live', 'live_media', 'Church-wide live broadcasts.', true, 100, '{"operationalVisible":true,"parentKey":"live_streaming","scopes":["organization"]}'::jsonb),
  ('expression_live', 'Expression Live', 'live_media', 'Expression-scoped live broadcasts.', true, 100, '{"operationalVisible":true,"parentKey":"live_streaming","scopes":["organization","expression"]}'::jsonb),
  ('watch_library', 'Watch', 'live_media', 'Long-form public video discovery and playback.', true, 100, '{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('sermons', 'Sermons', 'live_media', 'Sermon discovery, playback and publishing.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),

  ('groups', 'Groups', 'community_tools', 'General and Expression group spaces.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('group_creation', 'Group Creation', 'community_tools', 'Creating new General or Expression groups.', true, 100, '{"operationalVisible":true,"parentKey":"groups","scopes":["organization","expression"]}'::jsonb),
  ('expressions', 'Expressions', 'community_tools', 'Expression discovery, membership and entry.', true, 100, '{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('expression_creation', 'Expression Creation', 'community_tools', 'Creating new Expressions when governance allows it.', true, 100, '{"operationalVisible":true,"parentKey":"expressions","scopes":["organization"]}'::jsonb),
  ('polls_giveaways', 'Polls & Giveaways', 'community_tools', 'Community participation through polls and giveaways.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('testimonies', 'Testimonies', 'community_tools', 'Testimony submission, review and publishing.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('announcements', 'Announcements', 'community_tools', 'General and Expression announcements.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('events_gatherings', 'Events & Gatherings', 'community_tools', 'Events, schedules and gatherings.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('attendance', 'Attendance', 'community_tools', 'Attendance capture and attendance operations.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression","group"]}'::jsonb),
  ('birthdays', 'Birthdays', 'community_tools', 'Birthday discovery and celebration surfaces.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('pastoral_care', 'Pastoral Care', 'community_tools', 'Pastoral follow-up and care workflows.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),

  ('library_books', 'Library & Books', 'knowledge', 'COT library, books, authors and reading progress.', true, 100, '{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('devotionals', 'Devotionals', 'knowledge', 'Daily devotional reading and devotional library.', true, 100, '{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('church_story', 'Our Story', 'knowledge', 'General COT church story and public identity content.', true, 100, '{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('quick_facts', 'Quick Facts', 'knowledge', 'General COT Quick Facts.', true, 100, '{"operationalVisible":true,"parentKey":"church_story","scopes":["organization"]}'::jsonb),
  ('leadership_directory', 'Leadership Directory', 'knowledge', 'Church and Expression leader directories.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('locations', 'Church & Expression Locations', 'knowledge', 'Published church and Expression locations.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),

  ('cot_assistant', 'COT Assistant', 'intelligence', 'Member-facing COT AI assistant.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),

  ('giving', 'Giving', 'giving', 'Master availability for member-facing giving.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression","group"]}'::jsonb),
  ('manual_transfer_giving', 'Manual Transfer Giving', 'giving', 'Published bank-transfer giving destinations.', true, 100, '{"operationalVisible":true,"parentKey":"giving","scopes":["organization","expression","group"]}'::jsonb),

  ('notifications', 'Notifications', 'notifications', 'Master availability for non-critical COT notifications.', true, 100, '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb),
  ('in_app_notifications', 'In-app Notifications', 'notifications', 'Notification inbox and in-app delivery.', true, 100, '{"operationalVisible":true,"parentKey":"notifications","scopes":["organization","expression"]}'::jsonb),
  ('push_notifications', 'Push Notifications', 'notifications', 'Device push delivery for non-critical COT notifications.', true, 100, '{"operationalVisible":true,"parentKey":"notifications","scopes":["organization","expression"]}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  configuration = public.platform_feature_flags.configuration || excluded.configuration;

update public.platform_feature_flags
set configuration = configuration || '{"operationalVisible":true,"scopes":["organization","expression"],"parentKey":"live_streaming"}'::jsonb
where key = 'livestream_realtime_chat';

update public.platform_feature_flags
set configuration = configuration || '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb
where key = 'prayer_request_ministry';

update public.platform_feature_flags
set configuration = configuration || '{"operationalVisible":false,"scopes":["organization","expression"]}'::jsonb
where key in ('ai_sermon_intelligence','giving_reconciliation_engine');

update public.platform_feature_flags
set configuration = configuration || '{"operationalVisible":true,"parentKey":"giving","scopes":["organization","expression","group"]}'::jsonb
where key = 'online_payment_giving';

update public.platform_feature_flags
set configuration = configuration || '{"operationalVisible":true,"scopes":["organization","expression"]}'::jsonb
where key = 'social_community_feed';

comment on table public.expression_feature_overrides is
  'Platform-owned feature availability overrides scoped to one Expression. Row absence or enabled null means inherit.';
comment on table public.group_feature_overrides is
  'Platform-owned feature availability overrides scoped to one Group. Row absence or enabled null means inherit.';

commit;

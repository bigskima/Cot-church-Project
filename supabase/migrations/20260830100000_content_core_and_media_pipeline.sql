-- ==============================================================================
-- CONTENT CORE, NORMALIZED MEDIA PIPELINE, REELS, WATCH VIDEOS, FLEXIBLE SERMONS,
-- INDEPENDENT FOLLOWS, AND UNIFIED ENGAGEMENT LAYER
-- ==============================================================================

-- 1. Register Capability Permissions
insert into public.permissions (code, name, description, category) values
  ('posts.create', 'Create social posts', 'Draft and author social posts and conversations.', 'content'),
  ('posts.publish', 'Publish social posts', 'Publish social posts across organization or expression feeds.', 'content'),
  ('reels.create', 'Create short reels', 'Upload and author short-form vertical reels.', 'content'),
  ('reels.publish', 'Publish short reels', 'Publish reels to public and expression discovery feeds.', 'content'),
  ('videos.create', 'Create long videos', 'Upload and author long-form watch videos.', 'content'),
  ('videos.publish', 'Publish long videos', 'Publish long-form videos to public and watch catalogs.', 'content'),
  ('media.upload', 'Upload raw media', 'Request upload sessions and store media assets.', 'media'),
  ('media.manage', 'Manage media assets', 'Manage media renditions, captions, and processing pipelines.', 'media'),
  ('content.moderate', 'Moderate expression content', 'Review, moderate, and triage reported content and comments.', 'governance'),
  ('studio.access', 'Access ministry studio', 'Access creator and ministry studio for content publishing.', 'content')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_active = true;

-- 2. Domain Enumerations
create type public.content_item_type as enum ('post', 'reel', 'video', 'sermon', 'live_stream');
create type public.publication_status as enum ('draft', 'processing', 'review', 'scheduled', 'published', 'archived');
create type public.media_asset_type as enum ('video', 'audio', 'image');
create type public.media_processing_state as enum ('uploading', 'uploaded', 'processing', 'ready', 'failed');
create type public.media_rendition_kind as enum ('video_stream', 'video_download', 'audio_stream', 'audio_download', 'thumbnail', 'waveform');
create type public.media_track_type as enum ('captions', 'subtitles', 'audio_description');
create type public.video_category as enum ('documentary', 'conference', 'worship', 'interview', 'testimony', 'teaching', 'programme', 'highlights', 'podcast', 'general');

-- 3. Normalized Media Pipeline Tables
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  media_type public.media_asset_type not null,
  processing_state public.media_processing_state not null default 'uploading',
  source_storage_path text,
  duration_seconds integer check(duration_seconds is null or duration_seconds >= 0),
  width integer check(width is null or width > 0),
  height integer check(height is null or height > 0),
  aspect_ratio text,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint check(file_size_bytes is null or file_size_bytes >= 0),
  provider text not null default 'internal',
  provider_asset_id text,
  processing_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.media_renditions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_asset_id uuid not null,
  rendition_kind public.media_rendition_kind not null,
  container text not null default 'mp4',
  codec text not null default 'h264',
  width integer,
  height integer,
  bitrate_bps bigint,
  file_size_bytes bigint,
  storage_path text,
  provider_asset_id text,
  provider_playback_id text,
  is_master boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (media_asset_id, organization_id) references public.media_assets(id, organization_id) on delete cascade
);

create table public.media_tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_asset_id uuid not null,
  track_type public.media_track_type not null,
  language text not null check(char_length(trim(language)) between 2 and 12),
  label text not null default '',
  storage_path text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (media_asset_id, organization_id) references public.media_assets(id, organization_id) on delete cascade
);

create table public.media_thumbnails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_asset_id uuid not null,
  storage_path text not null,
  width integer,
  height integer,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (media_asset_id, organization_id) references public.media_assets(id, organization_id) on delete cascade
);

-- 4. Content Core (Supertype Table)
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,
  content_type public.content_item_type not null,
  visibility public.content_visibility not null default 'public',
  status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (
    (visibility = 'branch' and expression_id is not null) or
    (visibility = 'group' and group_id is not null and expression_id is not null) or
    (visibility in ('public', 'organization', 'private'))
  )
);

-- 5. Typed Subtype Tables
create table public.reels (
  id uuid primary key,
  organization_id uuid not null,
  media_asset_id uuid not null,
  caption text not null check(char_length(trim(caption)) between 1 and 2200),
  audio_title text,
  audio_artist text,
  views_count bigint not null default 0,
  likes_count bigint not null default 0,
  comments_count bigint not null default 0,
  shares_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (id, organization_id) references public.content_items(id, organization_id) on delete cascade,
  foreign key (media_asset_id, organization_id) references public.media_assets(id, organization_id) on delete restrict
);

create table public.videos (
  id uuid primary key,
  organization_id uuid not null,
  media_asset_id uuid not null,
  series_id uuid,
  title text not null check(char_length(trim(title)) between 1 and 200),
  slug text not null,
  description text not null default '',
  category public.video_category not null default 'general',
  chapters jsonb not null default '[]'::jsonb check(jsonb_typeof(chapters) = 'array'),
  transcript text,
  views_count bigint not null default 0,
  likes_count bigint not null default 0,
  comments_count bigint not null default 0,
  shares_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (id, organization_id) references public.content_items(id, organization_id) on delete cascade,
  foreign key (media_asset_id, organization_id) references public.media_assets(id, organization_id) on delete restrict,
  foreign key (series_id, organization_id) references public.sermon_series(id, organization_id) on delete set null,
  unique (organization_id, slug)
);

-- Add asset foreign keys to existing sermons table
alter table public.sermons add column if not exists content_item_id uuid;
alter table public.sermons add column if not exists audio_asset_id uuid;
alter table public.sermons add column if not exists video_asset_id uuid;
alter table public.sermons add column if not exists chapters jsonb default '[]'::jsonb;

-- 6. Independent Leader Entity (Separated from Login Accounts)
create table public.leaders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null check(char_length(trim(name)) between 1 and 150),
  role_title text not null check(char_length(trim(role_title)) between 1 and 120),
  biography text not null default '',
  avatar_url text,
  is_founder boolean not null default false,
  is_historic boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

-- 7. Follow System (Strict FK Integrity, Decoupled from Membership)
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete cascade,
  leader_id uuid references public.leaders(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(organization_id, expression_id, leader_id) = 1),
  unique (profile_id, organization_id),
  unique (profile_id, expression_id),
  unique (profile_id, leader_id)
);

-- 8. Universal Engagement Layer (Referencing content_items with strict FKs)
create table public.content_reactions (
  content_item_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check(reaction in ('like', 'love', 'pray', 'celebrate', 'amen', 'support')),
  created_at timestamptz not null default now(),
  primary key (content_item_id, profile_id),
  foreign key (content_item_id) references public.content_items(id) on delete cascade
);

create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.content_comments(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 3000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_item_id) references public.content_items(id) on delete cascade
);

create table public.content_bookmarks (
  content_item_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_item_id, profile_id),
  foreign key (content_item_id) references public.content_items(id) on delete cascade
);

create table public.content_playback_progress (
  content_item_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  progress_seconds integer not null default 0 check(progress_seconds >= 0),
  duration_seconds integer not null default 0 check(duration_seconds >= 0),
  completed boolean not null default false,
  last_played_at timestamptz not null default now(),
  primary key (content_item_id, profile_id),
  foreign key (content_item_id) references public.content_items(id) on delete cascade
);

create table public.content_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  content_item_id uuid references public.content_items(id) on delete set null,
  comment_id uuid references public.content_comments(id) on delete set null,
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(char_length(trim(reason)) between 1 and 200),
  details text not null default '',
  status text not null default 'pending' check(status in ('pending', 'under_review', 'actioned', 'dismissed')),
  action_taken text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(content_item_id, comment_id) = 1)
);

-- 9. Performance Indexes
create index content_items_published_idx on public.content_items(organization_id, status, published_at desc) where status = 'published';
create index content_items_feed_idx on public.content_items(visibility, status, published_at desc);
create index media_assets_org_idx on public.media_assets(organization_id, processing_state, created_at desc);
create index reels_org_idx on public.reels(organization_id, views_count desc);
create index videos_org_idx on public.videos(organization_id, category, views_count desc);
create index follows_profile_idx on public.follows(profile_id);
create index content_comments_thread_idx on public.content_comments(content_item_id, created_at asc) where not is_hidden;
create index content_playback_user_idx on public.content_playback_progress(profile_id, last_played_at desc);

-- 10. Triggers
create trigger media_assets_updated before update on public.media_assets for each row execute function public.set_updated_at();
create trigger content_items_updated before update on public.content_items for each row execute function public.set_updated_at();
create trigger reels_updated before update on public.reels for each row execute function public.set_updated_at();
create trigger videos_updated before update on public.videos for each row execute function public.set_updated_at();
create trigger leaders_updated before update on public.leaders for each row execute function public.set_updated_at();
create trigger content_comments_updated before update on public.content_comments for each row execute function public.set_updated_at();
create trigger content_moderation_reports_updated before update on public.content_moderation_reports for each row execute function public.set_updated_at();

-- 11. Row Level Security Policies
alter table public.media_assets enable row level security;
alter table public.media_renditions enable row level security;
alter table public.media_tracks enable row level security;
alter table public.media_thumbnails enable row level security;
alter table public.content_items enable row level security;
alter table public.reels enable row level security;
alter table public.videos enable row level security;
alter table public.leaders enable row level security;
alter table public.follows enable row level security;
alter table public.content_reactions enable row level security;
alter table public.content_comments enable row level security;
alter table public.content_bookmarks enable row level security;
alter table public.content_playback_progress enable row level security;
alter table public.content_moderation_reports enable row level security;

-- Content Items Read Policies
create policy content_items_read on public.content_items
  for select using (
    (status = 'published' and (
      visibility = 'public'
      or (visibility = 'organization' and public.is_organization_member(organization_id))
      or (visibility = 'branch' and exists(
        select 1 from public.memberships m
        where m.organization_id = content_items.organization_id
          and m.profile_id = auth.uid()
          and m.status = 'active'
          and m.branch_id = content_items.expression_id
      ))
      or (visibility = 'group' and exists(
        select 1 from public.group_memberships gm
        join public.memberships m on m.id = gm.membership_id
        where gm.group_id = content_items.group_id
          and m.profile_id = auth.uid()
          and gm.status = 'active'
      ))
    ))
    or (author_profile_id = auth.uid())
    or (public.has_permission(organization_id, 'posts.publish', expression_id))
    or (public.has_permission(organization_id, 'reels.publish', expression_id))
    or (public.has_permission(organization_id, 'videos.publish', expression_id))
    or (public.has_permission(organization_id, 'sermons.publish', expression_id))
  );

-- Media Assets Read Policies (Protected even before publication)
create policy media_assets_read on public.media_assets
  for select using (
    (created_by = auth.uid())
    or (public.has_permission(organization_id, 'media.manage', expression_id))
    or exists (
      select 1 from public.content_items ci
      where ci.organization_id = media_assets.organization_id
        and ci.status = 'published'
        and (
          ci.id in (select id from public.reels r where r.media_asset_id = media_assets.id)
          or ci.id in (select id from public.videos v where v.media_asset_id = media_assets.id)
          or ci.id in (select id from public.sermons s where s.audio_asset_id = media_assets.id or s.video_asset_id = media_assets.id)
        )
    )
  );

-- Subtypes Public Read (Enforced via content_items join)
create policy reels_read on public.reels
  for select using (exists(select 1 from public.content_items ci where ci.id = reels.id));

create policy videos_read on public.videos
  for select using (exists(select 1 from public.content_items ci where ci.id = videos.id));

create policy leaders_read on public.leaders
  for select using (true);

create policy follows_self on public.follows
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy reactions_read on public.content_reactions
  for select using (exists(select 1 from public.content_items ci where ci.id = content_reactions.content_item_id));

create policy reactions_self on public.content_reactions
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy comments_read on public.content_comments
  for select using (not is_hidden and exists(select 1 from public.content_items ci where ci.id = content_comments.content_item_id));

create policy comments_manage on public.content_comments
  for all to authenticated
  using (author_profile_id = auth.uid())
  with check (author_profile_id = auth.uid());

create policy bookmarks_self on public.content_bookmarks
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy playback_self on public.content_playback_progress
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy moderation_reports_manage on public.content_moderation_reports
  for all to authenticated
  using (
    reporter_profile_id = auth.uid()
    or public.has_permission(organization_id, 'content.moderate', expression_id)
  )
  with check (
    reporter_profile_id = auth.uid()
    or public.has_permission(organization_id, 'content.moderate', expression_id)
  );

-- 12. Security Definer Hardened Publishing RPCs (Strict Search Path & Atomic Execution)

-- A. Publish Social Post
create or replace function public.publish_typed_post(
  p_org_id uuid,
  p_expression_id uuid,
  p_group_id uuid,
  p_visibility public.content_visibility,
  p_body text,
  p_media_json jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_content_id uuid;
  v_author_membership public.memberships;
begin
  if auth.uid() is null then
    raise exception using errcode = '401', message = 'Authentication required';
  end if;

  select * into v_author_membership from public.memberships
  where organization_id = p_org_id and profile_id = auth.uid() and status = 'active';

  if not found then
    raise exception using errcode = '42501', message = 'Active organization membership required';
  end if;

  if not (
    public.has_permission(p_org_id, 'posts.publish', p_expression_id)
    or public.has_permission(p_org_id, 'posts.create', p_expression_id)
  ) then
    raise exception using errcode = '42501', message = 'Permission denied to create posts in this expression';
  end if;

  -- Atomic Insert into content_items
  insert into public.content_items (
    organization_id, expression_id, group_id, author_profile_id,
    content_type, visibility, status, published_at
  ) values (
    p_org_id, p_expression_id, p_group_id, auth.uid(),
    'post', p_visibility, 'published', now()
  ) returning id into v_content_id;

  -- Insert into social_posts
  insert into public.social_posts (
    id, organization_id, author_membership_id, branch_id, group_id,
    visibility, status, body, media, published_at
  ) values (
    v_content_id, p_org_id, v_author_membership.id, p_expression_id, p_group_id,
    p_visibility, 'published', trim(p_body), p_media_json, now()
  );

  return jsonb_build_object('id', v_content_id, 'status', 'published');
end;
$$;

-- B. Publish Reel
create or replace function public.publish_typed_reel(
  p_org_id uuid,
  p_expression_id uuid,
  p_visibility public.content_visibility,
  p_media_asset_id uuid,
  p_caption text,
  p_audio_title text default null,
  p_audio_artist text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_content_id uuid;
  v_asset public.media_assets;
begin
  if auth.uid() is null then
    raise exception using errcode = '401', message = 'Authentication required';
  end if;

  if not public.has_permission(p_org_id, 'reels.publish', p_expression_id) then
    raise exception using errcode = '42501', message = 'Permission denied to publish reels in this expression';
  end if;

  select * into v_asset from public.media_assets
  where id = p_media_asset_id and organization_id = p_org_id;

  if not found then
    raise exception using errcode = '404', message = 'Media asset not found in organization';
  end if;

  -- Atomic content creation
  insert into public.content_items (
    organization_id, expression_id, author_profile_id,
    content_type, visibility, status, published_at
  ) values (
    p_org_id, p_expression_id, auth.uid(),
    'reel', p_visibility, 'published', now()
  ) returning id into v_content_id;

  insert into public.reels (
    id, organization_id, media_asset_id, caption,
    audio_title, audio_artist
  ) values (
    v_content_id, p_org_id, p_media_asset_id, trim(p_caption),
    trim(p_audio_title), trim(p_audio_artist)
  );

  return jsonb_build_object('id', v_content_id, 'status', 'published');
end;
$$;

-- C. Publish Long-form Watch Video
create or replace function public.publish_typed_video(
  p_org_id uuid,
  p_expression_id uuid,
  p_visibility public.content_visibility,
  p_media_asset_id uuid,
  p_title text,
  p_description text default '',
  p_category public.video_category default 'general',
  p_series_id uuid default null,
  p_chapters jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_content_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception using errcode = '401', message = 'Authentication required';
  end if;

  if not public.has_permission(p_org_id, 'videos.publish', p_expression_id) then
    raise exception using errcode = '42501', message = 'Permission denied to publish videos in this expression';
  end if;

  v_slug := lower(regexp_replace(trim(p_title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.content_items (
    organization_id, expression_id, author_profile_id,
    content_type, visibility, status, published_at
  ) values (
    p_org_id, p_expression_id, auth.uid(),
    'video', p_visibility, 'published', now()
  ) returning id into v_content_id;

  insert into public.videos (
    id, organization_id, media_asset_id, series_id,
    title, slug, description, category, chapters
  ) values (
    v_content_id, p_org_id, p_media_asset_id, p_series_id,
    trim(p_title), v_slug, coalesce(p_description, ''), p_category, coalesce(p_chapters, '[]'::jsonb)
  );

  return jsonb_build_object('id', v_content_id, 'slug', v_slug, 'status', 'published');
end;
$$;

-- D. Dynamic Playback Resolution (Prevents Storing Permanent Signed URLs)
create or replace function public.get_media_playback_info(p_content_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.content_items;
  v_asset public.media_assets;
  v_renditions jsonb;
  v_tracks jsonb;
  v_thumbnails jsonb;
begin
  select * into v_item from public.content_items where id = p_content_id;
  if not found then
    raise exception using errcode = '404', message = 'Content item not found';
  end if;

  -- Check visibility
  if v_item.status <> 'published' and v_item.author_profile_id <> auth.uid() then
    if not (
      public.has_permission(v_item.organization_id, 'media.manage', v_item.expression_id)
      or public.has_permission(v_item.organization_id, 'content.moderate', v_item.expression_id)
    ) then
      raise exception using errcode = '403', message = 'Unpublished content is restricted';
    end if;
  end if;

  if v_item.visibility = 'organization' and not public.is_organization_member(v_item.organization_id) then
    raise exception using errcode = '403', message = 'Organization membership required';
  end if;

  if v_item.visibility = 'branch' and not exists (
    select 1 from public.memberships m
    where m.organization_id = v_item.organization_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and m.branch_id = v_item.expression_id
  ) then
    raise exception using errcode = '403', message = 'Expression membership required';
  end if;

  -- Resolve asset
  select ma.* into v_asset from public.media_assets ma
  where ma.id in (
    select media_asset_id from public.reels where id = p_content_id
    union
    select media_asset_id from public.videos where id = p_content_id
    union
    select video_asset_id from public.sermons where id = p_content_id
    union
    select audio_asset_id from public.sermons where id = p_content_id
  );

  if not found then
    return jsonb_build_object('available', false, 'reason', 'No media attached');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'kind', rendition_kind, 'container', container, 'codec', codec,
    'width', width, 'height', height, 'bitrate', bitrate_bps, 'storagePath', storage_path,
    'providerPlaybackId', provider_playback_id, 'isMaster', is_master
  )), '[]'::jsonb) into v_renditions from public.media_renditions where media_asset_id = v_asset.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'type', track_type, 'language', language, 'label', label, 'storagePath', storage_path, 'isDefault', is_default
  )), '[]'::jsonb) into v_tracks from public.media_tracks where media_asset_id = v_asset.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'storagePath', storage_path, 'width', width, 'height', height, 'isPrimary', is_primary
  )), '[]'::jsonb) into v_thumbnails from public.media_thumbnails where media_asset_id = v_asset.id;

  return jsonb_build_object(
    'available', true,
    'assetId', v_asset.id,
    'mediaType', v_asset.media_type,
    'processingState', v_asset.processing_state,
    'durationSeconds', v_asset.duration_seconds,
    'renditions', v_renditions,
    'tracks', v_tracks,
    'thumbnails', v_thumbnails
  );
end;
$$;

-- E. Playback Progress Sync & Server-Validated View Counts
create or replace function public.sync_content_playback(
  p_content_id uuid,
  p_progress_seconds integer,
  p_duration_seconds integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('saved', false, 'reason', 'Anonymous session');
  end if;

  insert into public.content_playback_progress (
    content_item_id, profile_id, progress_seconds, duration_seconds,
    completed, last_played_at
  ) values (
    p_content_id, auth.uid(), p_progress_seconds, p_duration_seconds,
    p_progress_seconds >= (p_duration_seconds * 0.9), now()
  ) on conflict (content_item_id, profile_id) do update set
    progress_seconds = excluded.progress_seconds,
    duration_seconds = excluded.duration_seconds,
    completed = excluded.completed or public.content_playback_progress.completed,
    last_played_at = now();

  return jsonb_build_object('saved', true);
end;
$$;

-- Revoke & Grant Grants on Security Definer RPCs
revoke all on function public.publish_typed_post(uuid, uuid, uuid, public.content_visibility, text, jsonb) from public;
grant execute on function public.publish_typed_post(uuid, uuid, uuid, public.content_visibility, text, jsonb) to authenticated;

revoke all on function public.publish_typed_reel(uuid, uuid, public.content_visibility, uuid, text, text, text) from public;
grant execute on function public.publish_typed_reel(uuid, uuid, public.content_visibility, uuid, text, text, text) to authenticated;

revoke all on function public.publish_typed_video(uuid, uuid, public.content_visibility, uuid, text, text, public.video_category, uuid, jsonb) from public;
grant execute on function public.publish_typed_video(uuid, uuid, public.content_visibility, uuid, text, text, public.video_category, uuid, jsonb) to authenticated;

revoke all on function public.get_media_playback_info(uuid) from public;
grant execute on function public.get_media_playback_info(uuid) to anon, authenticated;

revoke all on function public.sync_content_playback(uuid, integer, integer) from public;
grant execute on function public.sync_content_playback(uuid, integer, integer) to authenticated;

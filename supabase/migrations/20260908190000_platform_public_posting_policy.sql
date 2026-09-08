-- Platform-wide moderation policy for General COT public publishing.
-- Private Expression publishing remains governed by Expression membership/capabilities.
-- Individual posting restrictions always override the global public policy.

insert into public.permissions (code, name, description, category) values
  ('platform.moderation.read', 'View platform moderation', 'View public posting policy, exemptions, moderation state, and moderation queues.', 'platform'),
  ('platform.moderation.manage', 'Manage platform moderation', 'Manage public posting policy, exemptions, and platform moderation actions.', 'platform')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    is_active = true;

insert into public.platform_role_permissions (role_code, permission_code) values
  ('super_admin', 'platform.moderation.read'),
  ('super_admin', 'platform.moderation.manage'),
  ('admin', 'platform.moderation.read'),
  ('admin', 'platform.moderation.manage'),
  ('moderator', 'platform.moderation.read'),
  ('moderator', 'platform.moderation.manage')
on conflict do nothing;

create table if not exists public.platform_public_posting_policy (
  policy_key text primary key check (policy_key = 'general'),
  mode text not null default 'open' check (mode in ('open', 'closed', 'allowlist')),
  reason text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_public_posting_exemptions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null default '',
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_public_posting_policy_updated on public.platform_public_posting_policy;
create trigger platform_public_posting_policy_updated
before update on public.platform_public_posting_policy
for each row execute function public.set_updated_at();

drop trigger if exists platform_public_posting_exemptions_updated on public.platform_public_posting_exemptions;
create trigger platform_public_posting_exemptions_updated
before update on public.platform_public_posting_exemptions
for each row execute function public.set_updated_at();

alter table public.platform_public_posting_policy enable row level security;
alter table public.platform_public_posting_exemptions enable row level security;

revoke all on table public.platform_public_posting_policy from anon, authenticated;
revoke all on table public.platform_public_posting_exemptions from anon, authenticated;
grant select, insert, update, delete on table public.platform_public_posting_policy to service_role;
grant select, insert, update, delete on table public.platform_public_posting_exemptions to service_role;

insert into public.platform_public_posting_policy(policy_key, mode, reason)
values ('general', 'open', 'Public posting is available to signed-in accounts.')
on conflict (policy_key) do nothing;

create or replace function public.can_profile_post(target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  legacy_allowed boolean := true;
  platform_restricted boolean := false;
begin
  if auth.uid() is not null and target_profile_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Profile access denied';
  end if;

  select coalesce(
    (
      select pc.posting_allowed
        or (pc.restricted_until is not null and pc.restricted_until <= now())
      from public.profile_posting_controls pc
      where pc.profile_id = target_profile_id
    ),
    true
  )
  into legacy_allowed;

  select exists (
    select 1
    from public.platform_user_restrictions r
    where r.profile_id = target_profile_id
      and r.restriction_code = 'posting'
      and r.is_active
      and (r.expires_at is null or r.expires_at > now())
  )
  into platform_restricted;

  return legacy_allowed and not platform_restricted;
end;
$function$;

create or replace function public.can_profile_post_publicly(target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  policy_mode text := 'open';
  approved boolean := false;
begin
  if auth.uid() is not null and target_profile_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Profile access denied';
  end if;

  if not public.can_profile_post(target_profile_id) then
    return false;
  end if;

  select coalesce(p.mode, 'open')
  into policy_mode
  from public.platform_public_posting_policy p
  where p.policy_key = 'general';

  if policy_mode = 'open' then
    return true;
  end if;

  if policy_mode = 'closed' then
    return false;
  end if;

  select exists (
    select 1
    from public.platform_public_posting_exemptions e
    where e.profile_id = target_profile_id
  )
  into approved;

  return approved;
end;
$function$;

revoke all on function public.can_profile_post(uuid) from public, anon;
grant execute on function public.can_profile_post(uuid) to authenticated, service_role;
revoke all on function public.can_profile_post_publicly(uuid) from public, anon;
grant execute on function public.can_profile_post_publicly(uuid) to authenticated, service_role;

create or replace function public.publish_social_post_with_uploads(
  target_organization_id uuid,
  target_visibility public.content_visibility,
  post_body text,
  target_branch_id uuid default null,
  target_group_id uuid default null,
  target_upload_ids uuid[] default array[]::uuid[]
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  media_json jsonb := '[]'::jsonb;
  valid_count integer := 0;
  distinct_count integer := 0;
  result public.social_posts;
  elevated_publisher boolean := false;
  normalized_body text := trim(coalesce(post_body, ''));
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if target_visibility = 'public'
     and target_branch_id is null
     and target_group_id is null
     and not public.can_profile_post_publicly(auth.uid()) then
    raise exception using errcode='42501', message='Public posting is currently unavailable for this account';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id,
    'feed.post',
    null
  );

  if target_visibility = 'public' and not elevated_publisher then
    if target_branch_id is not null or target_group_id is not null then
      raise exception using errcode='42501', message='General Community posts belong to the public COT space';
    end if;
    if char_length(normalized_body) > 2200 then
      raise exception using errcode='22023', message='General Community posts must be 2,200 characters or fewer';
    end if;
    if coalesce(cardinality(target_upload_ids), 0) > 4 then
      raise exception using errcode='22023', message='General Community posts can contain at most 4 media items';
    end if;
  else
    if char_length(normalized_body) > 10000 then
      raise exception using errcode='22023', message='Post body must be 10,000 characters or fewer';
    end if;
    if coalesce(cardinality(target_upload_ids), 0) > 10 then
      raise exception using errcode='22023', message='A feed post can contain at most 10 media items';
    end if;
  end if;

  if coalesce(cardinality(target_upload_ids), 0) > 0 then
    select count(distinct item_id) into distinct_count
    from unnest(target_upload_ids) item_id;
    if distinct_count <> cardinality(target_upload_ids) then
      raise exception using errcode='22023', message='Duplicate media uploads are not allowed';
    end if;

    select count(*) into valid_count
    from public.social_media_uploads u
    where u.id = any(target_upload_ids)
      and u.organization_id = target_organization_id
      and u.uploader_profile_id = auth.uid()
      and u.status = 'uploaded'
      and u.branch_id is not distinct from target_branch_id;

    if valid_count <> cardinality(target_upload_ids) then
      raise exception using errcode='42501', message='One or more media uploads are unavailable or belong to a different feed scope';
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'uploadId', u.id,
        'type', u.media_kind,
        'mimeType', u.mime_type,
        'url', u.public_url,
        'fileName', u.original_filename,
        'sizeBytes', u.size_bytes,
        'durationSeconds', u.duration_seconds
      ) order by requested.ordinality
    ), '[]'::jsonb)
    into media_json
    from unnest(target_upload_ids) with ordinality requested(id, ordinality)
    join public.social_media_uploads u on u.id = requested.id;
  end if;

  if char_length(normalized_body) = 0 and jsonb_array_length(media_json) = 0 then
    raise exception using errcode='22023', message='Write something or attach media before publishing';
  end if;

  result := public.publish_social_post(
    target_organization_id,
    target_visibility,
    normalized_body,
    target_branch_id,
    target_group_id,
    media_json
  );

  if coalesce(cardinality(target_upload_ids), 0) > 0 then
    update public.social_media_uploads
    set status = 'attached', post_id = result.id, attached_at = now()
    where id = any(target_upload_ids)
      and uploader_profile_id = auth.uid()
      and status = 'uploaded';
  end if;

  return result;
end
$function$;

create or replace function public.publish_social_reel_share(
  target_organization_id uuid,
  target_reel_id uuid,
  post_body text default ''
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  shared_reel public.reels;
  content_row public.content_items;
  elevated_publisher boolean := false;
  result public.social_posts;
  normalized_body text := trim(coalesce(post_body, ''));
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not public.can_profile_post_publicly(auth.uid()) then
    raise exception using errcode='42501', message='Public posting is currently unavailable for this account';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id,
    'feed.post',
    null
  );

  select r.* into shared_reel
  from public.reels r
  where r.id = target_reel_id
    and r.organization_id = target_organization_id;

  if not found then
    raise exception using errcode='P0002', message='Reel not found';
  end if;

  select * into content_row
  from public.content_items ci
  where ci.id = shared_reel.id
    and ci.organization_id = target_organization_id
    and ci.content_type = 'reel'
    and ci.visibility = 'public'
    and ci.status = 'published';

  if not found then
    raise exception using errcode='42501', message='Only published public Reels can be shared to General Community';
  end if;

  result := public.publish_social_post(
    target_organization_id,
    'public',
    left(normalized_body, case when elevated_publisher then 10000 else 2200 end),
    null,
    null,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'reel_reference',
        'reelId', shared_reel.id,
        'mediaAssetId', shared_reel.media_asset_id,
        'caption', shared_reel.caption
      )
    )
  );

  update public.reels
  set shares_count = coalesce(shares_count, 0) + 1
  where id = shared_reel.id;

  return result;
end
$function$;

create or replace function public.publish_typed_reel(
  p_org_id uuid,
  p_expression_id uuid,
  p_visibility public.content_visibility,
  p_media_asset_id uuid,
  p_caption text,
  p_audio_title text default null,
  p_audio_artist text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_content_id uuid;
  v_asset public.media_assets;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_org_id and o.status = 'active'
  ) then
    raise exception using errcode='22023', message='This church community is not available';
  end if;

  if p_expression_id is null then
    if p_visibility <> 'public'::public.content_visibility then
      raise exception using errcode='22023', message='General Reels must be public';
    end if;
    if not public.can_profile_post_publicly(auth.uid()) then
      raise exception using errcode='42501', message='Public posting is currently unavailable for this account';
    end if;
  else
    if p_visibility <> 'branch'::public.content_visibility then
      raise exception using errcode='22023', message='Expression Reels must stay inside the Expression';
    end if;
    if not public.is_expression_member(p_org_id, p_expression_id) then
      raise exception using errcode='42501', message='Expression membership required';
    end if;
    if not public.has_permission(p_org_id, 'reels.publish', p_expression_id) then
      raise exception using errcode='42501', message='Permission denied to publish Reels in this Expression';
    end if;
  end if;

  select *
  into v_asset
  from public.media_assets
  where id = p_media_asset_id
    and organization_id = p_org_id;

  if not found then
    raise exception using errcode='P0002', message='Media asset not found in organization';
  end if;
  if v_asset.media_type <> 'video'::public.media_asset_type then
    raise exception using errcode='22023', message='A Reel requires a video media asset';
  end if;
  if v_asset.processing_state <> 'ready'::public.media_processing_state then
    raise exception using errcode='22023', message='Reel video upload is not ready';
  end if;
  if v_asset.expression_id is distinct from p_expression_id then
    raise exception using errcode='42501', message='Media asset belongs to a different publishing space';
  end if;
  if v_asset.created_by <> auth.uid()
     and not public.has_permission(p_org_id, 'media.manage', p_expression_id) then
    raise exception using errcode='42501', message='Media asset belongs to another creator';
  end if;

  insert into public.content_items(
    organization_id, expression_id, author_profile_id,
    content_type, visibility, status, published_at
  )
  values (
    p_org_id, p_expression_id, auth.uid(),
    'reel', p_visibility, 'published', now()
  )
  returning id into v_content_id;

  insert into public.reels(
    id, organization_id, media_asset_id, caption,
    audio_title, audio_artist
  )
  values (
    v_content_id, p_org_id, p_media_asset_id, trim(p_caption),
    nullif(trim(p_audio_title), ''), nullif(trim(p_audio_artist), '')
  );

  return jsonb_build_object('id', v_content_id, 'status', 'published');
end
$function$;

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
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_content_id uuid;
  v_slug text;
  v_asset public.media_assets;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_org_id and o.status = 'active'
  ) then
    raise exception using errcode='22023', message='This church community is not available';
  end if;

  if p_expression_id is null then
    if p_visibility <> 'public'::public.content_visibility then
      raise exception using errcode='22023', message='General videos must be public';
    end if;
    if not public.can_profile_post_publicly(auth.uid()) then
      raise exception using errcode='42501', message='Public posting is currently unavailable for this account';
    end if;
  else
    if p_visibility <> 'branch'::public.content_visibility then
      raise exception using errcode='22023', message='Expression videos must stay inside the Expression';
    end if;
    if not public.is_expression_member(p_org_id, p_expression_id) then
      raise exception using errcode='42501', message='Expression membership required';
    end if;
    if not public.has_permission(p_org_id, 'videos.publish', p_expression_id) then
      raise exception using errcode='42501', message='Permission denied to publish videos in this Expression';
    end if;
  end if;

  select *
  into v_asset
  from public.media_assets
  where id = p_media_asset_id
    and organization_id = p_org_id;

  if not found then
    raise exception using errcode='P0002', message='Media asset not found in organization';
  end if;
  if v_asset.media_type <> 'video'::public.media_asset_type then
    raise exception using errcode='22023', message='A Watch video requires a video media asset';
  end if;
  if v_asset.processing_state <> 'ready'::public.media_processing_state then
    raise exception using errcode='22023', message='Video upload is not ready';
  end if;
  if v_asset.expression_id is distinct from p_expression_id then
    raise exception using errcode='42501', message='Media asset belongs to a different publishing space';
  end if;
  if v_asset.created_by <> auth.uid()
     and not public.has_permission(p_org_id, 'media.manage', p_expression_id) then
    raise exception using errcode='42501', message='Media asset belongs to another creator';
  end if;

  v_slug := lower(regexp_replace(trim(p_title), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(md5(random()::text), 1, 6);

  insert into public.content_items(
    organization_id, expression_id, author_profile_id,
    content_type, visibility, status, published_at
  )
  values (
    p_org_id, p_expression_id, auth.uid(),
    'video', p_visibility, 'published', now()
  )
  returning id into v_content_id;

  insert into public.videos(
    id, organization_id, media_asset_id, series_id,
    title, slug, description, category, chapters
  )
  values (
    v_content_id, p_org_id, p_media_asset_id, p_series_id,
    trim(p_title), v_slug, coalesce(p_description, ''),
    p_category, coalesce(p_chapters, '[]'::jsonb)
  );

  return jsonb_build_object(
    'id', v_content_id,
    'slug', v_slug,
    'status', 'published'
  );
end
$function$;

revoke all on function public.publish_social_post_with_uploads(uuid, public.content_visibility, text, uuid, uuid, uuid[]) from public, anon;
grant execute on function public.publish_social_post_with_uploads(uuid, public.content_visibility, text, uuid, uuid, uuid[]) to authenticated, service_role;
revoke all on function public.publish_social_reel_share(uuid, uuid, text) from public, anon;
grant execute on function public.publish_social_reel_share(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.publish_typed_reel(uuid, uuid, public.content_visibility, uuid, text, text, text) from public, anon;
grant execute on function public.publish_typed_reel(uuid, uuid, public.content_visibility, uuid, text, text, text) to authenticated, service_role;
revoke all on function public.publish_typed_video(uuid, uuid, public.content_visibility, uuid, text, text, public.video_category, uuid, jsonb) from public, anon;
grant execute on function public.publish_typed_video(uuid, uuid, public.content_visibility, uuid, text, text, public.video_category, uuid, jsonb) to authenticated, service_role;

comment on table public.platform_public_posting_policy is 'Global General COT public posting mode. Does not govern private Expression publishing.';
comment on table public.platform_public_posting_exemptions is 'Accounts explicitly allowed to publish publicly when General COT uses approved-accounts-only mode.';
comment on function public.can_profile_post_publicly(uuid) is 'Combines individual posting restrictions with the global General COT public posting policy.';

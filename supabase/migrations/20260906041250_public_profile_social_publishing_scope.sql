alter table public.social_posts
  alter column author_membership_id drop not null;

alter table public.social_posts
  drop constraint if exists social_posts_public_profile_author_scope_check;

alter table public.social_posts
  add constraint social_posts_public_profile_author_scope_check
  check (
    author_membership_id is not null
    or (
      visibility = 'public'::public.content_visibility
      and branch_id is null
      and group_id is null
    )
  );

drop policy if exists posts_author_read on public.social_posts;
create policy posts_author_read
on public.social_posts
for select to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    where ci.id = social_posts.id
      and ci.organization_id = social_posts.organization_id
      and ci.author_profile_id = (select auth.uid())
  )
);

drop policy if exists posts_author_update on public.social_posts;
create policy posts_author_update
on public.social_posts
for update to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    where ci.id = social_posts.id
      and ci.organization_id = social_posts.organization_id
      and ci.author_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.content_items ci
    where ci.id = social_posts.id
      and ci.organization_id = social_posts.organization_id
      and ci.author_profile_id = (select auth.uid())
  )
);

create or replace function public.publish_social_post(
  target_organization_id uuid,
  target_visibility public.content_visibility,
  post_body text,
  target_branch_id uuid default null,
  target_group_id uuid default null,
  post_media jsonb default '[]'::jsonb
)
returns public.social_posts
language plpgsql
security definer
set search_path=''
as $function$
declare
  member public.memberships;
  result public.social_posts;
  elevated_publisher boolean := false;
  content_id uuid;
  normalized_body text := trim(coalesce(post_body, ''));
  normalized_media jsonb := coalesce(post_media, '[]'::jsonb);
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = target_organization_id
      and o.status = 'active'
  ) then
    raise exception using errcode='22023', message='This church community is not available';
  end if;

  select * into member
  from public.memberships
  where organization_id = target_organization_id
    and profile_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;

  if public.is_profile_restricted(auth.uid(), 'posting') then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
  end if;

  if jsonb_typeof(normalized_media) <> 'array' then
    raise exception using errcode='22023', message='Post media must be an array';
  end if;
  if char_length(normalized_body) > 10000 then
    raise exception using errcode='22023', message='Post body must be 10,000 characters or fewer';
  end if;
  if char_length(normalized_body) = 0 and jsonb_array_length(normalized_media) = 0 then
    raise exception using errcode='22023', message='Write something or attach media before publishing';
  end if;

  if target_visibility is null or target_visibility not in ('public','branch','group') then
    raise exception using errcode='22023', message='Unsupported community post visibility';
  end if;
  if target_visibility = 'group' and target_group_id is null then
    raise exception using errcode='22023', message='Group context is required';
  end if;
  if target_visibility <> 'group' and target_group_id is not null then
    raise exception using errcode='22023', message='Group context is only valid for group posts';
  end if;
  if target_visibility in ('branch','group') and target_branch_id is null then
    raise exception using errcode='22023', message='Expression context is required';
  end if;

  if target_branch_id is not null then
    if member.id is null then
      raise exception using errcode='42501', message='Active organisation membership required for scoped publishing';
    end if;
    if not public.is_expression_member(target_organization_id, target_branch_id) then
      raise exception using errcode='42501', message='Expression membership required';
    end if;
  elsif target_group_id is not null then
    raise exception using errcode='22023', message='Expression context is required for group posts';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id,
    'feed.post',
    target_branch_id
  );

  if target_visibility <> 'public' and not elevated_publisher then
    raise exception using errcode='42501', message='Permission denied';
  end if;

  if target_visibility = 'group' then
    if member.id is null then
      raise exception using errcode='42501', message='Active organisation membership required for group publishing';
    end if;
    if not exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = target_group_id
        and gm.membership_id = member.id
        and gm.status = 'active'
    )
    and not public.has_permission(
      target_organization_id,
      'feed.moderate',
      target_branch_id
    ) then
      raise exception using errcode='42501', message='Group access denied';
    end if;
  end if;

  insert into public.content_items (
    organization_id, expression_id, group_id, author_profile_id,
    content_type, visibility, status, published_at
  )
  values (
    target_organization_id, target_branch_id, target_group_id, auth.uid(),
    'post', target_visibility, 'published', now()
  )
  returning id into content_id;

  insert into public.social_posts (
    id, organization_id, author_membership_id, branch_id, group_id,
    visibility, status, body, media, published_at
  )
  values (
    content_id, target_organization_id, member.id, target_branch_id, target_group_id,
    target_visibility, 'published', normalized_body, normalized_media, now()
  )
  returning * into result;

  insert into public.domain_events (
    organization_id, event_type, aggregate_type, aggregate_id,
    actor_profile_id, payload, deduplication_key
  )
  values (
    target_organization_id,
    'social.post.published',
    'social_post',
    result.id::text,
    auth.uid(),
    jsonb_build_object(
      'postId', result.id,
      'visibility', result.visibility,
      'branchId', result.branch_id,
      'groupId', result.group_id
    ),
    'social-post:' || result.id
  );

  return result;
end
$function$;

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
set search_path=''
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
      raise exception using errcode='22023', message='General Community member posts must be 2,200 characters or fewer';
    end if;
    if coalesce(cardinality(target_upload_ids), 0) > 4 then
      raise exception using errcode='22023', message='General Community member posts can contain at most 4 media items';
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

    if target_visibility = 'public' and not elevated_publisher then
      if exists (
        select 1 from public.social_media_uploads u
        where u.id = any(target_upload_ids)
          and u.media_kind not in ('image', 'video')
      ) then
        raise exception using errcode='22023', message='General Community member posts support images and short videos only';
      end if;

      if exists (
        select 1 from public.social_media_uploads u
        where u.id = any(target_upload_ids)
          and u.media_kind = 'video'
          and (u.duration_seconds is null or u.duration_seconds <= 0 or u.duration_seconds > 180)
      ) then
        raise exception using errcode='22023', message='General Community member videos must be 3 minutes or shorter';
      end if;
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
    where id = any(target_upload_ids) and status = 'uploaded';
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
set search_path=''
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

  if public.is_profile_restricted(auth.uid(), 'posting') then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
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

revoke all on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) to service_role;

revoke all on function public.publish_social_post_with_uploads(uuid,public.content_visibility,text,uuid,uuid,uuid[]) from public, anon;
grant execute on function public.publish_social_post_with_uploads(uuid,public.content_visibility,text,uuid,uuid,uuid[]) to authenticated, service_role;

revoke all on function public.publish_social_reel_share(uuid,uuid,text) from public, anon;
grant execute on function public.publish_social_reel_share(uuid,uuid,text) to authenticated, service_role;

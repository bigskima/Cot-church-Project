-- General Community unrestricted publishing requires organization-root feed.post.
-- Expression-scoped feed.post remains valid inside that Expression but does not
-- bypass the ordinary member limits on the church-wide General feed.

-- Keep the ordinary General Community member lane concise while preserving
-- the broader publisher editor for authorized church/Expression publishers.
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
as $$
declare
  media_json jsonb := '[]'::jsonb;
  valid_count integer := 0;
  distinct_count integer := 0;
  result public.social_posts;
  elevated_publisher boolean := false;
  active_expression_member boolean := false;
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

  select exists (
    select 1
    from public.expression_memberships em
    join public.branches b on b.id = em.branch_id
    where em.organization_id = target_organization_id
      and em.profile_id = auth.uid()
      and em.status = 'active'
      and b.is_active = true
  ) into active_expression_member;

  if target_visibility = 'public' and not elevated_publisher then
    if target_branch_id is not null or target_group_id is not null then
      raise exception using errcode='42501', message='Member public posts belong to General Community';
    end if;
    if not active_expression_member then
      raise exception using errcode='42501', message='Active Expression membership required for General Community publishing';
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
end;
$$;

create or replace function public.publish_social_reel_share(
  target_organization_id uuid,
  target_reel_id uuid,
  post_body text default ''
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.memberships;
  shared_reel public.reels;
  content_row public.content_items;
  active_expression_member boolean := false;
  elevated_publisher boolean := false;
  result public.social_posts;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into member
  from public.memberships
  where organization_id = target_organization_id
    and profile_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception using errcode='42501', message='Active organisation membership required';
  end if;

  if public.is_profile_restricted(auth.uid(), 'posting') then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id,
    'feed.post',
    null
  );

  if not active_expression_member and not elevated_publisher then
    raise exception using errcode='42501', message='Active Expression membership required for General Community publishing';
  end if;

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
    left(trim(coalesce(post_body, '')), 10000),
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
end;
$$;

revoke all on function public.publish_social_reel_share(uuid,uuid,text) from public, anon;
grant execute on function public.publish_social_reel_share(uuid,uuid,text) to authenticated, service_role;


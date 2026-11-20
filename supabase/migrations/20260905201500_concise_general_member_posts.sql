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

  select exists (
    select 1
    from public.memberships m
    join public.role_assignments ra
      on ra.membership_id = m.id
     and ra.organization_id = m.organization_id
    join public.role_permissions rp on rp.role_id = ra.role_id
    join public.permissions p on p.code = rp.permission_code
    where m.organization_id = target_organization_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and rp.permission_code = 'feed.post'
      and p.is_active = true
      and (ra.expires_at is null or ra.expires_at > now())
  ) into elevated_publisher;

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
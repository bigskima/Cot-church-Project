-- General COT is a public participation surface for every authenticated account.
-- Public creation is restriction-aware and owner-scoped; Expression publishing keeps
-- the existing scoped capability and membership model.

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
    if not public.can_profile_post(auth.uid()) then
      raise exception using errcode='42501', message='Posting is currently restricted for this account';
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
    if not public.can_profile_post(auth.uid()) then
      raise exception using errcode='42501', message='Posting is currently restricted for this account';
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

revoke all on function public.publish_social_post_with_uploads(
  uuid, public.content_visibility, text, uuid, uuid, uuid[]
) from public, anon;
grant execute on function public.publish_social_post_with_uploads(
  uuid, public.content_visibility, text, uuid, uuid, uuid[]
) to authenticated, service_role;

revoke all on function public.publish_typed_reel(
  uuid, uuid, public.content_visibility, uuid, text, text, text
) from public, anon;
grant execute on function public.publish_typed_reel(
  uuid, uuid, public.content_visibility, uuid, text, text, text
) to authenticated, service_role;

revoke all on function public.publish_typed_video(
  uuid, uuid, public.content_visibility, uuid, text, text, public.video_category, uuid, jsonb
) from public, anon;
grant execute on function public.publish_typed_video(
  uuid, uuid, public.content_visibility, uuid, text, text, public.video_category, uuid, jsonb
) to authenticated, service_role;

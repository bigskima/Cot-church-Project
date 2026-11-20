-- General Community member publishing policy.
-- Ordinary members may publish lightweight social content publicly only after
-- joining an active Expression. Ministry-authoritative content remains on the
-- separate Sermon / Reel / Watch / Live publishing paths and permissions.

alter table public.social_media_uploads
  add column if not exists duration_seconds integer;

alter table public.social_media_uploads
  drop constraint if exists social_media_uploads_duration_seconds_check;

alter table public.social_media_uploads
  add constraint social_media_uploads_duration_seconds_check
  check (duration_seconds is null or duration_seconds between 0 and 86400);

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
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id,
    'feed.post',
    target_branch_id
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

  -- General Community member lane: joining an active Expression unlocks
  -- lightweight public social posting. Platform/church publishers with feed.post
  -- remain elevated and are not constrained by this member-only lane.
  if target_visibility = 'public' and not elevated_publisher then
    if target_branch_id is not null or target_group_id is not null then
      raise exception using errcode='42501', message='Member public posts belong to General Community';
    end if;

    if not active_expression_member then
      raise exception using errcode='42501', message='Active Expression membership required for General Community publishing';
    end if;

    if coalesce(cardinality(target_upload_ids), 0) > 4 then
      raise exception using errcode='22023', message='General Community member posts can contain at most 4 media items';
    end if;
  elsif coalesce(cardinality(target_upload_ids), 0) > 10 then
    raise exception using errcode='22023', message='A feed post can contain at most 10 media items';
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
        select 1
        from public.social_media_uploads u
        where u.id = any(target_upload_ids)
          and u.media_kind not in ('image', 'video')
      ) then
        raise exception using errcode='22023', message='General Community member posts support images and short videos only';
      end if;

      if exists (
        select 1
        from public.social_media_uploads u
        where u.id = any(target_upload_ids)
          and u.media_kind = 'video'
          and (
            u.duration_seconds is null
            or u.duration_seconds <= 0
            or u.duration_seconds > 180
          )
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

  if char_length(trim(coalesce(post_body, ''))) = 0 and jsonb_array_length(media_json) = 0 then
    raise exception using errcode='22023', message='Write something or attach media before publishing';
  end if;

  result := public.publish_social_post(
    target_organization_id,
    target_visibility,
    coalesce(trim(post_body), ''),
    target_branch_id,
    target_group_id,
    media_json
  );

  if coalesce(cardinality(target_upload_ids), 0) > 0 then
    update public.social_media_uploads
    set status = 'attached',
        post_id = result.id,
        attached_at = now()
    where id = any(target_upload_ids)
      and status = 'uploaded';
  end if;

  return result;
end;
$$;

-- The base publisher accepts raw JSON media and must not be callable directly by
-- ordinary clients; social-feed publishes through the validated upload wrapper.
revoke execute on function public.publish_social_post(
  uuid, public.content_visibility, text, uuid, uuid, jsonb
) from authenticated;

grant execute on function public.publish_social_post(
  uuid, public.content_visibility, text, uuid, uuid, jsonb
) to service_role;

revoke all on function public.publish_social_post_with_uploads(
  uuid, public.content_visibility, text, uuid, uuid, uuid[]
) from public, anon;

grant execute on function public.publish_social_post_with_uploads(
  uuid, public.content_visibility, text, uuid, uuid, uuid[]
) to authenticated, service_role;

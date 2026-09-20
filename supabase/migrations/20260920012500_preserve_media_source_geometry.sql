-- Preserve source media geometry so every COT surface can render the upload
-- in its natural portrait, square, or landscape ratio instead of forcing one
-- presentation rectangle.

alter table public.social_media_uploads
  add column if not exists width integer,
  add column if not exists height integer;

alter table public.social_media_uploads
  drop constraint if exists social_media_uploads_width_check,
  drop constraint if exists social_media_uploads_height_check;
alter table public.social_media_uploads
  add constraint social_media_uploads_width_check check (width is null or width between 1 and 32768),
  add constraint social_media_uploads_height_check check (height is null or height between 1 and 32768);

alter table public.chat_media_uploads
  add column if not exists width integer,
  add column if not exists height integer;

alter table public.chat_media_uploads
  drop constraint if exists chat_media_uploads_width_check,
  drop constraint if exists chat_media_uploads_height_check;
alter table public.chat_media_uploads
  add constraint chat_media_uploads_width_check check (width is null or width between 1 and 32768),
  add constraint chat_media_uploads_height_check check (height is null or height between 1 and 32768);

alter table public.expression_chat_uploads
  add column if not exists width integer,
  add column if not exists height integer;

alter table public.expression_chat_uploads
  drop constraint if exists expression_chat_uploads_width_check,
  drop constraint if exists expression_chat_uploads_height_check;
alter table public.expression_chat_uploads
  add constraint expression_chat_uploads_width_check check (width is null or width between 1 and 32768),
  add constraint expression_chat_uploads_height_check check (height is null or height between 1 and 32768);

-- Keep the existing publishing policy unchanged. The only behavioral change in
-- this replacement is that validated source width/height travel into the
-- immutable post media JSON used by every feed/profile/detail renderer.
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

  if not public.can_profile_post(auth.uid()) then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
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
        'durationSeconds', u.duration_seconds,
        'width', u.width,
        'height', u.height
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

comment on column public.social_media_uploads.width is 'Source pixel width captured from the client upload picker when available.';
comment on column public.social_media_uploads.height is 'Source pixel height captured from the client upload picker when available.';
comment on column public.chat_media_uploads.width is 'Source pixel width used to preserve chat media aspect ratio.';
comment on column public.chat_media_uploads.height is 'Source pixel height used to preserve chat media aspect ratio.';
comment on column public.expression_chat_uploads.width is 'Source pixel width used to preserve Expression discussion media aspect ratio.';
comment on column public.expression_chat_uploads.height is 'Source pixel height used to preserve Expression discussion media aspect ratio.';

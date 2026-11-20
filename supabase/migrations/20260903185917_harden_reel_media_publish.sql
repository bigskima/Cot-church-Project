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
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.has_permission(p_org_id, 'reels.publish', p_expression_id) then
    raise exception using errcode = '42501', message = 'Permission denied to publish reels in this expression';
  end if;

  if p_visibility not in ('public'::public.content_visibility, 'branch'::public.content_visibility) then
    raise exception using errcode = '22023', message = 'Reels must be public or Expression scoped';
  end if;
  if p_visibility = 'branch'::public.content_visibility and p_expression_id is null then
    raise exception using errcode = '22023', message = 'Expression reels require an Expression';
  end if;

  select * into v_asset
  from public.media_assets
  where id = p_media_asset_id
    and organization_id = p_org_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Media asset not found in organization';
  end if;
  if v_asset.media_type <> 'video'::public.media_asset_type then
    raise exception using errcode = '22023', message = 'A Reel requires a video media asset';
  end if;
  if v_asset.processing_state <> 'ready'::public.media_processing_state then
    raise exception using errcode = '22023', message = 'Reel video upload is not ready';
  end if;
  if v_asset.expression_id is distinct from p_expression_id then
    raise exception using errcode = '42501', message = 'Media asset belongs to a different publishing scope';
  end if;
  if v_asset.created_by <> auth.uid()
     and not public.has_permission(p_org_id, 'media.manage', p_expression_id) then
    raise exception using errcode = '42501', message = 'Media asset belongs to another creator';
  end if;

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
    nullif(trim(p_audio_title), ''), nullif(trim(p_audio_artist), '')
  );

  return jsonb_build_object('id', v_content_id, 'status', 'published');
end;
$$;

revoke all on function public.publish_typed_reel(uuid,uuid,public.content_visibility,uuid,text,text,text) from public;
grant execute on function public.publish_typed_reel(uuid,uuid,public.content_visibility,uuid,text,text,text) to authenticated;
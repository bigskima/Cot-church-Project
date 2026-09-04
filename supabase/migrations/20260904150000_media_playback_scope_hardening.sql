-- Enforce the Public/Expression boundary inside security-definer playback RPCs.
create or replace function public.get_media_playback_info(p_content_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item public.content_items; v_asset public.media_assets; v_renditions jsonb; v_tracks jsonb; v_thumbnails jsonb;
begin
  select * into v_item from public.content_items where id=p_content_id;
  if not found then raise exception using errcode='P0002',message='Content item not found'; end if;
  if v_item.status <> 'published' and v_item.author_profile_id is distinct from auth.uid()
    and not (public.has_permission(v_item.organization_id,'media.manage',v_item.expression_id) or public.has_permission(v_item.organization_id,'content.moderate',v_item.expression_id))
  then raise exception using errcode='42501',message='Unpublished content is restricted'; end if;
  if v_item.status='published' and not public.can_read_social_scope(v_item.organization_id,v_item.visibility,v_item.expression_id,v_item.group_id)
  then raise exception using errcode='42501',message='Content playback is restricted'; end if;

  select ma.* into v_asset from public.media_assets ma where ma.id=(
    select asset_id from (
      select v.media_asset_id asset_id,1 priority from public.videos v where v.id=p_content_id
      union all select r.media_asset_id,1 from public.reels r where r.id=p_content_id
      union all select s.video_asset_id,1 from public.sermons s where s.content_item_id=p_content_id and s.video_asset_id is not null
      union all select s.audio_asset_id,2 from public.sermons s where s.content_item_id=p_content_id and s.audio_asset_id is not null
    ) assets order by priority limit 1
  ) and ma.organization_id=v_item.organization_id and (ma.expression_id is null or ma.expression_id is not distinct from v_item.expression_id);
  if not found then return jsonb_build_object('available',false,'reason','No media attached'); end if;
  if v_asset.processing_state <> 'ready' then return jsonb_build_object('available',false,'reason','Media is still processing','processingState',v_asset.processing_state); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',rendition_kind,'container',container,'codec',codec,'width',width,'height',height,'bitrate',bitrate_bps,'storagePath',storage_path,'providerPlaybackId',provider_playback_id,'isMaster',is_master)),'[]') into v_renditions from public.media_renditions where media_asset_id=v_asset.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',track_type,'language',language,'label',label,'storagePath',storage_path,'isDefault',is_default)),'[]') into v_tracks from public.media_tracks where media_asset_id=v_asset.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'storagePath',storage_path,'width',width,'height',height,'isPrimary',is_primary)),'[]') into v_thumbnails from public.media_thumbnails where media_asset_id=v_asset.id;
  return jsonb_build_object('available',true,'assetId',v_asset.id,'mediaType',v_asset.media_type,'processingState',v_asset.processing_state,'durationSeconds',v_asset.duration_seconds,'renditions',v_renditions,'tracks',v_tracks,'thumbnails',v_thumbnails);
end $$;

create or replace function public.sync_content_playback(p_content_id uuid,p_progress_seconds integer,p_duration_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item public.content_items;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if p_duration_seconds <= 0 or p_duration_seconds > 86400 or p_progress_seconds < 0 or p_progress_seconds > p_duration_seconds + 60
  then raise exception using errcode='22023',message='Invalid playback progress'; end if;
  select * into v_item from public.content_items where id=p_content_id and status='published';
  if not found then raise exception using errcode='P0002',message='Content item not found'; end if;
  if not public.can_read_social_scope(v_item.organization_id,v_item.visibility,v_item.expression_id,v_item.group_id)
  then raise exception using errcode='42501',message='Content playback is restricted'; end if;
  insert into public.content_playback_progress(content_item_id,profile_id,progress_seconds,duration_seconds,completed,last_played_at)
  values(p_content_id,auth.uid(),least(p_progress_seconds,p_duration_seconds),p_duration_seconds,p_progress_seconds>=p_duration_seconds*0.9,now())
  on conflict(content_item_id,profile_id) do update set progress_seconds=excluded.progress_seconds,duration_seconds=excluded.duration_seconds,completed=excluded.completed,last_played_at=now();
  return jsonb_build_object('saved',true,'completed',p_progress_seconds>=p_duration_seconds*0.9);
end $$;

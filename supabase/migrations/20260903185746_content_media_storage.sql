-- Protected source storage for reels, long-form video, sermon media and audio.
-- Playback is resolved server-side after content visibility checks; source files
-- are never made public merely because they exist in Storage.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'content-media',
  'content-media',
  false,
  209715200,
  array[
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav',
    'image/jpeg','image/png','image/webp'
  ]
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Media rendition metadata is readable only when its parent asset itself is
-- visible to the caller. Writes remain server-mediated through content-media.
drop policy if exists media_renditions_read on public.media_renditions;
create policy media_renditions_read on public.media_renditions
for select using (
  exists (
    select 1 from public.media_assets ma
    where ma.id = media_renditions.media_asset_id
      and ma.organization_id = media_renditions.organization_id
  )
);

drop policy if exists media_thumbnails_read on public.media_thumbnails;
create policy media_thumbnails_read on public.media_thumbnails
for select using (
  exists (
    select 1 from public.media_assets ma
    where ma.id = media_thumbnails.media_asset_id
      and ma.organization_id = media_thumbnails.organization_id
  )
);

drop policy if exists media_tracks_read on public.media_tracks;
create policy media_tracks_read on public.media_tracks
for select using (
  exists (
    select 1 from public.media_assets ma
    where ma.id = media_tracks.media_asset_id
      and ma.organization_id = media_tracks.organization_id
  )
);
-- Direct-to-Storage signed uploads keep video/audio payloads out of Edge Function
-- request bodies. Edge Functions create the signed intent and verify completion.
alter table public.social_media_uploads
  drop constraint if exists social_media_uploads_status_check;
alter table public.social_media_uploads
  add constraint social_media_uploads_status_check
  check (status in ('pending','uploaded','attached','deleted'));

alter table public.social_media_uploads
  alter column status set default 'pending';

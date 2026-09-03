-- Public community posts may contain images, video, or audio. The bucket is
-- public-read because media attached here is only for posts with public
-- visibility. Uploads are performed by the authenticated Edge Function using
-- the service role; clients do not receive direct write policies.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'community-public-media',
  'community-public-media',
  true,
  52428800,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav'
  ]
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table storage.buckets is
  'Supabase managed storage bucket registry. community-public-media is intentionally public-read; writes are server mediated.';

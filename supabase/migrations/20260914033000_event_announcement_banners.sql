-- Optional presentation banners for events and announcements.
-- Upload writes use short-lived signed URLs from authorized Edge Functions;
-- public buckets only expose the final display image.

alter table public.events
  add column if not exists banner_url text;

alter table public.announcements
  add column if not exists banner_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-banners', 'event-banners', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('announcement-banners', 'announcement-banners', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_banners_public_read on storage.objects;
create policy event_banners_public_read on storage.objects
for select using (bucket_id = 'event-banners');

drop policy if exists announcement_banners_public_read on storage.objects;
create policy announcement_banners_public_read on storage.objects
for select using (bucket_id = 'announcement-banners');

comment on column public.events.banner_url is 'Optional public event flyer/banner URL.';
comment on column public.announcements.banner_url is 'Optional public announcement flyer/banner URL.';

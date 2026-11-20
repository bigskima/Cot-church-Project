-- Public presentation images use dedicated public buckets. Writes are issued only
-- through short-lived signed URLs created by authorized Edge Functions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('sermon-banners', 'sermon-banners', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('leadership-portraits', 'leadership-portraits', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sermon_banners_public_read on storage.objects;
create policy sermon_banners_public_read on storage.objects for select using (bucket_id = 'sermon-banners');
drop policy if exists leadership_portraits_public_read on storage.objects;
create policy leadership_portraits_public_read on storage.objects for select using (bucket_id = 'leadership-portraits');

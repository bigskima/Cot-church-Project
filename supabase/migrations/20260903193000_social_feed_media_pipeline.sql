-- Production media lifecycle for General Community and Expression social feeds.
-- Clients upload through a trusted Edge Function; social-feed only accepts upload
-- ids owned by the current profile and sanitizes the media JSON before publishing.

create table if not exists public.social_media_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  uploader_profile_id uuid not null references public.profiles(id) on delete cascade,
  media_kind text not null check (media_kind in ('image','video','audio')),
  mime_type text not null check (char_length(trim(mime_type)) between 3 and 120),
  storage_path text not null unique check (char_length(trim(storage_path)) between 1 and 1000),
  public_url text not null check (char_length(trim(public_url)) between 1 and 2000),
  original_filename text,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  status text not null default 'uploaded' check (status in ('uploaded','attached','deleted')),
  post_id uuid references public.social_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  deleted_at timestamptz,
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict
);

create index if not exists social_media_uploads_owner_status_idx
  on public.social_media_uploads(organization_id, uploader_profile_id, status, created_at desc);
create index if not exists social_media_uploads_post_idx
  on public.social_media_uploads(post_id)
  where post_id is not null;

alter table public.social_media_uploads enable row level security;
-- Deliberately no client write policy. Upload/attach/delete operations are mediated
-- by Edge Functions using the service role after authenticating the caller.

-- A social post may now be media-only. Empty text is valid only when at least one
-- validated media attachment exists.
alter table public.social_posts drop constraint if exists social_posts_body_check;
alter table public.social_posts
  add constraint social_posts_body_check check (
    char_length(trim(body)) between 1 and 10000
    or (char_length(trim(body)) = 0 and jsonb_array_length(media) > 0)
  );

comment on table public.social_media_uploads is
  'Server-mediated upload lifecycle for images, videos, and audio attached to General Community or Expression feed posts.';

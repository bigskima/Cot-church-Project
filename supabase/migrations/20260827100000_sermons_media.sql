-- Sermons, Sermon Series, Devotionals, and Livestream Recording Conversion.

insert into public.permissions (code, name, description, category) values
  ('sermons.read', 'View sermons', 'Browse and stream published sermons and series.', 'media'),
  ('sermons.create', 'Create sermon drafts', 'Create sermon drafts and upload sermon media.', 'media'),
  ('sermons.manage', 'Manage sermons and series', 'Edit sermon metadata, transcripts, and series.', 'media'),
  ('sermons.publish', 'Publish sermons', 'Publish and schedule sermons and media.', 'media'),
  ('devotionals.manage', 'Manage devotionals', 'Create, edit, and publish devotional content.', 'media'),
  ('livestream.publish_recording', 'Convert stream to sermon', 'Convert completed live stream recordings into sermon assets.', 'media')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_active = true;

create table public.sermon_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  title text not null check(char_length(trim(title)) between 1 and 200),
  slug text not null,
  description text not null default '',
  artwork_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_featured boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table public.sermons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  series_id uuid,
  recording_id uuid references public.live_recordings(id) on delete set null,
  title text not null check(char_length(trim(title)) between 1 and 200),
  slug text not null,
  preacher text not null check(char_length(trim(preacher)) between 1 and 120),
  sermon_date date not null default current_date,
  scripture_references text[] not null default '{}',
  topics text[] not null default '{}',
  description text not null default '',
  transcript text,
  audio_url text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer check(duration_seconds is null or duration_seconds >= 0),
  status text not null default 'draft' check(status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  visibility public.content_visibility not null default 'public',
  is_featured boolean not null default false,
  play_count integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id),
  foreign key (series_id, organization_id) references public.sermon_series(id, organization_id) on delete set null
);

create table public.devotionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  sermon_id uuid,
  title text not null check(char_length(trim(title)) between 1 and 200),
  scripture text not null,
  content text not null,
  publish_date date not null default current_date,
  status text not null default 'draft' check(status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (sermon_id, organization_id) references public.sermons(id, organization_id) on delete set null
);

create index sermon_series_org_idx on public.sermon_series(organization_id, is_featured, starts_at desc);
create index sermons_org_date_idx on public.sermons(organization_id, status, sermon_date desc);
create index sermons_series_idx on public.sermons(series_id) where series_id is not null;
create index devotionals_date_idx on public.devotionals(organization_id, status, publish_date desc);

create trigger sermon_series_updated before update on public.sermon_series for each row execute function public.set_updated_at();
create trigger sermons_updated before update on public.sermons for each row execute function public.set_updated_at();
create trigger devotionals_updated before update on public.devotionals for each row execute function public.set_updated_at();

alter table public.sermon_series enable row level security;
alter table public.sermons enable row level security;
alter table public.devotionals enable row level security;

create policy sermon_series_public_read on public.sermon_series
  for select using (true);

create policy sermon_series_admin_manage on public.sermon_series
  for all to authenticated
  using (public.has_permission(organization_id, 'sermons.manage', expression_id))
  with check (public.has_permission(organization_id, 'sermons.manage', expression_id));

create policy sermons_read_published on public.sermons
  for select using (
    status = 'published' and (
      visibility = 'public'
      or (visibility = 'organization' and public.is_organization_member(organization_id))
      or (visibility = 'branch' and exists(
        select 1 from public.memberships m
        where m.organization_id = sermons.organization_id
          and m.profile_id = auth.uid()
          and m.status = 'active'
          and m.branch_id = sermons.expression_id
      ))
    )
  );

create policy sermons_manage_authorized on public.sermons
  for all to authenticated
  using (
    public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  )
  with check (
    public.has_permission(organization_id, 'sermons.manage', expression_id)
    or public.has_permission(organization_id, 'sermons.publish', expression_id)
  );

create policy devotionals_read_published on public.devotionals
  for select using (status = 'published');

create policy devotionals_manage_authorized on public.devotionals
  for all to authenticated
  using (public.has_permission(organization_id, 'devotionals.manage', expression_id))
  with check (public.has_permission(organization_id, 'devotionals.manage', expression_id));

create function public.convert_recording_to_sermon(
  target_recording_id uuid,
  sermon_title text,
  preacher_name text,
  sermon_description text default '',
  target_series_id uuid default null
) returns public.sermons
language plpgsql security definer set search_path = '' as $$
declare
  rec public.live_recordings;
  str public.live_streams;
  created_sermon public.sermons;
  computed_slug text;
begin
  select * into rec from public.live_recordings where id = target_recording_id;
  if not found then raise exception using errcode = '404', message = 'Recording not found'; end if;

  select * into str from public.live_streams where id = rec.stream_id;
  if not found then raise exception using errcode = '404', message = 'Source live stream not found'; end if;

  if not (
    public.has_permission(rec.organization_id, 'livestream.publish_recording', str.branch_id)
    or public.has_permission(rec.organization_id, 'sermons.create', str.branch_id)
  ) then
    raise exception using errcode = '42501', message = 'Permission denied to convert recording to sermon';
  end if;

  computed_slug := lower(regexp_replace(trim(sermon_title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.sermons (
    organization_id, expression_id, series_id, recording_id,
    title, slug, preacher, sermon_date, description,
    video_url, thumbnail_url, duration_seconds,
    status, visibility, created_by
  ) values (
    rec.organization_id, str.branch_id, target_series_id, rec.id,
    trim(sermon_title), computed_slug, trim(preacher_name), current_date, coalesce(sermon_description, str.description),
    rec.playback_id, str.thumbnail_url, rec.duration_seconds::integer,
    'draft', 'public', auth.uid()
  ) returning * into created_sermon;

  return created_sermon;
end;
$$;

revoke all on function public.convert_recording_to_sermon(uuid, text, text, text, uuid) from public;
grant execute on function public.convert_recording_to_sermon(uuid, text, text, text, uuid) to authenticated;

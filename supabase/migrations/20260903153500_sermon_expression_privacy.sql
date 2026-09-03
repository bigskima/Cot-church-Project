-- Align sermon series and livestream-to-sermon conversion with Expression privacy.

alter table public.sermon_series
  add column if not exists visibility public.content_visibility not null default 'public';

alter table public.sermon_series
  drop constraint if exists sermon_series_visibility_supported;
alter table public.sermon_series
  add constraint sermon_series_visibility_supported
  check (visibility in ('public','organization','branch','private'));

drop policy if exists sermon_series_public_read on public.sermon_series;
create policy sermon_series_scoped_read on public.sermon_series
for select
using (
  visibility = 'public'
  or (visibility = 'organization' and public.is_organization_member(organization_id))
  or (
    visibility = 'branch'
    and expression_id is not null
    and public.is_expression_member(organization_id, expression_id)
  )
  or public.has_permission(organization_id, 'sermons.manage', expression_id)
  or public.has_permission(organization_id, 'sermons.publish', expression_id)
);

create or replace function public.convert_recording_to_sermon(
  target_recording_id uuid,
  sermon_title text,
  preacher_name text,
  sermon_description text default '',
  target_series_id uuid default null
) returns public.sermons
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.live_recordings;
  str public.live_streams;
  selected_series public.sermon_series;
  created_sermon public.sermons;
  computed_slug text;
  sermon_visibility public.content_visibility;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into rec from public.live_recordings where id = target_recording_id;
  if not found then raise exception using errcode = 'P0002', message = 'Recording not found'; end if;

  select * into str from public.live_streams where id = rec.stream_id and organization_id = rec.organization_id;
  if not found then raise exception using errcode = 'P0002', message = 'Source live stream not found'; end if;

  if not (
    public.has_permission(rec.organization_id, 'livestream.publish_recording', str.branch_id)
    or public.has_permission(rec.organization_id, 'sermons.create', str.branch_id)
  ) then
    raise exception using errcode = '42501', message = 'Permission denied to convert recording to sermon';
  end if;

  if rec.status <> 'ready' then
    raise exception using errcode = '22023', message = 'Recording is not ready for sermon conversion';
  end if;

  if target_series_id is not null then
    select * into selected_series
    from public.sermon_series
    where id = target_series_id and organization_id = rec.organization_id;
    if not found then raise exception using errcode = 'P0002', message = 'Sermon series not found'; end if;
    if selected_series.expression_id is not null and selected_series.expression_id is distinct from str.branch_id then
      raise exception using errcode = '42501', message = 'Sermon series belongs to another Expression';
    end if;
  end if;

  sermon_visibility := case
    when str.visibility in ('public','organization','branch') then str.visibility
    else 'private'::public.content_visibility
  end;

  computed_slug := lower(regexp_replace(trim(sermon_title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.sermons (
    organization_id,
    expression_id,
    series_id,
    recording_id,
    title,
    slug,
    preacher,
    sermon_date,
    description,
    video_url,
    thumbnail_url,
    duration_seconds,
    status,
    visibility,
    created_by
  ) values (
    rec.organization_id,
    str.branch_id,
    target_series_id,
    rec.id,
    trim(sermon_title),
    computed_slug,
    trim(preacher_name),
    coalesce(str.started_at::date, current_date),
    coalesce(nullif(trim(sermon_description), ''), str.description, ''),
    null,
    str.thumbnail_url,
    rec.duration_seconds::integer,
    'draft',
    sermon_visibility,
    auth.uid()
  ) returning * into created_sermon;

  return created_sermon;
end;
$$;

revoke all on function public.convert_recording_to_sermon(uuid,text,text,text,uuid) from public;
grant execute on function public.convert_recording_to_sermon(uuid,text,text,text,uuid) to authenticated;

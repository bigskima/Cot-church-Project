-- Separate church-wide sermon authority from Expression sermon authority.
-- General sermon permissions are valid only for the organization-wide scope.
-- Expression sermon permissions are valid only for the exact Expression branch.

insert into public.permissions(code,name,description,category,is_active)
values
  ('expression.sermons.read','View Expression sermons','View sermon teaching published inside an authorized Expression.','media',true),
  ('expression.sermons.create','Create Expression sermon drafts','Create pastoral sermon drafts inside an authorized Expression.','media',true),
  ('expression.sermons.manage','Manage Expression sermons','Edit and manage pastoral sermons inside an authorized Expression.','media',true),
  ('expression.sermons.publish','Publish Expression sermons','Publish pastoral sermons inside an authorized Expression.','media',true)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  is_active=true;

insert into public.role_permissions(role_id,permission_code)
select r.id, p.code
from public.roles r
cross join public.permissions p
where r.code='expression_admin'
  and p.code in ('expression.sermons.read','expression.sermons.create','expression.sermons.manage','expression.sermons.publish')
on conflict do nothing;

create or replace function public.has_exact_scope_permission(
  target_organization_id uuid,
  requested_permission text,
  target_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select requested_permission not like 'platform.%'
    and (
      target_branch_id is null
      or public.is_expression_member(target_organization_id, target_branch_id)
    )
    and exists (
      select 1
      from public.memberships m
      join public.organizations o
        on o.id = m.organization_id
      join public.role_assignments ra
        on ra.membership_id = m.id
       and ra.organization_id = m.organization_id
      join public.role_permissions rp
        on rp.role_id = ra.role_id
      join public.permissions p
        on p.code = rp.permission_code
      where m.profile_id = auth.uid()
        and m.organization_id = target_organization_id
        and m.status = 'active'
        and o.status = 'active'
        and p.code = requested_permission
        and p.is_active
        and (ra.expires_at is null or ra.expires_at > now())
        and (
          (target_branch_id is null and ra.branch_id is null)
          or
          (target_branch_id is not null and ra.branch_id = target_branch_id)
        )
        and (
          target_branch_id is null
          or exists (
            select 1 from public.branches b
            where b.id = target_branch_id
              and b.organization_id = target_organization_id
              and b.is_active
          )
        )
    );
$function$;

revoke all on function public.has_exact_scope_permission(uuid,text,uuid) from public;
grant execute on function public.has_exact_scope_permission(uuid,text,uuid) to authenticated, service_role;

drop policy if exists sermons_manage_delete on public.sermons;
drop policy if exists sermons_manage_insert on public.sermons;
drop policy if exists sermons_manage_update on public.sermons;
drop policy if exists sermons_read_published on public.sermons;

create policy sermons_manage_delete
on public.sermons
for delete to authenticated
using (
  case
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
);

create policy sermons_manage_insert
on public.sermons
for insert to authenticated
with check (
  case
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
);

create policy sermons_manage_update
on public.sermons
for update to authenticated
using (
  case
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
)
with check (
  case
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
);

create policy sermons_read_published
on public.sermons
for select to authenticated
using (
  (
    status='published'
    and (
      visibility='public'
      or (visibility='organization' and public.is_organization_member(organization_id))
      or (visibility='branch' and public.is_expression_member(organization_id,expression_id))
    )
  )
  or case
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
      or public.has_exact_scope_permission(organization_id,'sermons.read',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.read',expression_id)
  end
);

create or replace function public.convert_recording_to_sermon(
  target_recording_id uuid,
  sermon_title text,
  preacher_name text,
  sermon_description text default '',
  target_series_id uuid default null
)
returns public.sermons
language plpgsql
security definer
set search_path=''
as $function$
declare
  rec public.live_recordings;
  str public.live_streams;
  selected_series public.sermon_series;
  created_sermon public.sermons;
  computed_slug text;
  sermon_visibility public.content_visibility;
  can_convert boolean;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into rec from public.live_recordings where id=target_recording_id;
  if not found then raise exception using errcode='P0002', message='Recording not found'; end if;

  select * into str from public.live_streams where id=rec.stream_id and organization_id=rec.organization_id;
  if not found then raise exception using errcode='P0002', message='Source live stream not found'; end if;

  can_convert :=
    case
      when str.branch_id is null then
        public.has_exact_scope_permission(rec.organization_id,'livestream.publish_recording',null)
        or public.has_exact_scope_permission(rec.organization_id,'sermons.create',null)
      else
        public.has_exact_scope_permission(rec.organization_id,'livestream.publish_recording',str.branch_id)
        or public.has_exact_scope_permission(rec.organization_id,'expression.sermons.create',str.branch_id)
    end;

  if not can_convert then
    raise exception using errcode='42501', message='Permission denied to convert recording to sermon';
  end if;

  if rec.status <> 'ready' then
    raise exception using errcode='22023', message='Recording is not ready for sermon conversion';
  end if;

  if target_series_id is not null then
    select * into selected_series
    from public.sermon_series
    where id=target_series_id and organization_id=rec.organization_id;
    if not found then raise exception using errcode='P0002', message='Sermon series not found'; end if;
    if selected_series.expression_id is not distinct from null and str.branch_id is not null then
      null;
    elsif selected_series.expression_id is distinct from str.branch_id then
      raise exception using errcode='42501', message='Sermon series belongs to another scope';
    end if;
  end if;

  sermon_visibility := case
    when str.visibility in ('public','organization','branch') then str.visibility
    else 'private'::public.content_visibility
  end;

  computed_slug := lower(regexp_replace(trim(sermon_title),'[^a-zA-Z0-9]+','-','g')) || '-' || substr(md5(random()::text),1,6);

  insert into public.sermons(
    organization_id,expression_id,series_id,recording_id,title,slug,preacher,sermon_date,
    description,video_url,thumbnail_url,duration_seconds,status,visibility,created_by
  ) values (
    rec.organization_id,str.branch_id,target_series_id,rec.id,trim(sermon_title),computed_slug,
    trim(preacher_name),coalesce(str.started_at::date,current_date),
    coalesce(nullif(trim(sermon_description),''),str.description,''),
    null,str.thumbnail_url,rec.duration_seconds::integer,'draft',sermon_visibility,auth.uid()
  ) returning * into created_sermon;

  return created_sermon;
end;
$function$;

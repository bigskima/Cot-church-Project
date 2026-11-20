-- Exact-scope prayer routing, recipient roles, private pastoral separation, and
-- public-wall approval. Prayer intake belongs to church pastoral operations,
-- never to Platform Administration by default.

insert into public.permissions(code,name,description,category) values
  ('prayer.team.receive','Receive prayer-team petitions','Receive non-pastoral-only prayer petitions in the exact assigned church or Expression scope.','prayer'),
  ('prayer.pastoral.receive','Receive confidential pastoral petitions','Receive confidential pastoral-only petitions in the exact assigned church or Expression scope.','prayer')
on conflict(code) do update
set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

-- Expression administration is operational administration, not pastoral access.
update public.role_blueprints
set permission_codes=array_remove(permission_codes,'prayer.moderate')
where code='expression_admin';

delete from public.role_permissions rp
using public.roles r
where rp.role_id=r.id
  and r.code='expression_admin'
  and rp.permission_code='prayer.moderate';

insert into public.role_blueprints(code,name,description,permission_codes) values
  (
    'prayer_team',
    'Prayer Team',
    'Receives and triages prayer-team and approved-wall petitions only inside the exact assigned scope.',
    array['prayer.team.receive','prayer.moderate']
  ),
  (
    'pastoral_care',
    'Pastoral Care',
    'Receives confidential pastoral petitions and prayer-team petitions only inside the exact assigned scope.',
    array['prayer.pastoral.receive','prayer.team.receive','prayer.moderate']
  )
on conflict(code) do update
set name=excluded.name,description=excluded.description,permission_codes=excluded.permission_codes,is_active=true;

create or replace function public.ensure_default_prayer_roles(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  blueprint public.role_blueprints;
  target_role public.roles;
  permission_code text;
begin
  if not exists(select 1 from public.organizations o where o.id=target_organization_id) then
    return;
  end if;

  for blueprint in
    select * from public.role_blueprints where code in ('prayer_team','pastoral_care') and is_active
  loop
    insert into public.roles(organization_id,code,name,description,is_system)
    values(target_organization_id,blueprint.code,blueprint.name,blueprint.description,true)
    on conflict(organization_id,code) do update
      set name=excluded.name,description=excluded.description,is_system=true
    returning * into target_role;

    foreach permission_code in array blueprint.permission_codes loop
      insert into public.role_permissions(role_id,permission_code)
      values(target_role.id,permission_code)
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;

revoke all on function public.ensure_default_prayer_roles(uuid) from public;

do $$
declare org record;
begin
  for org in select id from public.organizations loop
    perform public.ensure_default_prayer_roles(org.id);
  end loop;
end $$;

create or replace function public.ensure_default_prayer_roles_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.ensure_default_prayer_roles(new.id);
  return new;
end;
$$;

revoke all on function public.ensure_default_prayer_roles_on_org_insert() from public;

drop trigger if exists organizations_default_prayer_roles on public.organizations;
create trigger organizations_default_prayer_roles
after insert on public.organizations
for each row execute function public.ensure_default_prayer_roles_on_org_insert();

-- Unlike the generic has_permission helper, prayer privacy requires exact scope:
-- an organization-scoped role does not automatically inherit access to an
-- Expression-scoped pastoral queue, and an Expression role cannot read general intake.
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
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.memberships m
    join public.role_assignments ra
      on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id
    join public.permissions p on p.code=rp.permission_code
    where m.profile_id=auth.uid()
      and m.organization_id=target_organization_id
      and m.status='active'
      and p.code=requested_permission
      and p.is_active
      and (ra.expires_at is null or ra.expires_at>now())
      and ra.branch_id is not distinct from target_branch_id
  );
$$;

revoke all on function public.has_exact_scope_permission(uuid,text,uuid) from public;
grant execute on function public.has_exact_scope_permission(uuid,text,uuid) to authenticated;

create or replace function public.can_receive_prayer_scope(
  target_organization_id uuid,
  target_branch_id uuid,
  target_visibility public.prayer_visibility
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case
    when target_visibility='private' then
      public.has_exact_scope_permission(target_organization_id,'prayer.pastoral.receive',target_branch_id)
    else
      public.has_exact_scope_permission(target_organization_id,'prayer.pastoral.receive',target_branch_id)
      or public.has_exact_scope_permission(target_organization_id,'prayer.team.receive',target_branch_id)
  end;
$$;

revoke all on function public.can_receive_prayer_scope(uuid,uuid,public.prayer_visibility) from public;
grant execute on function public.can_receive_prayer_scope(uuid,uuid,public.prayer_visibility) to authenticated;

create or replace function public.can_moderate_prayer_scope(
  target_organization_id uuid,
  target_branch_id uuid,
  target_visibility public.prayer_visibility
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.has_exact_scope_permission(target_organization_id,'prayer.moderate',target_branch_id)
     and public.can_receive_prayer_scope(target_organization_id,target_branch_id,target_visibility);
$$;

revoke all on function public.can_moderate_prayer_scope(uuid,uuid,public.prayer_visibility) from public;
grant execute on function public.can_moderate_prayer_scope(uuid,uuid,public.prayer_visibility) to authenticated;

alter table public.prayer_requests
  add column if not exists public_approved_at timestamptz,
  add column if not exists public_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists routing_status text not null default 'queued'
    check(routing_status in ('queued','routed','unassigned')),
  add column if not exists routed_at timestamptz;

alter table public.prayer_requests
  drop constraint if exists prayer_requests_public_approval_scope_check;
alter table public.prayer_requests
  add constraint prayer_requests_public_approval_scope_check
  check(public_approved_at is null or visibility='organization');

create index if not exists prayer_requests_scope_queue_idx
  on public.prayer_requests(organization_id,branch_id,routing_status,status,created_at desc);
create index if not exists prayer_requests_public_approved_idx
  on public.prayer_requests(organization_id,branch_id,public_approved_at desc)
  where visibility='organization' and public_approved_at is not null;

create table if not exists public.prayer_request_recipients(
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  recipient_membership_id uuid not null,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_kind text not null check(recipient_kind in ('prayer_team','pastoral')),
  created_at timestamptz not null default now(),
  unique(prayer_request_id,recipient_profile_id),
  foreign key(prayer_request_id,organization_id) references public.prayer_requests(id,organization_id) on delete cascade,
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade,
  foreign key(recipient_membership_id,organization_id) references public.memberships(id,organization_id) on delete cascade
);

create index if not exists prayer_request_recipients_profile_idx
  on public.prayer_request_recipients(recipient_profile_id,created_at desc);
create index if not exists prayer_request_recipients_request_idx
  on public.prayer_request_recipients(prayer_request_id);

alter table public.prayer_request_recipients enable row level security;

drop policy if exists prayer_request_recipients_self_read on public.prayer_request_recipients;
create policy prayer_request_recipients_self_read
on public.prayer_request_recipients for select to authenticated
using(recipient_profile_id=auth.uid());

create or replace function public.protect_prayer_request_identity()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.branch_id is distinct from old.branch_id
     or new.membership_id is distinct from old.membership_id
     or new.submitted_by_profile_id is distinct from old.submitted_by_profile_id then
    raise exception using errcode='23514',message='Prayer request ownership and intake scope cannot be changed';
  end if;
  return new;
end;
$$;

-- Prayer recipient visibility is exact-scope and privacy-aware. Generic church
-- administrators do not inherit pastoral visibility simply because they can manage roles.
drop policy if exists prayer_team_read on public.prayer_requests;
drop policy if exists prayer_moderate_update on public.prayer_requests;

create policy prayer_recipient_read
on public.prayer_requests for select to authenticated
using(public.can_receive_prayer_scope(organization_id,branch_id,visibility));

create policy prayer_moderate_update
on public.prayer_requests for update to authenticated
using(public.can_moderate_prayer_scope(organization_id,branch_id,visibility))
with check(public.can_moderate_prayer_scope(organization_id,branch_id,visibility));

create or replace function public.route_prayer_request(target_prayer_request_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row public.prayer_requests;
  recipient_count integer := 0;
begin
  select * into request_row
  from public.prayer_requests
  where id=target_prayer_request_id
  for update;

  if not found then
    return 0;
  end if;

  delete from public.prayer_request_recipients
  where prayer_request_id=request_row.id;

  with candidates as (
    select
      m.id as membership_id,
      m.profile_id,
      bool_or(rp.permission_code='prayer.pastoral.receive') as pastoral
    from public.memberships m
    join public.role_assignments ra
      on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id
    join public.permissions p on p.code=rp.permission_code and p.is_active
    where m.organization_id=request_row.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and ra.branch_id is not distinct from request_row.branch_id
      and rp.permission_code in ('prayer.team.receive','prayer.pastoral.receive')
      and (
        request_row.visibility<>'private'
        or rp.permission_code='prayer.pastoral.receive'
      )
    group by m.id,m.profile_id
  )
  insert into public.prayer_request_recipients(
    prayer_request_id,organization_id,branch_id,recipient_membership_id,recipient_profile_id,recipient_kind
  )
  select
    request_row.id,request_row.organization_id,request_row.branch_id,
    candidates.membership_id,candidates.profile_id,
    case when candidates.pastoral then 'pastoral' else 'prayer_team' end
  from candidates
  on conflict(prayer_request_id,recipient_profile_id) do nothing;

  get diagnostics recipient_count = row_count;

  if recipient_count>0 then
    update public.prayer_requests
    set routing_status='routed',routed_at=now()
    where id=request_row.id;

    insert into public.notifications(
      organization_id,recipient_profile_id,type,title,body,data
    )
    select
      r.organization_id,
      r.recipient_profile_id,
      'prayer_request:'||request_row.id::text,
      case when request_row.visibility='private'
        then 'New confidential prayer request'
        else 'New prayer request'
      end,
      case when request_row.branch_id is null
        then 'A new prayer request is waiting in the General Prayer Ministry queue.'
        else 'A new prayer request is waiting in your Expression prayer queue.'
      end,
      jsonb_build_object(
        'prayerRequestId',request_row.id,
        'scope',case when request_row.branch_id is null then 'general' else 'expression' end,
        'branchId',request_row.branch_id,
        'recipientKind',r.recipient_kind
      )
    from public.prayer_request_recipients r
    where r.prayer_request_id=request_row.id
    on conflict do nothing;
  else
    update public.prayer_requests
    set routing_status='unassigned',routed_at=null
    where id=request_row.id;

    -- The configuration alert intentionally contains no prayer title, body, identity,
    -- or confidential details. It only tells an exact-scope role manager to assign
    -- a Prayer Team or Pastoral Care recipient so the petition cannot be lost.
    insert into public.notifications(
      organization_id,recipient_profile_id,type,title,body,data
    )
    select distinct
      request_row.organization_id,
      m.profile_id,
      'prayer_routing_unassigned:'||request_row.id::text,
      'Prayer routing needs assignment',
      case when request_row.branch_id is null
        then 'A General Prayer Ministry request is waiting, but no prayer recipient is assigned to that scope.'
        else 'An Expression prayer request is waiting, but no prayer recipient is assigned to that Expression.'
      end,
      jsonb_build_object(
        'routingOnly',true,
        'scope',case when request_row.branch_id is null then 'general' else 'expression' end,
        'branchId',request_row.branch_id
      )
    from public.memberships m
    join public.role_assignments ra
      on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id
    where m.organization_id=request_row.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and ra.branch_id is not distinct from request_row.branch_id
      and rp.permission_code='roles.assign'
    on conflict do nothing;
  end if;

  return recipient_count;
end;
$$;

revoke all on function public.route_prayer_request(uuid) from public;
grant execute on function public.route_prayer_request(uuid) to service_role;

create or replace function public.reroute_prayers_for_scope(target_organization_id uuid,target_branch_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare prayer_row record;
begin
  for prayer_row in
    select id from public.prayer_requests
    where organization_id=target_organization_id
      and branch_id is not distinct from target_branch_id
      and status<>'closed'
  loop
    perform public.route_prayer_request(prayer_row.id);
  end loop;
end;
$$;

revoke all on function public.reroute_prayers_for_scope(uuid,uuid) from public;

create or replace function public.reroute_prayers_after_role_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    perform public.reroute_prayers_for_scope(old.organization_id,old.branch_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.reroute_prayers_for_scope(new.organization_id,new.branch_id);
  end if;
  return coalesce(new,old);
end;
$$;

revoke all on function public.reroute_prayers_after_role_assignment() from public;

drop trigger if exists role_assignments_reroute_prayers on public.role_assignments;
create trigger role_assignments_reroute_prayers
after insert or update or delete on public.role_assignments
for each row execute function public.reroute_prayers_after_role_assignment();

create or replace function public.reroute_prayers_after_role_permission()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare assignment_row record;
declare affected_role uuid;
declare affected_permission text;
begin
  affected_role:=coalesce(new.role_id,old.role_id);
  affected_permission:=coalesce(new.permission_code,old.permission_code);
  if affected_permission not in ('prayer.team.receive','prayer.pastoral.receive','prayer.moderate','roles.assign') then
    return coalesce(new,old);
  end if;

  for assignment_row in
    select distinct organization_id,branch_id
    from public.role_assignments
    where role_id=affected_role
  loop
    perform public.reroute_prayers_for_scope(assignment_row.organization_id,assignment_row.branch_id);
  end loop;
  return coalesce(new,old);
end;
$$;

revoke all on function public.reroute_prayers_after_role_permission() from public;

drop trigger if exists role_permissions_reroute_prayers on public.role_permissions;
create trigger role_permissions_reroute_prayers
after insert or delete on public.role_permissions
for each row execute function public.reroute_prayers_after_role_permission();

-- Route any existing open petitions under the new exact-scope recipient model.
do $$
declare prayer_row record;
begin
  for prayer_row in select id from public.prayer_requests where status<>'closed' loop
    perform public.route_prayer_request(prayer_row.id);
  end loop;
end $$;

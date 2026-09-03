-- Prayer intake is pastoral operational data, not general administration data.
-- General petitions route to organisation-level prayer/pastoral assignees.
-- Expression petitions route only to prayer/pastoral assignees of that exact Expression.

insert into public.permissions(code,name,description,category) values
  ('prayer.intake.receive','Receive prayer intake','Receive and read confidential prayer petitions routed to the assigned pastoral scope.','prayer')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

-- Expression Admins administer the Expression but must not automatically inherit
-- confidential pastoral prayer access.
update public.role_blueprints
set permission_codes=array_remove(permission_codes,'prayer.moderate')
where code='expression_admin';

delete from public.role_permissions rp
using public.roles r
where rp.role_id=r.id
  and r.code='expression_admin'
  and rp.permission_code='prayer.moderate';

insert into public.role_blueprints(code,name,description,permission_codes) values
  ('prayer_leader','Prayer Leader','Receives and manages prayer petitions only within the exact assigned church or Expression scope.',array['prayer.intake.receive','prayer.moderate']),
  ('pastoral_care','Pastoral Care','Receives and manages confidential pastoral prayer and care intake only within the exact assigned scope.',array['prayer.intake.receive','prayer.moderate'])
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  permission_codes=excluded.permission_codes,
  is_active=true;

-- Materialize the system prayer roles for organisations that already exist.
do $$
declare organization_record record;
begin
  for organization_record in select id from public.organizations loop
    perform public.ensure_role_from_blueprint(organization_record.id,'prayer_leader');
    perform public.ensure_role_from_blueprint(organization_record.id,'pastoral_care');
  end loop;
end;
$$;

-- Future organisations receive the same role definitions automatically.
create or replace function public.provision_default_prayer_roles()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.ensure_role_from_blueprint(new.id,'prayer_leader');
  perform public.ensure_role_from_blueprint(new.id,'pastoral_care');
  return new;
end;
$$;

drop trigger if exists organizations_provision_prayer_roles on public.organizations;
create trigger organizations_provision_prayer_roles
after insert on public.organizations
for each row execute function public.provision_default_prayer_roles();

-- Exact-scope checks intentionally do not use has_permission's organisation-wide
-- inheritance rule. An organisation-level prayer role cannot read an Expression
-- petition unless separately assigned to that Expression.
create or replace function public.can_receive_prayer_intake(target_organization_id uuid,target_branch_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id and rp.permission_code='prayer.intake.receive'
    join public.permissions p on p.code=rp.permission_code and p.is_active
    where m.profile_id=auth.uid()
      and m.organization_id=target_organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and (
        (target_branch_id is null and ra.branch_id is null)
        or (target_branch_id is not null and ra.branch_id=target_branch_id)
      )
  );
$$;

create or replace function public.can_moderate_prayer_intake(target_organization_id uuid,target_branch_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    where m.profile_id=auth.uid()
      and m.organization_id=target_organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and (
        (target_branch_id is null and ra.branch_id is null)
        or (target_branch_id is not null and ra.branch_id=target_branch_id)
      )
      and exists(select 1 from public.role_permissions receive_perm where receive_perm.role_id=ra.role_id and receive_perm.permission_code='prayer.intake.receive')
      and exists(select 1 from public.role_permissions moderate_perm where moderate_perm.role_id=ra.role_id and moderate_perm.permission_code='prayer.moderate')
  );
$$;

revoke all on function public.can_receive_prayer_intake(uuid,uuid) from public;
revoke all on function public.can_moderate_prayer_intake(uuid,uuid) from public;
grant execute on function public.can_receive_prayer_intake(uuid,uuid) to authenticated;
grant execute on function public.can_moderate_prayer_intake(uuid,uuid) to authenticated;

-- Generic notifications need per-event deduplication. The old NULLS NOT DISTINCT
-- constraint accidentally allowed only one non-announcement notification of a
-- given type per user for all time.
alter table public.notifications
drop constraint if exists notifications_announcement_id_recipient_profile_id_type_key;

create unique index if not exists notifications_announcement_dedup_idx
on public.notifications(announcement_id,recipient_profile_id,type)
where announcement_id is not null;

create unique index if not exists notifications_generic_dedup_idx
on public.notifications(recipient_profile_id,type,(data->>'deduplicationKey'))
where announcement_id is null and data ? 'deduplicationKey';

create table if not exists public.prayer_request_routes(
  prayer_request_id uuid primary key,
  organization_id uuid not null,
  branch_id uuid,
  scope text not null check(scope in ('general','expression')),
  state text not null check(state in ('routed','unassigned')),
  recipient_count integer not null default 0 check(recipient_count>=0),
  first_routed_at timestamptz not null default now(),
  last_routed_at timestamptz not null default now(),
  foreign key(prayer_request_id,organization_id) references public.prayer_requests(id,organization_id) on delete cascade,
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade,
  check((scope='general' and branch_id is null) or (scope='expression' and branch_id is not null))
);
create index if not exists prayer_request_routes_scope_idx on public.prayer_request_routes(organization_id,branch_id,state,last_routed_at desc);
alter table public.prayer_request_routes enable row level security;

create policy prayer_routes_recipient_read on public.prayer_request_routes
for select to authenticated using(public.can_receive_prayer_intake(organization_id,branch_id));
create policy prayer_routes_manager_read on public.prayer_request_routes
for select to authenticated using(
  exists(
    select 1
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id and rp.permission_code='roles.assign'
    where m.profile_id=auth.uid()
      and m.organization_id=prayer_request_routes.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and ((prayer_request_routes.branch_id is null and ra.branch_id is null) or ra.branch_id=prayer_request_routes.branch_id)
  )
);

create or replace function public.route_prayer_request(target_prayer_request_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row public.prayer_requests;
  recipients integer:=0;
begin
  select * into request_row from public.prayer_requests where id=target_prayer_request_id;
  if not found then raise exception using errcode='P0002',message='Prayer petition not found'; end if;

  with recipient_profiles as (
    select distinct m.profile_id
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id and rp.permission_code='prayer.intake.receive'
    join public.permissions p on p.code=rp.permission_code and p.is_active
    where m.organization_id=request_row.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and (
        (request_row.branch_id is null and ra.branch_id is null)
        or (request_row.branch_id is not null and ra.branch_id=request_row.branch_id)
      )
  ), inserted as (
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      request_row.organization_id,
      rp.profile_id,
      'prayer_intake',
      case when request_row.branch_id is null then 'New general prayer petition' else 'New Expression prayer petition' end,
      case when request_row.branch_id is null then 'A new prayer petition is waiting in the General Prayer Inbox.' else 'A new prayer petition is waiting in your Expression Prayer Inbox.' end,
      jsonb_build_object(
        'prayerRequestId',request_row.id,
        'branchId',request_row.branch_id,
        'scope',case when request_row.branch_id is null then 'general' else 'expression' end,
        'deduplicationKey','prayer:'||request_row.id||':recipient'
      )
    from recipient_profiles rp
    on conflict do nothing
    returning 1
  )
  select count(*) into recipients from recipient_profiles;

  insert into public.prayer_request_routes(prayer_request_id,organization_id,branch_id,scope,state,recipient_count,first_routed_at,last_routed_at)
  values(
    request_row.id,
    request_row.organization_id,
    request_row.branch_id,
    case when request_row.branch_id is null then 'general' else 'expression' end,
    case when recipients>0 then 'routed' else 'unassigned' end,
    recipients,
    now(),now()
  )
  on conflict(prayer_request_id) do update set
    branch_id=excluded.branch_id,
    scope=excluded.scope,
    state=excluded.state,
    recipient_count=excluded.recipient_count,
    last_routed_at=now();

  if recipients=0 then
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select distinct
      request_row.organization_id,
      m.profile_id,
      'prayer_routing_configuration',
      'Prayer inbox needs a recipient',
      case when request_row.branch_id is null
        then 'A general prayer petition is waiting, but no General Prayer or Pastoral Care recipient is assigned. Assign a prayer care role.'
        else 'An Expression prayer petition is waiting, but this Expression has no Prayer or Pastoral Care recipient assigned. Assign a prayer care role.'
      end,
      jsonb_build_object(
        'prayerRequestId',request_row.id,
        'branchId',request_row.branch_id,
        'scope',case when request_row.branch_id is null then 'general' else 'expression' end,
        'requiresRoleAssignment',true,
        'deduplicationKey','prayer:'||request_row.id||':configuration'
      )
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id and rp.permission_code='roles.assign'
    where m.organization_id=request_row.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and (
        (request_row.branch_id is null and ra.branch_id is null)
        or (request_row.branch_id is not null and ra.branch_id=request_row.branch_id)
      )
    on conflict do nothing;
  end if;

  return recipients;
end;
$$;

revoke all on function public.route_prayer_request(uuid) from public;
grant execute on function public.route_prayer_request(uuid) to service_role;

create or replace function public.route_new_prayer_request()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.route_prayer_request(new.id);
  return new;
end;
$$;

drop trigger if exists prayer_requests_route_after_insert on public.prayer_requests;
create trigger prayer_requests_route_after_insert
after insert on public.prayer_requests
for each row execute function public.route_new_prayer_request();

-- Recompute open queues when a role assignment changes. This makes previously
-- unassigned petitions become routable as soon as a Prayer/Pastoral role is assigned.
create or replace function public.refresh_prayer_routes_for_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  assignment_row public.role_assignments;
  request_record record;
  is_prayer_role boolean;
begin
  assignment_row:=case when tg_op='DELETE' then old else new end;
  select exists(
    select 1 from public.role_permissions rp
    where rp.role_id=assignment_row.role_id and rp.permission_code='prayer.intake.receive'
  ) into is_prayer_role;
  if not is_prayer_role then return coalesce(new,old); end if;

  for request_record in
    select pr.id
    from public.prayer_requests pr
    where pr.organization_id=assignment_row.organization_id
      and pr.status<>'closed'
      and (
        (assignment_row.branch_id is null and pr.branch_id is null)
        or pr.branch_id=assignment_row.branch_id
      )
  loop
    perform public.route_prayer_request(request_record.id);
  end loop;
  return coalesce(new,old);
end;
$$;

drop trigger if exists role_assignments_refresh_prayer_routes on public.role_assignments;
create trigger role_assignments_refresh_prayer_routes
after insert or update or delete on public.role_assignments
for each row execute function public.refresh_prayer_routes_for_assignment();

-- Replace inherited prayer visibility with exact-scope pastoral access.
drop policy if exists prayer_team_read on public.prayer_requests;
create policy prayer_team_read on public.prayer_requests
for select to authenticated using(public.can_receive_prayer_intake(organization_id,branch_id));

drop policy if exists prayer_moderate_update on public.prayer_requests;
create policy prayer_moderate_update on public.prayer_requests
for update to authenticated
using(public.can_moderate_prayer_intake(organization_id,branch_id))
with check(public.can_moderate_prayer_intake(organization_id,branch_id));

-- Route existing open petitions through the new exact-scope router.
do $$
declare request_record record;
begin
  for request_record in select id from public.prayer_requests where status<>'closed' loop
    perform public.route_prayer_request(request_record.id);
  end loop;
end;
$$;

-- Group creation and membership are one transaction. Existing owners are repaired
-- without changing Expression membership or admitting outsiders to private groups.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.groups add column if not exists join_policy text;
update public.groups set join_policy = case when visibility = 'private' then 'invite' else 'open' end
where join_policy is null;
alter table public.groups alter column join_policy set default 'open';
alter table public.groups alter column join_policy set not null;
alter table public.groups add constraint groups_join_policy_check check (join_policy in ('open','approval','invite'));

create or replace function private.enroll_group_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
declare creator_membership uuid;
begin
  if new.created_by is null then return new; end if;
  if auth.uid() is not null and auth.uid() <> new.created_by then
    raise exception using errcode = '42501', message = 'Group creator must be the current user';
  end if;
  select m.id into creator_membership from public.memberships m
  where m.organization_id = new.organization_id and m.profile_id = new.created_by and m.status = 'active'
    and (new.branch_id is null or exists (
      select 1 from public.expression_memberships em where em.organization_id = new.organization_id
        and em.branch_id = new.branch_id and em.profile_id = new.created_by and em.status = 'active'
    )) order by m.created_at limit 1;
  if creator_membership is null then
    raise exception using errcode = '42501', message = 'Active membership is required to create this group';
  end if;
  insert into public.group_memberships (organization_id,group_id,membership_id,status,is_leader,responded_at)
  values (new.organization_id,new.id,creator_membership,'active',true,now())
  on conflict (group_id,membership_id) do update set status='active',is_leader=true,responded_at=now();
  return new;
end;
$$;
revoke all on function private.enroll_group_creator() from public,anon,authenticated;
create trigger groups_enroll_creator after insert on public.groups
for each row execute function private.enroll_group_creator();

insert into public.group_memberships (organization_id,group_id,membership_id,status,is_leader,responded_at)
select g.organization_id,g.id,m.id,'active',true,now()
from public.groups g join public.memberships m
  on m.organization_id=g.organization_id and m.profile_id=g.created_by and m.status='active'
where g.is_active and (g.branch_id is null or exists (
  select 1 from public.expression_memberships em where em.organization_id=g.organization_id
    and em.branch_id=g.branch_id and em.profile_id=g.created_by and em.status='active'
))
on conflict (group_id,membership_id) do update set status='active',is_leader=true,responded_at=now();

create or replace function private.can_manage_group_requests(target_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.groups g
    join public.organizations o on o.id=g.organization_id and o.status='active'
    where g.id=target_group_id and g.is_active
      and public.is_organization_member(g.organization_id)
      and (g.branch_id is null or public.is_expression_member(g.organization_id,g.branch_id))
      and (g.created_by=auth.uid()
        or public.has_permission(g.organization_id,'groups.members.manage',g.branch_id)
        or exists (select 1 from public.group_memberships gm join public.memberships m on m.id=gm.membership_id
          where gm.group_id=g.id and gm.status='active' and gm.is_leader
            and m.profile_id=auth.uid() and m.status='active'))
  );
$$;
revoke all on function private.can_manage_group_requests(uuid) from public,anon;
grant execute on function private.can_manage_group_requests(uuid) to authenticated,service_role;

drop policy if exists group_memberships_manage on public.group_memberships;
create policy group_memberships_manage on public.group_memberships for select to authenticated
using (private.can_manage_group_requests(group_id));

create or replace function public.request_group_membership(target_group_id uuid)
returns public.group_memberships language plpgsql security definer set search_path = '' as $$
declare
  selected_group public.groups;
  member public.memberships;
  existing public.group_memberships;
  result public.group_memberships;
  active_count integer;
  next_status public.group_membership_status;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select * into selected_group from public.groups where id=target_group_id and is_active for update;
  if not found then raise exception using errcode='P0002',message='Group not found'; end if;
  select * into member from public.memberships where organization_id=selected_group.organization_id
    and profile_id=auth.uid() and status='active' order by created_at limit 1;
  if not found or not public.is_organization_member(selected_group.organization_id) then
    raise exception using errcode='42501',message='Active membership required';
  end if;
  -- A person's primary branch is not their complete Expression membership list.
  if selected_group.branch_id is not null and not public.is_expression_member(selected_group.organization_id,selected_group.branch_id) then
    raise exception using errcode='42501',message='This group belongs to another Expression';
  end if;
  select * into existing from public.group_memberships
    where group_id=target_group_id and membership_id=member.id for update;
  if existing.status='active' then return existing; end if;
  if selected_group.visibility='private' or selected_group.join_policy='invite' then
    raise exception using errcode='42501',message='This private group requires an invitation';
  end if;
  if existing.status='requested' and selected_group.join_policy='approval' then return existing; end if;
  select count(*) into active_count from public.group_memberships where group_id=target_group_id and status='active';
  if selected_group.capacity is not null and active_count>=selected_group.capacity then
    raise exception using errcode='23514',message='Group is full';
  end if;
  next_status := case when selected_group.join_policy='open' then 'active' else 'requested' end;
  -- Do not use FOUND after count(*): aggregate queries always set FOUND, which
  -- previously made the first request update a nonexistent row and return null.
  insert into public.group_memberships (organization_id,group_id,membership_id,status,is_leader,requested_at,responded_at)
  values (selected_group.organization_id,target_group_id,member.id,next_status,false,now(),case when next_status='active' then now() else null end)
  on conflict (group_id,membership_id) do update set status=excluded.status,requested_at=excluded.requested_at,responded_at=excluded.responded_at
  returning * into result;
  return result;
end;
$$;

create or replace function public.review_group_membership(target_group_membership_id uuid,approved boolean)
returns public.group_memberships language plpgsql security definer set search_path = '' as $$
declare request_row public.group_memberships; selected_group public.groups; result public.group_memberships; active_count integer;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if approved is null then raise exception using errcode='22023',message='Approval decision is required'; end if;
  select * into request_row from public.group_memberships where id=target_group_membership_id;
  if not found then raise exception using errcode='P0002',message='Request not found'; end if;
  -- Lock the group first, matching the join path, to serialize capacity checks.
  select * into selected_group from public.groups where id=request_row.group_id and is_active for update;
  if not found then raise exception using errcode='P0002',message='Group not found'; end if;
  if not private.can_manage_group_requests(selected_group.id) then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  select * into request_row from public.group_memberships where id=target_group_membership_id for update;
  if request_row.status<>'requested' then raise exception using errcode='22023',message='Only pending membership requests can be reviewed'; end if;
  if approved and not exists (select 1 from public.memberships m where m.id=request_row.membership_id and m.status='active'
    and (selected_group.branch_id is null or exists (select 1 from public.expression_memberships em where em.profile_id=m.profile_id
      and em.organization_id=selected_group.organization_id and em.branch_id=selected_group.branch_id and em.status='active'))) then
    raise exception using errcode='42501',message='Requester no longer belongs to this Expression';
  end if;
  if approved and selected_group.capacity is not null then
    select count(*) into active_count from public.group_memberships where group_id=selected_group.id and status='active';
    if active_count>=selected_group.capacity then raise exception using errcode='23514',message='Group is full'; end if;
  end if;
  update public.group_memberships set status=case when approved then 'active'::public.group_membership_status else 'declined'::public.group_membership_status end,
    responded_at=now() where id=request_row.id returning * into result;
  return result;
end;
$$;
revoke all on function public.request_group_membership(uuid),public.review_group_membership(uuid,boolean) from public,anon;
grant execute on function public.request_group_membership(uuid),public.review_group_membership(uuid,boolean) to authenticated,service_role;

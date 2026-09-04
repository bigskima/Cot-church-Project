-- Enforce Expression-local group discovery and membership lifecycle.
-- branch_id IS NULL represents an intentionally church-wide group.

-- Managers may inspect membership rows only when their capability applies to the group's scope.
drop policy if exists group_memberships_manage on public.group_memberships;
create policy group_memberships_manage on public.group_memberships
for select to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_memberships.group_id
      and g.organization_id = group_memberships.organization_id
      and public.has_permission(group_memberships.organization_id, 'groups.members.manage', g.branch_id)
  )
);

create or replace function public.request_group_membership(target_group_id uuid)
returns public.group_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_group public.groups;
  member public.memberships;
  existing public.group_memberships;
  result public.group_memberships;
  active_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into selected_group
  from public.groups
  where id = target_group_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Group not found';
  end if;

  select * into member
  from public.memberships
  where organization_id = selected_group.organization_id
    and profile_id = auth.uid()
    and status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'Active membership required';
  end if;

  if selected_group.branch_id is not null and member.branch_id is distinct from selected_group.branch_id then
    raise exception using errcode = '42501', message = 'This group belongs to another Expression';
  end if;

  -- Private groups require an administrator-managed membership path and cannot be joined by guessing an ID.
  if selected_group.visibility = 'private' then
    raise exception using errcode = '42501', message = 'This private group does not accept membership requests';
  end if;

  select * into existing
  from public.group_memberships
  where group_id = target_group_id and membership_id = member.id
  for update;

  if found and existing.status = 'active' then
    return existing;
  end if;
  if found and existing.status = 'requested' then
    return existing;
  end if;

  select count(*) into active_count
  from public.group_memberships
  where group_id = target_group_id and status = 'active';
  if selected_group.capacity is not null and active_count >= selected_group.capacity then
    raise exception using errcode = '23514', message = 'Group is full';
  end if;

  if found then
    update public.group_memberships
    set status = 'requested', requested_at = now(), responded_at = null, is_leader = false
    where id = existing.id
    returning * into result;
  else
    insert into public.group_memberships (organization_id, group_id, membership_id)
    values (selected_group.organization_id, target_group_id, member.id)
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.review_group_membership(target_group_membership_id uuid, approved boolean)
returns public.group_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.group_memberships;
  selected_group public.groups;
  result public.group_memberships;
  active_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into request_row
  from public.group_memberships
  where id = target_group_membership_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  select * into selected_group
  from public.groups
  where id = request_row.group_id and organization_id = request_row.organization_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Group not found';
  end if;

  if not public.has_permission(request_row.organization_id, 'groups.members.manage', selected_group.branch_id) then
    raise exception using errcode = '42501', message = 'Permission denied';
  end if;

  if request_row.status <> 'requested' then
    raise exception using errcode = '22023', message = 'Only pending membership requests can be reviewed';
  end if;

  if approved and selected_group.capacity is not null then
    select count(*) into active_count
    from public.group_memberships
    where group_id = selected_group.id and status = 'active';
    if active_count >= selected_group.capacity then
      raise exception using errcode = '23514', message = 'Group is full';
    end if;
  end if;

  update public.group_memberships
  set status = case when approved then 'active' else 'declined' end,
      responded_at = now()
  where id = request_row.id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.request_group_membership(uuid) from public;
revoke all on function public.review_group_membership(uuid, boolean) from public;
grant execute on function public.request_group_membership(uuid) to authenticated;
grant execute on function public.review_group_membership(uuid, boolean) to authenticated;

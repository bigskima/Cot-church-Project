-- Secure membership lifecycle and RBAC administration operations.

-- Role writes are only allowed through the guarded functions in this migration.
drop policy if exists roles_manage_authorized on public.roles;

create function public.can_read_member_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships target
    where target.profile_id = target_profile_id
      and public.has_permission(target.organization_id, 'members.read', target.branch_id)
  );
$$;

revoke all on function public.can_read_member_profile(uuid) from public;
grant execute on function public.can_read_member_profile(uuid) to authenticated;

create policy profiles_read_authorized_members on public.profiles for select to authenticated
using (public.can_read_member_profile(id));

create function public.create_custom_role(
  target_organization_id uuid,
  role_code text,
  role_name text,
  role_description text,
  permission_codes text[]
)
returns public.roles
language plpgsql
security definer
set search_path = ''
as $$
declare created_role public.roles;
begin
  if not public.has_permission(target_organization_id, 'roles.manage') then
    raise exception using errcode = '42501', message = 'Permission denied';
  end if;
  if role_code !~ '^[a-z][a-z0-9_-]*$' or char_length(role_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid role';
  end if;
  if exists (select 1 from unnest(permission_codes) requested(code) left join public.permissions p on p.code = requested.code and p.is_active where p.code is null) then
    raise exception using errcode = '22023', message = 'Unknown or inactive permission';
  end if;
  insert into public.roles (organization_id, code, name, description)
  values (target_organization_id, role_code, trim(role_name), coalesce(role_description, ''))
  returning * into created_role;
  insert into public.role_permissions (role_id, permission_code)
  select created_role.id, code from unnest(permission_codes) requested(code)
  on conflict do nothing;
  return created_role;
end;
$$;

create function public.update_custom_role(
  target_organization_id uuid,
  target_role_id uuid,
  role_name text,
  role_description text,
  permission_codes text[]
)
returns public.roles
language plpgsql
security definer
set search_path = ''
as $$
declare updated_role public.roles;
begin
  if not public.has_permission(target_organization_id, 'roles.manage') then
    raise exception using errcode = '42501', message = 'Permission denied';
  end if;
  if exists (select 1 from public.roles where id = target_role_id and organization_id = target_organization_id and is_system) then
    raise exception using errcode = '42501', message = 'System roles cannot be modified';
  end if;
  if char_length(role_name) not between 1 and 120 or exists (
    select 1 from unnest(permission_codes) requested(code)
    left join public.permissions p on p.code = requested.code and p.is_active
    where p.code is null
  ) then raise exception using errcode = '22023', message = 'Invalid role configuration'; end if;
  update public.roles set name = trim(role_name), description = coalesce(role_description, '')
  where id = target_role_id and organization_id = target_organization_id and not is_system
  returning * into updated_role;
  if updated_role.id is null then raise exception using errcode = 'P0002', message = 'Role not found'; end if;
  delete from public.role_permissions where role_id = target_role_id;
  insert into public.role_permissions (role_id, permission_code)
  select target_role_id, code from unnest(permission_codes) requested(code) on conflict do nothing;
  return updated_role;
end;
$$;

create function public.assign_role(
  target_organization_id uuid,
  target_membership_id uuid,
  target_role_id uuid,
  target_branch_id uuid default null,
  assignment_expires_at timestamptz default null
)
returns public.role_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare created_assignment public.role_assignments;
begin
  if not public.has_permission(target_organization_id, 'roles.assign', target_branch_id) then
    raise exception using errcode = '42501', message = 'Permission denied';
  end if;
  if assignment_expires_at is not null and assignment_expires_at <= now() then
    raise exception using errcode = '22023', message = 'Expiration must be in the future';
  end if;
  if target_branch_id is not null and exists (select 1 from public.roles where id = target_role_id and organization_id = target_organization_id and code = 'owner' and is_system) then
    raise exception using errcode = '22023', message = 'Owner access must be organization scoped';
  end if;
  if exists (select 1 from public.roles where id = target_role_id and organization_id = target_organization_id and code = 'owner' and is_system)
    and not exists (
      select 1 from public.memberships m
      join public.role_assignments ra on ra.membership_id = m.id
      join public.roles r on r.id = ra.role_id
      where m.profile_id = auth.uid() and m.organization_id = target_organization_id and m.status = 'active'
        and r.code = 'owner' and r.is_system and (ra.expires_at is null or ra.expires_at > now())
    ) then raise exception using errcode = '42501', message = 'Only an owner can grant owner access';
  end if;
  insert into public.role_assignments (organization_id, membership_id, role_id, branch_id, granted_by, expires_at)
  values (target_organization_id, target_membership_id, target_role_id, target_branch_id, auth.uid(), assignment_expires_at)
  returning * into created_assignment;
  return created_assignment;
end;
$$;

create function public.revoke_role_assignment(target_organization_id uuid, target_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare assignment_branch_id uuid;
begin
  select branch_id into assignment_branch_id from public.role_assignments
  where id = target_assignment_id and organization_id = target_organization_id;
  if not found then raise exception using errcode = 'P0002', message = 'Assignment not found'; end if;
  if not public.has_permission(target_organization_id, 'roles.assign', assignment_branch_id) then
    raise exception using errcode = '42501', message = 'Permission denied';
  end if;
  if exists (
    select 1 from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where ra.id = target_assignment_id and r.code = 'owner' and r.is_system
  ) and (select count(distinct m.id) from public.role_assignments ra join public.roles r on r.id = ra.role_id join public.memberships m on m.id = ra.membership_id where ra.organization_id = target_organization_id and r.code = 'owner' and r.is_system and m.status = 'active' and (ra.expires_at is null or ra.expires_at > now())) <= 1 then
    raise exception using errcode = '23514', message = 'The last active owner cannot be removed';
  end if;
  delete from public.role_assignments where id = target_assignment_id;
end;
$$;

create function public.update_membership_status(
  target_organization_id uuid,
  target_membership_id uuid,
  new_status public.membership_status,
  new_branch_id uuid default null
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare updated_membership public.memberships;
begin
  if not public.has_permission(target_organization_id, 'members.update', new_branch_id) then
    raise exception using errcode = '42501', message = 'Permission denied';
  end if;
  if new_status <> 'active' and exists (
    select 1 from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where ra.membership_id = target_membership_id and r.code = 'owner' and r.is_system
  ) and (select count(distinct m.id) from public.role_assignments ra join public.roles r on r.id = ra.role_id join public.memberships m on m.id = ra.membership_id where ra.organization_id = target_organization_id and r.code = 'owner' and r.is_system and m.status = 'active' and (ra.expires_at is null or ra.expires_at > now())) <= 1 then
    raise exception using errcode = '23514', message = 'The last active owner cannot be deactivated';
  end if;
  update public.memberships set status = new_status, branch_id = new_branch_id,
    joined_at = case when new_status = 'active' then coalesce(joined_at, current_date) else joined_at end
  where id = target_membership_id and organization_id = target_organization_id
  returning * into updated_membership;
  if updated_membership.id is null then raise exception using errcode = 'P0002', message = 'Membership not found'; end if;
  return updated_membership;
end;
$$;

revoke all on function public.create_custom_role(uuid, text, text, text, text[]) from public;
revoke all on function public.update_custom_role(uuid, uuid, text, text, text[]) from public;
revoke all on function public.assign_role(uuid, uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.revoke_role_assignment(uuid, uuid) from public;
revoke all on function public.update_membership_status(uuid, uuid, public.membership_status, uuid) from public;
grant execute on function public.create_custom_role(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.update_custom_role(uuid, uuid, text, text, text[]) to authenticated;
grant execute on function public.assign_role(uuid, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.revoke_role_assignment(uuid, uuid) to authenticated;
grant execute on function public.update_membership_status(uuid, uuid, public.membership_status, uuid) to authenticated;

create policy role_assignments_read_authorized on public.role_assignments for select to authenticated
using (public.has_permission(organization_id, 'roles.read', branch_id));

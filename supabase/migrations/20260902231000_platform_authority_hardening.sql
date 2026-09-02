-- Harden the boundary between Level-1 platform authority and church-scoped RBAC.

-- Organization roles must never carry platform.* capabilities. Platform authority
-- lives exclusively in platform_role_assignments/platform_role_permissions.
delete from public.role_permissions
where permission_code like 'platform.%';

-- Platform branding is platform infrastructure, not an organization capability.
drop policy if exists platform_branding_manage on public.platform_branding;
create policy platform_branding_manage on public.platform_branding
  for all to authenticated
  using (public.has_platform_permission('platform.branding.manage'))
  with check (public.has_platform_permission('platform.branding.manage'));

-- New organizations receive every active CHURCH capability, never Level-1 platform
-- capabilities that happen to live in the shared permission catalogue.
create or replace function public.create_organization(
  organization_name text,
  organization_slug text,
  organization_timezone text default 'UTC',
  initial_branch_name text default 'Main Campus',
  initial_branch_code text default 'MAIN'
)
returns table (organization_id uuid, branch_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_organization_id uuid;
  created_branch_id uuid;
  created_membership_id uuid;
  owner_role_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if char_length(trim(organization_name)) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'Invalid organization name';
  end if;
  if organization_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Invalid organization slug';
  end if;
  if initial_branch_code !~ '^[A-Z0-9][A-Z0-9_-]*$' then
    raise exception using errcode = '22023', message = 'Invalid branch code';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = organization_timezone) then
    raise exception using errcode = '22023', message = 'Invalid timezone';
  end if;

  insert into public.organizations (name, slug, timezone, created_by)
  values (trim(organization_name), organization_slug, organization_timezone, auth.uid())
  returning id into created_organization_id;

  insert into public.branches (organization_id, name, code, timezone)
  values (created_organization_id, trim(initial_branch_name), initial_branch_code, organization_timezone)
  returning id into created_branch_id;

  insert into public.memberships (organization_id, branch_id, profile_id, status, joined_at)
  values (created_organization_id, created_branch_id, auth.uid(), 'active', current_date)
  returning id into created_membership_id;

  insert into public.roles (organization_id, code, name, description, is_system)
  values (created_organization_id, 'owner', 'Organization Owner', 'Full church-organization access.', true)
  returning id into owner_role_id;

  insert into public.role_permissions (role_id, permission_code)
  select owner_role_id, code
  from public.permissions
  where is_active
    and code not like 'platform.%';

  insert into public.role_assignments (organization_id, membership_id, role_id, granted_by)
  values (created_organization_id, created_membership_id, owner_role_id, auth.uid());

  return query select created_organization_id, created_branch_id, created_membership_id;
end;
$$;

-- Custom church roles may only contain non-platform capabilities.
create or replace function public.create_custom_role(
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
  if exists (
    select 1
    from unnest(permission_codes) requested(code)
    left join public.permissions p on p.code = requested.code and p.is_active
    where p.code is null or requested.code like 'platform.%'
  ) then
    raise exception using errcode = '22023', message = 'Unknown, inactive, or platform-only permission';
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

create or replace function public.update_custom_role(
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
  if exists (
    select 1 from public.roles
    where id = target_role_id and organization_id = target_organization_id and is_system
  ) then
    raise exception using errcode = '42501', message = 'System roles cannot be modified';
  end if;
  if char_length(role_name) not between 1 and 120 or exists (
    select 1
    from unnest(permission_codes) requested(code)
    left join public.permissions p on p.code = requested.code and p.is_active
    where p.code is null or requested.code like 'platform.%'
  ) then
    raise exception using errcode = '22023', message = 'Invalid role configuration';
  end if;
  update public.roles
  set name = trim(role_name), description = coalesce(role_description, '')
  where id = target_role_id and organization_id = target_organization_id and not is_system
  returning * into updated_role;
  if updated_role.id is null then
    raise exception using errcode = 'P0002', message = 'Role not found';
  end if;
  delete from public.role_permissions where role_id = target_role_id;
  insert into public.role_permissions (role_id, permission_code)
  select target_role_id, code from unnest(permission_codes) requested(code)
  on conflict do nothing;
  return updated_role;
end;
$$;

comment on policy platform_branding_manage on public.platform_branding is
  'Platform branding is writable only by Level-1 platform authority.';

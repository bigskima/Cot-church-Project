-- Permission catalog and transactional organization/branch operations.

insert into public.permissions (code, name, description, category)
values
  ('organizations.read', 'View organization', 'View organization configuration and context.', 'organizations'),
  ('organizations.update', 'Update organization', 'Update organization configuration.', 'organizations'),
  ('branches.read', 'View branches', 'View organization branches.', 'organizations'),
  ('branches.create', 'Create branches', 'Create branches within the organization.', 'organizations'),
  ('branches.update', 'Update branches', 'Update and reorganize branches.', 'organizations'),
  ('members.read', 'View members', 'View organization membership records.', 'memberships'),
  ('members.invite', 'Invite members', 'Invite people into the organization.', 'memberships'),
  ('members.update', 'Update members', 'Update membership state and branch placement.', 'memberships'),
  ('roles.read', 'View roles', 'View roles and permission assignments.', 'permissions'),
  ('roles.manage', 'Manage roles', 'Create roles and manage role permissions.', 'permissions'),
  ('roles.assign', 'Assign roles', 'Grant and revoke organization or branch roles.', 'permissions'),
  ('audit.read', 'View audit log', 'View organization audit records.', 'audit')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  is_active = true;

create function public.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'Invalid timezone';
  end if;
  return new;
end;
$$;

create trigger organizations_validate_timezone
before insert or update of timezone on public.organizations
for each row execute function public.validate_timezone();

create trigger branches_validate_timezone
before insert or update of timezone on public.branches
for each row execute function public.validate_timezone();

create function public.prevent_branch_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cycle_found boolean;
begin
  if new.parent_branch_id is null then
    return new;
  end if;
  if new.parent_branch_id = new.id then
    raise exception using errcode = '23514', message = 'A branch cannot be its own parent';
  end if;
  with recursive ancestors as (
    select b.id, b.parent_branch_id
    from public.branches b
    where b.id = new.parent_branch_id and b.organization_id = new.organization_id
    union all
    select parent.id, parent.parent_branch_id
    from public.branches parent
    join ancestors child on parent.id = child.parent_branch_id
    where parent.organization_id = new.organization_id
  )
  select exists (select 1 from ancestors where id = new.id) into cycle_found;
  if cycle_found then
    raise exception using errcode = '23514', message = 'Branch hierarchy cannot contain a cycle';
  end if;
  return new;
end;
$$;

create trigger branches_prevent_cycle
before insert or update of parent_branch_id on public.branches
for each row execute function public.prevent_branch_cycle();

create function public.create_organization(
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
  values (created_organization_id, 'owner', 'Organization Owner', 'Full organization access.', true)
  returning id into owner_role_id;

  insert into public.role_permissions (role_id, permission_code)
  select owner_role_id, code from public.permissions where is_active;

  insert into public.role_assignments (organization_id, membership_id, role_id, granted_by)
  values (created_organization_id, created_membership_id, owner_role_id, auth.uid());

  return query select created_organization_id, created_branch_id, created_membership_id;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text, text) to authenticated;

create policy organizations_update_authorized on public.organizations
for update to authenticated
using (public.has_permission(id, 'organizations.update'))
with check (public.has_permission(id, 'organizations.update'));

create policy branches_insert_authorized on public.branches
for insert to authenticated
with check (public.has_permission(organization_id, 'branches.create', id));

create policy branches_update_authorized on public.branches
for update to authenticated
using (public.has_permission(organization_id, 'branches.update', id))
with check (public.has_permission(organization_id, 'branches.update', id));

create policy memberships_read_authorized on public.memberships
for select to authenticated
using (public.has_permission(organization_id, 'members.read', branch_id));

create policy roles_manage_authorized on public.roles
for all to authenticated
using (public.has_permission(organization_id, 'roles.manage'))
with check (public.has_permission(organization_id, 'roles.manage'));

comment on function public.create_organization(text, text, text, text, text) is
  'Atomically provisions an organization, initial branch, owner membership, and database-driven owner role.';

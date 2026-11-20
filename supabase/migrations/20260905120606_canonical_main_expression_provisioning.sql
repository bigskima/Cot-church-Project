-- Keep canonical product terminology consistent for newly provisioned churches.
-- The underlying table remains public.branches for compatibility, while the
-- product-level name presented to users is Expression.

create or replace function public.create_organization(
  organization_name text,
  organization_slug text,
  organization_timezone text default 'UTC',
  initial_branch_name text default 'Main Expression',
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

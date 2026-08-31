-- Bootstrap Super Admin and Default Church Organization for user 252518d9-23f5-4d69-8c37-5b1f090793ae (chivodotai@gmail.com)
do $$
declare
  target_user_id uuid := '252518d9-23f5-4d69-8c37-5b1f090793ae';
  target_org_id uuid;
  target_branch_id uuid;
  target_membership_id uuid;
  owner_role_id uuid;
begin
  -- 1. Ensure Profile exists for Super Admin
  insert into public.profiles (id, display_name)
  values (target_user_id, 'Platform Admin')
  on conflict (id) do update set display_name = coalesce(public.profiles.display_name, 'Platform Admin');

  -- 2. Create or find primary Church Organization
  select id into target_org_id from public.organizations where slug = 'city-of-transformation' or slug = 'church-platform' limit 1;
  if target_org_id is null then
    insert into public.organizations (name, slug, timezone, created_by)
    values ('City of Transformation', 'city-of-transformation', 'UTC', target_user_id)
    returning id into target_org_id;
  end if;

  -- 3. Create or find main Branch / Campus
  select id into target_branch_id from public.branches where organization_id = target_org_id and code = 'MAIN' limit 1;
  if target_branch_id is null then
    insert into public.branches (organization_id, name, code, timezone)
    values (target_org_id, 'Main Campus', 'MAIN', 'UTC')
    returning id into target_branch_id;
  end if;

  -- 4. Create active Membership
  select id into target_membership_id from public.memberships where organization_id = target_org_id and profile_id = target_user_id limit 1;
  if target_membership_id is null then
    insert into public.memberships (organization_id, branch_id, profile_id, status, joined_at)
    values (target_org_id, target_branch_id, target_user_id, 'active', current_date)
    returning id into target_membership_id;
  else
    update public.memberships set status = 'active', branch_id = coalesce(branch_id, target_branch_id) where id = target_membership_id;
  end if;

  -- 5. Ensure Owner Role exists with ALL active permissions (ability to add/manage other admins)
  select id into owner_role_id from public.roles where organization_id = target_org_id and code = 'owner' limit 1;
  if owner_role_id is null then
    insert into public.roles (organization_id, code, name, description, is_system)
    values (target_org_id, 'owner', 'Organization Owner', 'Full super admin and organization access.', true)
    returning id into owner_role_id;
  end if;

  insert into public.role_permissions (role_id, permission_code)
  select owner_role_id, code from public.permissions where is_active
  on conflict do nothing;

  -- 6. Assign Owner Role to Super Admin
  insert into public.role_assignments (organization_id, membership_id, role_id, granted_by)
  values (target_org_id, target_membership_id, owner_role_id, target_user_id)
  on conflict do nothing;

  -- 7. Ensure Church Story & Platform Branding exist
  insert into public.church_story (organization_id, title, subtitle, is_published)
  values (target_org_id, 'Our Story & Heritage', 'City of Transformation', true)
  on conflict do nothing;

  insert into public.platform_branding (platform_name, is_active)
  values ('City of Transformation', true)
  on conflict do nothing;
end;
$$;

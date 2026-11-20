-- Make Platform Authority lifecycle actions effective across existing tenant RLS/RBAC.

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_organization_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function public.has_permission(
  target_organization_id uuid,
  requested_permission text,
  target_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_permission not like 'platform.%'
    and exists (
      select 1
      from public.memberships m
      join public.organizations o on o.id = m.organization_id
      join public.role_assignments ra
        on ra.membership_id = m.id and ra.organization_id = m.organization_id
      join public.role_permissions rp on rp.role_id = ra.role_id
      join public.permissions p on p.code = rp.permission_code
      where m.profile_id = auth.uid()
        and m.organization_id = target_organization_id
        and m.status = 'active'
        and o.status = 'active'
        and p.code = requested_permission
        and p.is_active
        and (ra.expires_at is null or ra.expires_at > now())
        and (ra.branch_id is null or ra.branch_id = target_branch_id)
        and (
          target_branch_id is null
          or exists (
            select 1
            from public.branches b
            where b.id = target_branch_id
              and b.organization_id = target_organization_id
              and b.is_active
          )
        )
    );
$$;

-- Public discovery may see only active tenants. This allows the public-content
-- API to resolve church/expression identity without opening suspended tenants.
drop policy if exists organizations_public_discovery on public.organizations;
create policy organizations_public_discovery on public.organizations
for select to anon, authenticated
using (status = 'active');

drop policy if exists branches_public_discovery on public.branches;
create policy branches_public_discovery on public.branches
for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.status = 'active'
  )
);

comment on function public.is_organization_member(uuid) is
  'Membership access is valid only while both membership and organization are active.';
comment on function public.has_permission(uuid, text, uuid) is
  'Church-scoped capability check. Platform capabilities are explicitly excluded and suspended tenants/expressions are denied.';

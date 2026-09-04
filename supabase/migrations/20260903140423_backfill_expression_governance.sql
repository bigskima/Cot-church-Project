-- Bring Expressions created before the governance invitation runtime into the same model.
-- Resolve current organization owners relationally; do not hardcode generated identifiers.

-- Ensure every organization has the database-defined Expression Admin role and permissions.
select public.ensure_role_from_blueprint(o.id, 'expression_admin')
from public.organizations o;

-- Give each pre-existing Expression an accountable owner based on the active
-- organization owner relationship. This is only a compatibility backfill.
insert into public.expression_ownerships(branch_id, organization_id, owner_profile_id, assigned_by)
select distinct on (b.id)
  b.id,
  b.organization_id,
  m.profile_id,
  m.profile_id
from public.branches b
join public.memberships m
  on m.organization_id = b.organization_id
 and m.status = 'active'
join public.role_assignments ra
  on ra.membership_id = m.id
 and ra.organization_id = m.organization_id
 and ra.branch_id is null
join public.roles r
  on r.id = ra.role_id
 and r.organization_id = ra.organization_id
where r.code = 'owner'
  and r.is_system
  and (ra.expires_at is null or ra.expires_at > now())
  and not exists (
    select 1 from public.expression_ownerships eo where eo.branch_id = b.id
  )
order by b.id, ra.created_at asc
on conflict (branch_id) do nothing;

-- Ensure the accountable owner has the branch-scoped Expression Admin grant.
insert into public.role_assignments(
  organization_id,
  membership_id,
  role_id,
  branch_id,
  granted_by
)
select
  eo.organization_id,
  m.id,
  r.id,
  eo.branch_id,
  eo.assigned_by
from public.expression_ownerships eo
join public.memberships m
  on m.organization_id = eo.organization_id
 and m.profile_id = eo.owner_profile_id
 and m.status = 'active'
join public.roles r
  on r.organization_id = eo.organization_id
 and r.code = 'expression_admin'
where not exists (
  select 1
  from public.role_assignments existing
  where existing.membership_id = m.id
    and existing.role_id = r.id
    and existing.branch_id = eo.branch_id
)
on conflict (membership_id, role_id, branch_id) do nothing;

create function public.transfer_expression_ownership_by_email(
  target_branch_id uuid,
  target_email text,
  retain_previous_admin boolean default false
)
returns public.expression_ownerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  target_profile_id uuid;
begin
  normalized_email := lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Invalid email';
  end if;

  select id into target_profile_id
  from auth.users
  where lower(email) = normalized_email;

  if target_profile_id is null then
    raise exception using errcode = 'P0002', message = 'Registered user not found';
  end if;

  return public.transfer_expression_ownership(
    target_branch_id,
    target_profile_id,
    retain_previous_admin
  );
end;
$$;

revoke all on function public.transfer_expression_ownership_by_email(uuid,text,boolean) from public;
grant execute on function public.transfer_expression_ownership_by_email(uuid,text,boolean) to authenticated;

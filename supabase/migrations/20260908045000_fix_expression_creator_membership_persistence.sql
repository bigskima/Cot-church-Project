-- Ensure an Expression creator remains a member of the Expression they create.
-- The organization membership is account/church scoped; the Expression membership
-- is the canonical branch-scoped membership used by organization-context and APIs.

create or replace function public.create_authorized_expression(
  target_organization_id uuid,
  expression_name text,
  expression_code text,
  expression_timezone text default 'UTC'::text,
  parent_expression_id uuid default null::uuid,
  expression_address jsonb default '{}'::jsonb
)
returns public.branches
language plpgsql
security definer
set search_path to ''
as $function$
declare
  created_branch public.branches;
  membership public.memberships;
  admin_role public.roles;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Authentication required';
  end if;

  if not public.has_expression_creator_authorization(target_organization_id) then
    raise exception using errcode='42501',message='Expression creator authorization required';
  end if;

  if char_length(trim(expression_name)) not between 1 and 160
     or upper(trim(expression_code)) !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' then
    raise exception using errcode='22023',message='Invalid expression';
  end if;

  if jsonb_typeof(expression_address) <> 'object' then
    raise exception using errcode='22023',message='Address must be an object';
  end if;

  if parent_expression_id is not null and not exists (
    select 1
    from public.branches
    where id=parent_expression_id
      and organization_id=target_organization_id
      and is_active
  ) then
    raise exception using errcode='22023',message='Invalid parent expression';
  end if;

  insert into public.branches(
    organization_id,
    parent_branch_id,
    name,
    code,
    timezone,
    address
  )
  values(
    target_organization_id,
    parent_expression_id,
    trim(expression_name),
    upper(trim(expression_code)),
    coalesce(nullif(trim(expression_timezone),''),'UTC'),
    expression_address
  )
  returning * into created_branch;

  -- Keep one stable organization membership. Do not move that membership's
  -- branch_id every time the member creates another Expression.
  insert into public.memberships(
    organization_id,
    branch_id,
    profile_id,
    status,
    joined_at
  )
  values(
    target_organization_id,
    null,
    auth.uid(),
    'active',
    current_date
  )
  on conflict(organization_id,profile_id)
  do update set
    status='active',
    joined_at=coalesce(public.memberships.joined_at,current_date)
  returning * into membership;

  -- This row is what private Expression routing and API authentication use
  -- after a fresh login.
  insert into public.expression_memberships(
    organization_id,
    branch_id,
    membership_id,
    profile_id,
    status,
    joined_at,
    left_at
  )
  values(
    target_organization_id,
    created_branch.id,
    membership.id,
    auth.uid(),
    'active',
    now(),
    null
  )
  on conflict(branch_id,profile_id)
  do update set
    organization_id=excluded.organization_id,
    membership_id=excluded.membership_id,
    status='active',
    joined_at=coalesce(public.expression_memberships.joined_at,excluded.joined_at),
    left_at=null;

  admin_role:=public.ensure_role_from_blueprint(target_organization_id,'expression_admin');

  insert into public.role_assignments(
    organization_id,
    membership_id,
    role_id,
    branch_id,
    granted_by
  )
  values(
    target_organization_id,
    membership.id,
    admin_role.id,
    created_branch.id,
    auth.uid()
  )
  on conflict(membership_id,role_id,branch_id) do nothing;

  insert into public.expression_ownerships(
    branch_id,
    organization_id,
    owner_profile_id,
    assigned_by
  )
  values(
    created_branch.id,
    target_organization_id,
    auth.uid(),
    auth.uid()
  );

  insert into public.audit_log(
    organization_id,
    branch_id,
    actor_profile_id,
    action,
    target_type,
    target_id,
    new_values
  )
  values(
    target_organization_id,
    created_branch.id,
    auth.uid(),
    'create',
    'expression',
    created_branch.id::text,
    jsonb_build_object(
      'name',created_branch.name,
      'code',created_branch.code,
      'ownerProfileId',auth.uid()
    )
  );

  return created_branch;
end;
$function$;

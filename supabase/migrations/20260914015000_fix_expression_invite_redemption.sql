-- Fix invite redemption failing after a successful preview.
--
-- The previous PL/pgSQL function returned columns named organization_id and
-- branch_id while also referencing table columns with the same unqualified
-- names. PostgreSQL therefore raised 42702 (ambiguous_column) before it could
-- create the Expression membership. Keep the existing invite-only workflow,
-- but qualify every table column and use named unique constraints for upserts.

create or replace function public.redeem_expression_invite_code(raw_code text)
returns table(organization_id uuid, branch_id uuid, expression_name text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.expression_invite_codes;
  org_membership public.memberships;
  branch_name text;
  already_member boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select c.*
  into invite
  from public.expression_invite_codes c
  where c.code_hash = encode(
    extensions.digest(upper(regexp_replace(trim(raw_code), '[^A-Z0-9]', '', 'g')), 'sha256'),
    'hex'
  )
  for update;

  if not found or invite.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'Invite code is invalid or unavailable';
  end if;

  if invite.expires_at is not null and invite.expires_at <= now() then
    update public.expression_invite_codes c
    set status = 'expired'
    where c.id = invite.id;
    raise exception using errcode = '22023', message = 'Invite code has expired';
  end if;

  if invite.usage_limit is not null and invite.usage_count >= invite.usage_limit then
    raise exception using errcode = '22023', message = 'Invite code usage limit reached';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = invite.organization_id
      and o.status = 'active'
  ) or not exists (
    select 1
    from public.branches b
    where b.id = invite.branch_id
      and b.organization_id = invite.organization_id
      and b.is_active
  ) then
    raise exception using errcode = '42501', message = 'Expression is unavailable';
  end if;

  select exists (
    select 1
    from public.expression_memberships em
    where em.organization_id = invite.organization_id
      and em.branch_id = invite.branch_id
      and em.profile_id = auth.uid()
      and em.status = 'active'
  )
  into already_member;

  if already_member then
    select b.name
    into branch_name
    from public.branches b
    where b.id = invite.branch_id
      and b.organization_id = invite.organization_id;

    return query
    select invite.organization_id, invite.branch_id, branch_name;
    return;
  end if;

  insert into public.memberships as m (organization_id, profile_id, status, joined_at)
  values (invite.organization_id, auth.uid(), 'active', current_date)
  on conflict on constraint memberships_organization_id_profile_id_key
  do update set
    status = 'active',
    joined_at = coalesce(m.joined_at, current_date)
  returning m.* into org_membership;

  insert into public.expression_memberships as em (
    organization_id,
    branch_id,
    membership_id,
    profile_id,
    status,
    joined_at,
    left_at
  )
  values (
    invite.organization_id,
    invite.branch_id,
    org_membership.id,
    auth.uid(),
    'active',
    now(),
    null
  )
  on conflict on constraint expression_memberships_branch_id_profile_id_key
  do update set
    membership_id = excluded.membership_id,
    status = 'active',
    joined_at = coalesce(em.joined_at, now()),
    left_at = null;

  update public.expression_invite_codes c
  set usage_count = c.usage_count + 1
  where c.id = invite.id;

  select b.name
  into branch_name
  from public.branches b
  where b.id = invite.branch_id
    and b.organization_id = invite.organization_id;

  insert into public.audit_log (
    organization_id,
    branch_id,
    actor_profile_id,
    action,
    target_type,
    target_id,
    new_values
  )
  values (
    invite.organization_id,
    invite.branch_id,
    auth.uid(),
    'join',
    'expression_membership',
    auth.uid()::text,
    jsonb_build_object('inviteCodeId', invite.id, 'status', 'active')
  );

  return query
  select invite.organization_id, invite.branch_id, branch_name;
end;
$function$;

grant execute on function public.redeem_expression_invite_code(text) to authenticated;

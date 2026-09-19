-- Restore the product boundary between church ministry operations and the
-- separate Platform Administration surface.

begin;

-- These capabilities authored church-facing content and therefore do not
-- belong to a global software-administration role.
delete from public.platform_role_permissions
where permission_code in (
  'platform.notifications.broadcast',
  'platform.identity_badges.manage',
  'platform.public_directory.manage'
);

update public.permissions
set is_active=false
where code in (
  'platform.notifications.broadcast',
  'platform.identity_badges.manage',
  'platform.public_directory.manage'
);

-- Prevent an older deployed Platform Administration client from invoking the
-- retired church-notification broadcast RPC.
revoke execute on function public.create_platform_notification_broadcast(
  uuid,uuid,text,text,text,boolean,timestamptz,uuid
) from service_role;

create or replace function public.create_platform_role_invitation(
  target_email text,
  target_role_code text,
  invite_message text default '',
  validity_hours integer default 168
)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_email text;
  target_profile uuid;
  result public.governance_invitations;
  expiration timestamptz;
  notification_organization uuid;
  offered_role_name text;
begin
  if not public.has_platform_permission('platform.roles.manage') then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  normalized_email:=lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023',message='Invalid email';
  end if;
  if validity_hours not between 1 and 720 then
    raise exception using errcode='22023',message='Invitation validity must be 1-720 hours';
  end if;
  select id into target_profile from auth.users where lower(email)=normalized_email;
  if target_profile is null then
    raise exception using errcode='P0002',message='Registered user not found';
  end if;
  select name into offered_role_name
  from public.platform_roles
  where code=target_role_code;
  if offered_role_name is null then
    raise exception using errcode='P0002',message='Platform role not found';
  end if;
  if exists(
    select 1
    from public.platform_role_assignments
    where profile_id=target_profile
      and role_code=target_role_code
      and (expires_at is null or expires_at>now())
  ) then
    raise exception using errcode='23505',message='User already has this platform role';
  end if;

  expiration:=now()+make_interval(hours=>validity_hours);
  update public.governance_invitations
  set status='revoked',revoked_at=now()
  where kind='platform_role'
    and target_profile_id=target_profile
    and platform_role_code=target_role_code
    and status='pending';

  insert into public.governance_invitations(
    kind,target_profile_id,target_email,platform_role_code,invited_by,message,expires_at
  )
  values(
    'platform_role',target_profile,normalized_email,target_role_code,auth.uid(),
    left(coalesce(invite_message,''),1000),expiration
  )
  returning * into result;

  -- The app is a delivery surface only. It may show this system-generated
  -- notice, but it cannot create or respond to the Platform Admin invitation.
  select m.organization_id
  into notification_organization
  from public.memberships m
  where m.profile_id=target_profile and m.status='active'
  order by m.created_at asc
  limit 1;

  if notification_organization is not null then
    insert into public.notifications(
      organization_id,recipient_profile_id,type,title,body,data
    )
    values(
      notification_organization,
      target_profile,
      'platform_role_invitation',
      'Platform Administration invitation',
      format(
        'You were invited to become %s. Sign in to the Platform Administration website to review it.',
        offered_role_name
      ),
      jsonb_build_object(
        'scope','general',
        'entityType','platform_role_invitation',
        'invitationId',result.id,
        'roleCode',target_role_code,
        'route','/general/notifications?view=actions',
        'dedupKey','platform-role-invitation:'||result.id::text
      )
    )
    on conflict do nothing;
  end if;

  insert into public.platform_audit_log(
    actor_profile_id,action,target_type,target_id,metadata
  )
  values(
    auth.uid(),'platform_role.invited','governance_invitation',result.id::text,
    jsonb_build_object(
      'targetProfileId',target_profile,
      'roleCode',target_role_code,
      'email',normalized_email,
      'notificationOrganizationId',notification_organization
    )
  );
  return result;
end;
$$;

-- The general governance RPC is used by the COT app and now responds only to
-- Expression ministry invitations.
create or replace function public.respond_governance_invitation(
  target_invitation_id uuid,
  decision text
)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare
  invitation public.governance_invitations;
  membership public.memberships;
  result public.governance_invitations;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Authentication required';
  end if;
  if decision not in ('accept','decline') then
    raise exception using errcode='22023',message='Decision must be accept or decline';
  end if;
  select * into invitation
  from public.governance_invitations
  where id=target_invitation_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='Invitation not found';
  end if;
  if invitation.target_profile_id<>auth.uid() then
    raise exception using errcode='42501',message='Invitation does not belong to this user';
  end if;
  if invitation.kind='platform_role' then
    raise exception using errcode='42501',message='Platform Administrator invitations must be completed in the Platform Administration website';
  end if;
  if invitation.status<>'pending' then
    raise exception using errcode='22023',message='Invitation is no longer pending';
  end if;
  if invitation.expires_at<=now() then
    update public.governance_invitations
    set status='expired',responded_at=now()
    where id=invitation.id;
    raise exception using errcode='22023',message='Invitation has expired';
  end if;
  if decision='decline' then
    update public.governance_invitations
    set status='declined',responded_at=now()
    where id=invitation.id
    returning * into result;
    return result;
  end if;

  insert into public.memberships(
    organization_id,branch_id,profile_id,status,joined_at
  )
  values(
    invitation.organization_id,invitation.branch_id,auth.uid(),'active',current_date
  )
  on conflict(organization_id,profile_id) do update
  set branch_id=excluded.branch_id,
      status='active',
      joined_at=coalesce(public.memberships.joined_at,current_date)
  returning * into membership;

  insert into public.role_assignments(
    organization_id,membership_id,role_id,branch_id,granted_by
  )
  values(
    invitation.organization_id,membership.id,invitation.organization_role_id,
    invitation.branch_id,invitation.invited_by
  )
  on conflict(membership_id,role_id,branch_id) do nothing;

  insert into public.audit_log(
    organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values
  )
  values(
    invitation.organization_id,invitation.branch_id,auth.uid(),'accept',
    'governance_invitation',invitation.id::text,
    jsonb_build_object('roleId',invitation.organization_role_id,'invitedBy',invitation.invited_by)
  );

  update public.governance_invitations
  set status='accepted',responded_at=now()
  where id=invitation.id
  returning * into result;
  return result;
end;
$$;

-- This RPC is callable only by the server-side web-admin endpoint. It does not
-- trust a client session or infer the target from arbitrary request data.
create or replace function public.respond_platform_role_invitation(
  target_invitation_id uuid,
  target_profile_id uuid,
  decision text
)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare
  invitation public.governance_invitations;
  result public.governance_invitations;
begin
  if decision not in ('accept','decline') then
    raise exception using errcode='22023',message='Decision must be accept or decline';
  end if;
  select * into invitation
  from public.governance_invitations
  where id=target_invitation_id
  for update;
  if not found or invitation.kind<>'platform_role' then
    raise exception using errcode='P0002',message='Platform Administrator invitation not found';
  end if;
  if invitation.target_profile_id<>target_profile_id then
    raise exception using errcode='42501',message='Invitation does not belong to this user';
  end if;
  if invitation.status<>'pending' then
    raise exception using errcode='22023',message='Invitation is no longer pending';
  end if;
  if invitation.expires_at<=now() then
    update public.governance_invitations
    set status='expired',responded_at=now()
    where id=invitation.id;
    raise exception using errcode='22023',message='Invitation has expired';
  end if;
  if decision='decline' then
    update public.governance_invitations
    set status='declined',responded_at=now()
    where id=invitation.id
    returning * into result;
    return result;
  end if;

  insert into public.platform_role_assignments(profile_id,role_code,granted_by)
  values(target_profile_id,invitation.platform_role_code,invitation.invited_by)
  on conflict(profile_id,role_code) do update
  set granted_by=excluded.granted_by,expires_at=null;

  insert into public.platform_audit_log(
    actor_profile_id,action,target_type,target_id,metadata
  )
  values(
    target_profile_id,'platform_role.accepted','profile',target_profile_id::text,
    jsonb_build_object(
      'invitationId',invitation.id,
      'roleCode',invitation.platform_role_code,
      'invitedBy',invitation.invited_by,
      'surface','platform_admin_web'
    )
  );

  update public.governance_invitations
  set status='accepted',responded_at=now()
  where id=invitation.id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.create_platform_role_invitation(text,text,text,integer)
from public,anon;
grant execute on function public.create_platform_role_invitation(text,text,text,integer)
to authenticated,service_role;

revoke all on function public.respond_governance_invitation(uuid,text)
from public,anon;
grant execute on function public.respond_governance_invitation(uuid,text)
to authenticated,service_role;

revoke all on function public.respond_platform_role_invitation(uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.respond_platform_role_invitation(uuid,uuid,text)
to service_role;

comment on function public.respond_platform_role_invitation(uuid,uuid,text) is
  'Server-only response path for Platform Administrator invitations accepted or declined in the separate web administration surface.';

commit;

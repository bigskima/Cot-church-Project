-- Production governance invitations, expression-creator authorization, and expression ownership.
-- Role offers require explicit acceptance. Expression creation is hidden/denied unless
-- Level-1 Platform Authority has granted an organization-scoped creator authorization.

insert into public.permissions(code,name,description,category) values
  ('platform.expression_creators.manage','Manage expression creator authorizations','Authorize or revoke users who may create new expressions.','platform')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

insert into public.platform_role_permissions(role_code,permission_code)
values ('super_admin','platform.expression_creators.manage')
on conflict do nothing;

create table public.role_blueprints (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]*$'),
  name text not null,
  description text not null default '',
  permission_codes text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger role_blueprints_updated
before update on public.role_blueprints
for each row execute function public.set_updated_at();

insert into public.role_blueprints(code,name,description,permission_codes) values (
  'expression_admin',
  'Expression Admin',
  'Administrative authority scoped only to one expression.',
  array[
    'branches.read','branches.update',
    'members.invite','members.read','members.update',
    'roles.read','roles.assign',
    'groups.read','groups.manage','groups.members.manage',
    'events.read','events.create','events.update',
    'attendance.read','attendance.manage',
    'announcements.read','announcements.manage',
    'notifications.manage',
    'sermons.read','sermons.create','sermons.manage','sermons.publish',
    'media.upload','media.manage',
    'videos.create','videos.publish','reels.create','reels.publish',
    'streams.manage','streams.broadcast','streams.moderate','streams.recordings.manage','livestream.publish_recording',
    'prayer.moderate','volunteers.read','volunteers.manage',
    'giving.read','giving.campaigns.manage','giving.finance.read',
    'feed.post','feed.moderate','posts.create','posts.publish',
    'expression.leadership.manage','units.read','units.manage','reports.read','studio.access'
  ]
)
on conflict(code) do update
set name=excluded.name,description=excluded.description,permission_codes=excluded.permission_codes,is_active=true;

create table public.expression_creator_authorizations (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id,profile_id),
  check ((is_active and revoked_at is null) or (not is_active))
);

create trigger expression_creator_authorizations_updated
before update on public.expression_creator_authorizations
for each row execute function public.set_updated_at();

create table public.expression_ownerships (
  branch_id uuid primary key,
  organization_id uuid not null,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  transferred_at timestamptz,
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade,
  unique(branch_id,organization_id)
);
create index expression_ownerships_owner_idx on public.expression_ownerships(organization_id,owner_profile_id);

create table public.governance_invitations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('platform_role','expression_role')),
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_email text not null,
  platform_role_code text references public.platform_roles(code) on delete restrict,
  organization_role_id uuid,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  expires_at timestamptz not null,
  responded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade,
  foreign key(organization_role_id,organization_id) references public.roles(id,organization_id) on delete restrict,
  check (
    (kind='platform_role' and organization_id is null and branch_id is null and platform_role_code is not null and organization_role_id is null)
    or
    (kind='expression_role' and organization_id is not null and branch_id is not null and platform_role_code is null and organization_role_id is not null)
  )
);
create trigger governance_invitations_updated
before update on public.governance_invitations
for each row execute function public.set_updated_at();
create index governance_invitations_target_idx on public.governance_invitations(target_profile_id,status,created_at desc);
create index governance_invitations_expression_idx on public.governance_invitations(organization_id,branch_id,status,created_at desc);
create unique index governance_pending_platform_role_uniq
  on public.governance_invitations(target_profile_id,platform_role_code)
  where kind='platform_role' and status='pending';
create unique index governance_pending_expression_role_uniq
  on public.governance_invitations(target_profile_id,branch_id,organization_role_id)
  where kind='expression_role' and status='pending';

alter table public.role_blueprints enable row level security;
alter table public.expression_creator_authorizations enable row level security;
alter table public.expression_ownerships enable row level security;
alter table public.governance_invitations enable row level security;

create policy role_blueprints_read_authenticated on public.role_blueprints
for select to authenticated using (is_active);

create policy expression_creator_authorizations_self_read on public.expression_creator_authorizations
for select to authenticated using (profile_id=auth.uid());
create policy expression_creator_authorizations_platform_read on public.expression_creator_authorizations
for select to authenticated using (public.has_platform_permission('platform.expression_creators.manage'));

create policy expression_ownerships_member_read on public.expression_ownerships
for select to authenticated using (public.is_organization_member(organization_id));

create policy governance_invitations_target_read on public.governance_invitations
for select to authenticated using (target_profile_id=auth.uid());
create policy governance_invitations_platform_read on public.governance_invitations
for select to authenticated using (kind='platform_role' and public.has_platform_permission('platform.roles.manage'));
create policy governance_invitations_expression_read on public.governance_invitations
for select to authenticated using (
  kind='expression_role'
  and public.has_permission(organization_id,'members.invite',branch_id)
  and public.has_permission(organization_id,'roles.assign',branch_id)
);

create function public.ensure_role_from_blueprint(target_organization_id uuid, blueprint_code text)
returns public.roles
language plpgsql
security definer
set search_path=''
as $$
declare blueprint public.role_blueprints; result public.roles; invalid_permission text;
begin
  select * into blueprint from public.role_blueprints where code=blueprint_code and is_active;
  if not found then raise exception using errcode='P0002',message='Role blueprint not found'; end if;
  select requested into invalid_permission
  from unnest(blueprint.permission_codes) requested
  left join public.permissions p on p.code=requested and p.is_active
  where p.code is null limit 1;
  if invalid_permission is not null then raise exception using errcode='22023',message='Role blueprint contains an inactive permission'; end if;

  select * into result from public.roles where organization_id=target_organization_id and code=blueprint.code;
  if not found then
    insert into public.roles(organization_id,code,name,description,is_system)
    values(target_organization_id,blueprint.code,blueprint.name,blueprint.description,true)
    returning * into result;
  end if;
  insert into public.role_permissions(role_id,permission_code)
  select result.id,requested from unnest(blueprint.permission_codes) requested
  on conflict do nothing;
  return result;
end; $$;

create function public.has_expression_creator_authorization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1 from public.expression_creator_authorizations eca
    where eca.organization_id=target_organization_id
      and eca.profile_id=auth.uid()
      and eca.is_active
  );
$$;

create function public.set_expression_creator_authorization(target_organization_id uuid,target_email text,enable_authorization boolean)
returns public.expression_creator_authorizations
language plpgsql
security definer
set search_path=''
as $$
declare normalized_email text; target_profile uuid; result public.expression_creator_authorizations;
begin
  if not public.has_platform_permission('platform.expression_creators.manage') then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  normalized_email:=lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023',message='Invalid email'; end if;
  select id into target_profile from auth.users where lower(email)=normalized_email;
  if target_profile is null then raise exception using errcode='P0002',message='Registered user not found'; end if;
  if not exists(select 1 from public.organizations where id=target_organization_id and status='active') then raise exception using errcode='P0002',message='Organization not found'; end if;

  insert into public.expression_creator_authorizations(organization_id,profile_id,granted_by,is_active,granted_at,revoked_by,revoked_at)
  values(target_organization_id,target_profile,auth.uid(),enable_authorization,now(),case when enable_authorization then null else auth.uid() end,case when enable_authorization then null else now() end)
  on conflict(organization_id,profile_id) do update set
    is_active=excluded.is_active,
    granted_by=case when excluded.is_active then auth.uid() else public.expression_creator_authorizations.granted_by end,
    granted_at=case when excluded.is_active then now() else public.expression_creator_authorizations.granted_at end,
    revoked_by=case when excluded.is_active then null else auth.uid() end,
    revoked_at=case when excluded.is_active then null else now() end
  returning * into result;

  insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
  values(auth.uid(),case when enable_authorization then 'expression_creator.authorized' else 'expression_creator.revoked' end,'profile',target_profile::text,jsonb_build_object('organizationId',target_organization_id,'email',normalized_email));
  return result;
end; $$;

create function public.create_authorized_expression(
  target_organization_id uuid,
  expression_name text,
  expression_code text,
  expression_timezone text default 'UTC',
  parent_expression_id uuid default null,
  expression_address jsonb default '{}'::jsonb
)
returns public.branches
language plpgsql
security definer
set search_path=''
as $$
declare created_branch public.branches; membership public.memberships; admin_role public.roles;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if not public.has_expression_creator_authorization(target_organization_id) then raise exception using errcode='42501',message='Expression creator authorization required'; end if;
  if char_length(trim(expression_name)) not between 1 and 160 or upper(trim(expression_code)) !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' then raise exception using errcode='22023',message='Invalid expression'; end if;
  if jsonb_typeof(expression_address)<>'object' then raise exception using errcode='22023',message='Address must be an object'; end if;
  if parent_expression_id is not null and not exists(select 1 from public.branches where id=parent_expression_id and organization_id=target_organization_id and is_active) then raise exception using errcode='22023',message='Invalid parent expression'; end if;

  insert into public.branches(organization_id,parent_branch_id,name,code,timezone,address)
  values(target_organization_id,parent_expression_id,trim(expression_name),upper(trim(expression_code)),coalesce(nullif(trim(expression_timezone),''),'UTC'),expression_address)
  returning * into created_branch;

  insert into public.memberships(organization_id,branch_id,profile_id,status,joined_at)
  values(target_organization_id,created_branch.id,auth.uid(),'active',current_date)
  on conflict(organization_id,profile_id) do update set branch_id=excluded.branch_id,status='active',joined_at=coalesce(public.memberships.joined_at,current_date)
  returning * into membership;

  admin_role:=public.ensure_role_from_blueprint(target_organization_id,'expression_admin');
  insert into public.role_assignments(organization_id,membership_id,role_id,branch_id,granted_by)
  values(target_organization_id,membership.id,admin_role.id,created_branch.id,auth.uid())
  on conflict(membership_id,role_id,branch_id) do nothing;

  insert into public.expression_ownerships(branch_id,organization_id,owner_profile_id,assigned_by)
  values(created_branch.id,target_organization_id,auth.uid(),auth.uid());

  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values)
  values(target_organization_id,created_branch.id,auth.uid(),'create','expression',created_branch.id::text,jsonb_build_object('name',created_branch.name,'code',created_branch.code,'ownerProfileId',auth.uid()));
  return created_branch;
end; $$;

create function public.transfer_expression_ownership(target_branch_id uuid,target_profile_id uuid,retain_previous_admin boolean default false)
returns public.expression_ownerships
language plpgsql
security definer
set search_path=''
as $$
declare ownership public.expression_ownerships; target_membership public.memberships; previous_membership public.memberships; admin_role public.roles; result public.expression_ownerships;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select * into ownership from public.expression_ownerships where branch_id=target_branch_id for update;
  if not found then raise exception using errcode='P0002',message='Expression ownership not found'; end if;
  if ownership.owner_profile_id<>auth.uid() and not public.has_platform_permission('platform.expressions.manage') then raise exception using errcode='42501',message='Only the current expression owner or Platform Authority may transfer ownership'; end if;
  if not exists(select 1 from public.profiles where id=target_profile_id) then raise exception using errcode='P0002',message='Target user not found'; end if;

  insert into public.memberships(organization_id,branch_id,profile_id,status,joined_at)
  values(ownership.organization_id,target_branch_id,target_profile_id,'active',current_date)
  on conflict(organization_id,profile_id) do update set branch_id=excluded.branch_id,status='active',joined_at=coalesce(public.memberships.joined_at,current_date)
  returning * into target_membership;
  admin_role:=public.ensure_role_from_blueprint(ownership.organization_id,'expression_admin');
  insert into public.role_assignments(organization_id,membership_id,role_id,branch_id,granted_by)
  values(ownership.organization_id,target_membership.id,admin_role.id,target_branch_id,auth.uid())
  on conflict(membership_id,role_id,branch_id) do nothing;

  if not retain_previous_admin and ownership.owner_profile_id<>target_profile_id then
    select * into previous_membership from public.memberships where organization_id=ownership.organization_id and profile_id=ownership.owner_profile_id;
    if found then delete from public.role_assignments where membership_id=previous_membership.id and role_id=admin_role.id and branch_id=target_branch_id; end if;
  end if;

  update public.expression_ownerships
  set owner_profile_id=target_profile_id,assigned_by=auth.uid(),transferred_at=now()
  where branch_id=target_branch_id returning * into result;
  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,old_values,new_values)
  values(ownership.organization_id,target_branch_id,auth.uid(),'transfer','expression_ownership',target_branch_id::text,jsonb_build_object('ownerProfileId',ownership.owner_profile_id),jsonb_build_object('ownerProfileId',target_profile_id,'retainedPreviousAdmin',retain_previous_admin));
  return result;
end; $$;

create function public.create_platform_role_invitation(target_email text,target_role_code text,invite_message text default '',validity_hours integer default 168)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare normalized_email text; target_profile uuid; result public.governance_invitations; expiration timestamptz;
begin
  if not public.has_platform_permission('platform.roles.manage') then raise exception using errcode='42501',message='Permission denied'; end if;
  normalized_email:=lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023',message='Invalid email'; end if;
  if validity_hours not between 1 and 720 then raise exception using errcode='22023',message='Invitation validity must be 1-720 hours'; end if;
  select id into target_profile from auth.users where lower(email)=normalized_email;
  if target_profile is null then raise exception using errcode='P0002',message='Registered user not found'; end if;
  if not exists(select 1 from public.platform_roles where code=target_role_code) then raise exception using errcode='P0002',message='Platform role not found'; end if;
  if exists(select 1 from public.platform_role_assignments where profile_id=target_profile and role_code=target_role_code and (expires_at is null or expires_at>now())) then raise exception using errcode='23505',message='User already has this platform role'; end if;
  expiration:=now()+make_interval(hours=>validity_hours);
  update public.governance_invitations set status='revoked',revoked_at=now() where kind='platform_role' and target_profile_id=target_profile and platform_role_code=target_role_code and status='pending';
  insert into public.governance_invitations(kind,target_profile_id,target_email,platform_role_code,invited_by,message,expires_at)
  values('platform_role',target_profile,normalized_email,target_role_code,auth.uid(),left(coalesce(invite_message,''),1000),expiration)
  returning * into result;
  insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
  values(auth.uid(),'platform_role.invited','governance_invitation',result.id::text,jsonb_build_object('targetProfileId',target_profile,'roleCode',target_role_code,'email',normalized_email));
  return result;
end; $$;

create function public.create_expression_role_invitation(target_organization_id uuid,target_branch_id uuid,target_email text,target_role_id uuid,invite_message text default '',validity_hours integer default 168)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare normalized_email text; target_profile uuid; result public.governance_invitations; expiration timestamptz; branch_name text; role_name text; role_code text;
begin
  if not public.has_permission(target_organization_id,'members.invite',target_branch_id) or not public.has_permission(target_organization_id,'roles.assign',target_branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
  normalized_email:=lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023',message='Invalid email'; end if;
  if validity_hours not between 1 and 720 then raise exception using errcode='22023',message='Invitation validity must be 1-720 hours'; end if;
  select id into target_profile from auth.users where lower(email)=normalized_email;
  if target_profile is null then raise exception using errcode='P0002',message='Registered user not found'; end if;
  select name into branch_name from public.branches where id=target_branch_id and organization_id=target_organization_id and is_active;
  if branch_name is null then raise exception using errcode='P0002',message='Expression not found'; end if;
  select name,code into role_name,role_code from public.roles where id=target_role_id and organization_id=target_organization_id;
  if role_name is null then raise exception using errcode='P0002',message='Role not found'; end if;
  if role_code='owner' then raise exception using errcode='22023',message='Organization Owner cannot be offered at expression scope'; end if;
  expiration:=now()+make_interval(hours=>validity_hours);
  update public.governance_invitations set status='revoked',revoked_at=now() where kind='expression_role' and target_profile_id=target_profile and branch_id=target_branch_id and organization_role_id=target_role_id and status='pending';
  insert into public.governance_invitations(kind,organization_id,branch_id,target_profile_id,target_email,organization_role_id,invited_by,message,expires_at)
  values('expression_role',target_organization_id,target_branch_id,target_profile,normalized_email,target_role_id,auth.uid(),left(coalesce(invite_message,''),1000),expiration)
  returning * into result;
  insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
  values(target_organization_id,target_profile,'role_invitation','Expression role invitation',format('You have been invited to join %s as %s.',branch_name,role_name),jsonb_build_object('invitationId',result.id,'kind','expression_role','branchId',target_branch_id,'roleId',target_role_id));
  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values)
  values(target_organization_id,target_branch_id,auth.uid(),'invite','governance_invitation',result.id::text,jsonb_build_object('targetProfileId',target_profile,'roleId',target_role_id,'email',normalized_email));
  return result;
end; $$;

create function public.respond_governance_invitation(target_invitation_id uuid,decision text)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare invitation public.governance_invitations; membership public.memberships; result public.governance_invitations;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if decision not in ('accept','decline') then raise exception using errcode='22023',message='Decision must be accept or decline'; end if;
  select * into invitation from public.governance_invitations where id=target_invitation_id for update;
  if not found then raise exception using errcode='P0002',message='Invitation not found'; end if;
  if invitation.target_profile_id<>auth.uid() then raise exception using errcode='42501',message='Invitation does not belong to this user'; end if;
  if invitation.status<>'pending' then raise exception using errcode='22023',message='Invitation is no longer pending'; end if;
  if invitation.expires_at<=now() then
    update public.governance_invitations set status='expired',responded_at=now() where id=invitation.id;
    raise exception using errcode='22023',message='Invitation has expired';
  end if;
  if decision='decline' then
    update public.governance_invitations set status='declined',responded_at=now() where id=invitation.id returning * into result;
    return result;
  end if;

  if invitation.kind='platform_role' then
    insert into public.platform_role_assignments(profile_id,role_code,granted_by)
    values(auth.uid(),invitation.platform_role_code,invitation.invited_by)
    on conflict(profile_id,role_code) do update set granted_by=excluded.granted_by,expires_at=null;
    insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
    values(auth.uid(),'platform_role.accepted','profile',auth.uid()::text,jsonb_build_object('invitationId',invitation.id,'roleCode',invitation.platform_role_code,'invitedBy',invitation.invited_by));
  else
    insert into public.memberships(organization_id,branch_id,profile_id,status,joined_at)
    values(invitation.organization_id,invitation.branch_id,auth.uid(),'active',current_date)
    on conflict(organization_id,profile_id) do update set branch_id=excluded.branch_id,status='active',joined_at=coalesce(public.memberships.joined_at,current_date)
    returning * into membership;
    insert into public.role_assignments(organization_id,membership_id,role_id,branch_id,granted_by)
    values(invitation.organization_id,membership.id,invitation.organization_role_id,invitation.branch_id,invitation.invited_by)
    on conflict(membership_id,role_id,branch_id) do nothing;
    insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values)
    values(invitation.organization_id,invitation.branch_id,auth.uid(),'accept','governance_invitation',invitation.id::text,jsonb_build_object('roleId',invitation.organization_role_id,'invitedBy',invitation.invited_by));
  end if;

  update public.governance_invitations set status='accepted',responded_at=now() where id=invitation.id returning * into result;
  return result;
end; $$;

create function public.revoke_governance_invitation(target_invitation_id uuid)
returns public.governance_invitations
language plpgsql
security definer
set search_path=''
as $$
declare invitation public.governance_invitations; result public.governance_invitations;
begin
  select * into invitation from public.governance_invitations where id=target_invitation_id for update;
  if not found then raise exception using errcode='P0002',message='Invitation not found'; end if;
  if invitation.status<>'pending' then raise exception using errcode='22023',message='Invitation is no longer pending'; end if;
  if invitation.kind='platform_role' then
    if not public.has_platform_permission('platform.roles.manage') then raise exception using errcode='42501',message='Permission denied'; end if;
  else
    if not public.has_permission(invitation.organization_id,'members.invite',invitation.branch_id) or not public.has_permission(invitation.organization_id,'roles.assign',invitation.branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
  end if;
  update public.governance_invitations set status='revoked',revoked_at=now() where id=invitation.id returning * into result;
  return result;
end; $$;

revoke all on function public.ensure_role_from_blueprint(uuid,text) from public;
revoke all on function public.has_expression_creator_authorization(uuid) from public;
revoke all on function public.set_expression_creator_authorization(uuid,text,boolean) from public;
revoke all on function public.create_authorized_expression(uuid,text,text,text,uuid,jsonb) from public;
revoke all on function public.transfer_expression_ownership(uuid,uuid,boolean) from public;
revoke all on function public.create_platform_role_invitation(text,text,text,integer) from public;
revoke all on function public.create_expression_role_invitation(uuid,uuid,text,uuid,text,integer) from public;
revoke all on function public.respond_governance_invitation(uuid,text) from public;
revoke all on function public.revoke_governance_invitation(uuid) from public;
grant execute on function public.has_expression_creator_authorization(uuid) to authenticated;
grant execute on function public.set_expression_creator_authorization(uuid,text,boolean) to authenticated;
grant execute on function public.create_authorized_expression(uuid,text,text,text,uuid,jsonb) to authenticated;
grant execute on function public.transfer_expression_ownership(uuid,uuid,boolean) to authenticated;
grant execute on function public.create_platform_role_invitation(text,text,text,integer) to authenticated;
grant execute on function public.create_expression_role_invitation(uuid,uuid,text,uuid,text,integer) to authenticated;
grant execute on function public.respond_governance_invitation(uuid,text) to authenticated;
grant execute on function public.revoke_governance_invitation(uuid) to authenticated;

comment on table public.governance_invitations is 'Role offers that grant authority only after the targeted user explicitly accepts.';
comment on table public.expression_creator_authorizations is 'Level-1 Platform Authority grants allowing specific registered users to create expressions.';
comment on table public.expression_ownerships is 'Current accountable owner of each expression; ownership transfer is explicit and audited.';

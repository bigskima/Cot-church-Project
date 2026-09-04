-- Public identity badges are presentation metadata, never authorization.
create table public.identity_badge_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_-]{1,60}$'),
  label text not null check (char_length(label) between 1 and 80),
  background_color text not null check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  priority integer not null default 0,
  is_membership_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code),
  unique(id,organization_id)
);

create unique index identity_badge_one_membership_default
on public.identity_badge_definitions(organization_id)
where is_membership_default and is_active;

create table public.identity_badge_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_definition_id uuid not null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade,
  foreign key(badge_definition_id,organization_id) references public.identity_badge_definitions(id,organization_id) on delete cascade,
  unique(branch_id,profile_id,badge_definition_id)
);

create trigger identity_badge_definitions_updated before update on public.identity_badge_definitions for each row execute function public.set_updated_at();
create trigger identity_badge_assignments_updated before update on public.identity_badge_assignments for each row execute function public.set_updated_at();

alter table public.identity_badge_definitions enable row level security;
alter table public.identity_badge_assignments enable row level security;

create policy identity_badge_definitions_public_read on public.identity_badge_definitions
for select to anon,authenticated using(is_active);
create policy identity_badge_assignments_public_read on public.identity_badge_assignments
for select to anon,authenticated using(is_active);

-- Product defaults are rows, not frontend constants; authorized administrators may replace them later.
insert into public.identity_badge_definitions(organization_id,code,label,background_color,text_color,priority,is_membership_default)
select id,'member','Member','#2563EB','#FFFFFF',10,true from public.organizations
on conflict(organization_id,code) do nothing;
insert into public.identity_badge_definitions(organization_id,code,label,background_color,text_color,priority)
select id,'senior_pastor','Senior Pastor','#C99700','#FFFFFF',100 from public.organizations on conflict(organization_id,code) do nothing;
insert into public.identity_badge_definitions(organization_id,code,label,background_color,text_color,priority)
select id,'associate_pastor','Associate Pastor','#6D5BD0','#FFFFFF',80 from public.organizations on conflict(organization_id,code) do nothing;
insert into public.identity_badge_definitions(organization_id,code,label,background_color,text_color,priority)
select id,'expression_pastor','Expression Pastor','#0F766E','#FFFFFF',90 from public.organizations on conflict(organization_id,code) do nothing;
insert into public.identity_badge_definitions(organization_id,code,label,background_color,text_color,priority)
select id,'leader','Leader','#475569','#FFFFFF',60 from public.organizations on conflict(organization_id,code) do nothing;

create or replace function public.set_expression_identity_badge(
  target_organization_id uuid,
  target_branch_id uuid,
  target_email text,
  target_badge_definition_id uuid,
  enable_badge boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_email text;
  target_profile uuid;
  badge public.identity_badge_definitions;
begin
  if not public.has_permission(target_organization_id,'expression.leadership.manage',target_branch_id) then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  normalized_email:=lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023',message='Invalid email'; end if;
  select id into target_profile from auth.users where lower(email)=normalized_email;
  if target_profile is null then raise exception using errcode='P0002',message='Registered user not found'; end if;
  if not exists(select 1 from public.memberships where organization_id=target_organization_id and branch_id=target_branch_id and profile_id=target_profile and status='active') then
    raise exception using errcode='42501',message='User is not an active member of this Expression';
  end if;
  select * into badge from public.identity_badge_definitions where id=target_badge_definition_id and organization_id=target_organization_id and is_active and not is_membership_default;
  if not found then raise exception using errcode='P0002',message='Badge definition not found'; end if;

  if enable_badge then
    insert into public.identity_badge_assignments(organization_id,branch_id,profile_id,badge_definition_id,assigned_by,is_active)
    values(target_organization_id,target_branch_id,target_profile,target_badge_definition_id,auth.uid(),true)
    on conflict(branch_id,profile_id,badge_definition_id) do update set is_active=true,assigned_by=auth.uid();
  else
    update public.identity_badge_assignments set is_active=false,assigned_by=auth.uid()
    where organization_id=target_organization_id and branch_id=target_branch_id and profile_id=target_profile and badge_definition_id=target_badge_definition_id;
  end if;

  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values)
  values(target_organization_id,target_branch_id,auth.uid(),case when enable_badge then 'assign' else 'revoke' end,'identity_badge',target_profile::text,jsonb_build_object('badgeId',target_badge_definition_id,'email',normalized_email));
  return jsonb_build_object('profileId',target_profile,'badgeId',target_badge_definition_id,'active',enable_badge);
end;
$$;

revoke all on function public.set_expression_identity_badge(uuid,uuid,text,uuid,boolean) from public;
grant execute on function public.set_expression_identity_badge(uuid,uuid,text,uuid,boolean) to authenticated;

comment on table public.identity_badge_definitions is 'Configurable public display tags. They never grant permissions.';
comment on table public.identity_badge_assignments is 'Expression-scoped public display badge assignments independent of RBAC.';

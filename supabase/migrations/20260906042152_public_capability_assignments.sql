insert into public.permissions(code,name,description,category,is_active)
values(
  'public.live_stream.create',
  'Start public live broadcasts',
  'Create and operate live broadcasts in the General Community public COT space.',
  'public',
  true
)
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  is_active=true;

create table public.public_capability_assignments(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete restrict,
  is_active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  reason text not null default '',
  expires_at timestamptz,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,permission_code),
  check(permission_code like 'public.%'),
  check((is_active and revoked_at is null) or not is_active)
);

create index public_capability_assignments_profile_idx
on public.public_capability_assignments(profile_id)
where is_active;

alter table public.public_capability_assignments enable row level security;

create policy public_capability_assignments_read
on public.public_capability_assignments
for select to authenticated
using(
  profile_id=(select auth.uid())
  or public.has_platform_permission('platform.roles.read')
);

create or replace function public.has_public_capability(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select
    auth.uid() is not null
    and requested_permission like 'public.%'
    and exists(
      select 1
      from public.public_capability_assignments pca
      join public.permissions p on p.code=pca.permission_code
      where pca.profile_id=auth.uid()
        and pca.permission_code=requested_permission
        and pca.is_active
        and p.is_active
        and (pca.expires_at is null or pca.expires_at>now())
    );
$function$;

revoke all on function public.has_public_capability(text) from public,anon;
grant execute on function public.has_public_capability(text) to authenticated,service_role;

create or replace function public.set_public_capability_assignment(
  target_profile_id uuid,
  target_permission_code text,
  enable_capability boolean,
  assignment_reason text default ''
)
returns table(
  profile_id uuid,
  permission_code text,
  is_active boolean,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  normalized_reason text:=trim(coalesce(assignment_reason,''));
begin
  if auth.uid() is null or not public.has_platform_permission('platform.roles.manage') then
    raise exception using errcode='42501',message='Platform role management permission required';
  end if;

  if target_permission_code not like 'public.%' then
    raise exception using errcode='22023',message='Only public COT capabilities can be assigned here';
  end if;

  if not exists(
    select 1 from public.permissions p
    where p.code=target_permission_code and p.is_active and p.category='public'
  ) then
    raise exception using errcode='22023',message='Public capability is unavailable';
  end if;

  if not exists(select 1 from public.profiles p where p.id=target_profile_id) then
    raise exception using errcode='P0002',message='Profile not found';
  end if;

  if enable_capability then
    insert into public.public_capability_assignments(
      profile_id,permission_code,is_active,granted_by,updated_by,reason,revoked_at,granted_at,updated_at
    )
    values(
      target_profile_id,target_permission_code,true,auth.uid(),auth.uid(),normalized_reason,null,now(),now()
    )
    on conflict on constraint public_capability_assignments_profile_id_permission_code_key do update set
      is_active=true,
      granted_by=auth.uid(),
      updated_by=auth.uid(),
      reason=normalized_reason,
      revoked_at=null,
      granted_at=now(),
      updated_at=now();
  else
    update public.public_capability_assignments pca
    set is_active=false,
        updated_by=auth.uid(),
        reason=case when normalized_reason<>'' then normalized_reason else pca.reason end,
        revoked_at=now(),
        updated_at=now()
    where pca.profile_id=target_profile_id
      and pca.permission_code=target_permission_code;

    if not found then
      raise exception using errcode='P0002',message='Capability assignment not found';
    end if;
  end if;

  insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
  values(
    auth.uid(),
    case when enable_capability then 'public_capability.granted' else 'public_capability.revoked' end,
    'public_capability',
    target_profile_id::text||':'||target_permission_code,
    jsonb_build_object(
      'profileId',target_profile_id,
      'permissionCode',target_permission_code,
      'enabled',enable_capability,
      'reason',normalized_reason
    )
  );

  return query
  select pca.profile_id,pca.permission_code,pca.is_active,pca.granted_at,pca.revoked_at,pca.expires_at
  from public.public_capability_assignments pca
  where pca.profile_id=target_profile_id
    and pca.permission_code=target_permission_code;
end
$function$;

revoke all on function public.set_public_capability_assignment(uuid,text,boolean,text) from public,anon;
grant execute on function public.set_public_capability_assignment(uuid,text,boolean,text) to authenticated,service_role;

comment on table public.public_capability_assignments is
  'Top-level General Community capability grants. Deliberately separate from organization and Expression role assignments.';
comment on function public.has_public_capability(text) is
  'Checks the signed-in user public COT capabilities without consulting Expression roles.';

-- Database-driven, organization-scoped role-based access control.

create table public.permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_-]*$'),
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_code)
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null,
  role_id uuid not null,
  branch_id uuid,
  granted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade,
  foreign key (role_id, organization_id) references public.roles(id, organization_id) on delete cascade,
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  unique nulls not distinct (membership_id, role_id, branch_id)
);

create index roles_organization_id_idx on public.roles (organization_id);
create index role_assignments_membership_idx on public.role_assignments (membership_id);
create index role_assignments_scope_idx on public.role_assignments (organization_id, branch_id);

create trigger roles_set_updated_at before update on public.roles
for each row execute function public.set_updated_at();

create function public.has_permission(
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
  select exists (
    select 1
    from public.memberships m
    join public.role_assignments ra
      on ra.membership_id = m.id and ra.organization_id = m.organization_id
    join public.role_permissions rp on rp.role_id = ra.role_id
    join public.permissions p on p.code = rp.permission_code
    where m.profile_id = auth.uid()
      and m.organization_id = target_organization_id
      and m.status = 'active'
      and p.code = requested_permission
      and p.is_active
      and (ra.expires_at is null or ra.expires_at > now())
      and (ra.branch_id is null or ra.branch_id = target_branch_id)
  );
$$;

revoke all on function public.has_permission(uuid, text, uuid) from public;
grant execute on function public.has_permission(uuid, text, uuid) to authenticated;

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.role_assignments enable row level security;

create policy permissions_read_authenticated on public.permissions
for select to authenticated using (is_active);
create policy roles_read_for_members on public.roles
for select to authenticated using (public.is_organization_member(organization_id));
create policy role_permissions_read_for_members on public.role_permissions
for select to authenticated using (
  exists (select 1 from public.roles r where r.id = role_id and public.is_organization_member(r.organization_id))
);
create policy role_assignments_read_self on public.role_assignments
for select to authenticated using (
  exists (
    select 1 from public.memberships m
    where m.id = membership_id and m.profile_id = auth.uid()
  )
);

comment on function public.has_permission(uuid, text, uuid) is
  'Checks active, unexpired role grants at organization or branch scope for the current authenticated user.';

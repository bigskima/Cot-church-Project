-- Separate Level-1 Platform Authority from organization/expression RBAC.
-- Platform roles govern the software ecosystem; organization roles govern churches.

insert into public.permissions (code, name, description, category) values
  ('platform.overview.read', 'View platform overview', 'View platform-wide operational telemetry.', 'platform'),
  ('platform.organizations.read', 'View platform organizations', 'Inspect organizations registered on the platform.', 'platform'),
  ('platform.organizations.manage', 'Manage platform organizations', 'Suspend, restore, archive, and govern organizations at platform scope.', 'platform'),
  ('platform.expressions.read', 'View platform expressions', 'Inspect expressions across organizations.', 'platform'),
  ('platform.expressions.manage', 'Manage platform expressions', 'Suspend, restore, and govern expression availability at platform scope.', 'platform'),
  ('platform.users.read', 'View platform identities', 'Inspect platform identities for support, safety, and governance.', 'platform'),
  ('platform.users.manage', 'Manage platform identities', 'Perform platform account safety and lifecycle actions.', 'platform'),
  ('platform.streaming.read', 'View streaming infrastructure', 'Inspect streaming providers, broadcasts, failures, and usage.', 'platform'),
  ('platform.streaming.manage', 'Manage streaming infrastructure', 'Configure streaming infrastructure and perform emergency platform actions.', 'platform'),
  ('platform.ai.read', 'View AI infrastructure', 'Inspect AI providers, models, routes, and usage.', 'platform'),
  ('platform.ai.manage', 'Manage AI infrastructure', 'Configure platform AI providers, routes, models, and limits.', 'platform'),
  ('platform.payments.read', 'View payment infrastructure', 'Inspect payment provider and reconciliation infrastructure.', 'platform'),
  ('platform.payments.manage', 'Manage payment infrastructure', 'Configure and govern platform payment infrastructure.', 'platform'),
  ('platform.integrations.read', 'View platform integrations', 'Inspect platform jobs, webhooks, workers, and integrations.', 'platform'),
  ('platform.integrations.manage', 'Manage platform integrations', 'Configure or operate platform integrations and workers.', 'platform'),
  ('platform.features.read', 'View platform feature flags', 'Inspect global and tenant capability rollout state.', 'platform'),
  ('platform.features.manage', 'Manage platform feature flags', 'Configure global and tenant feature availability.', 'platform'),
  ('platform.audit.read', 'View platform audit', 'Read Level-1 platform governance audit records.', 'platform'),
  ('platform.security.manage', 'Manage platform security', 'Perform privileged platform security and incident actions.', 'platform'),
  ('platform.roles.read', 'View platform roles', 'Inspect Level-1 platform role assignments and capabilities.', 'platform'),
  ('platform.roles.manage', 'Manage platform roles', 'Grant and revoke Level-1 platform authority roles.', 'platform')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    is_active = true;

-- platform.branding.manage was introduced by an older migration. It remains in the
-- shared permission catalogue, but is now treated as a Level-1 platform capability.
update public.permissions
set category = 'platform',
    name = 'Manage platform branding',
    description = 'Configure platform-owned logos, launch branding, and appearance.',
    is_active = true
where code = 'platform.branding.manage';

create table public.platform_roles (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]*$'),
  name text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_role_permissions (
  role_code text not null references public.platform_roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_code, permission_code),
  check (permission_code like 'platform.%')
);

create table public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null references public.platform_roles(code) on delete restrict,
  granted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, role_code)
);

create index platform_role_assignments_profile_idx
  on public.platform_role_assignments(profile_id);
create index platform_role_assignments_expiry_idx
  on public.platform_role_assignments(expires_at)
  where expires_at is not null;

create trigger platform_roles_set_updated_at
before update on public.platform_roles
for each row execute function public.set_updated_at();

insert into public.platform_roles (code, name, description) values
  ('super_admin', 'Platform Super Admin', 'Full Level-1 platform governance authority.'),
  ('admin', 'Platform Admin', 'Broad platform governance without authority to grant Level-1 roles.'),
  ('operations', 'Platform Operations', 'Infrastructure, provider, jobs, and operational incident authority.'),
  ('moderator', 'Platform Moderator', 'Global safety, identity governance, and moderation authority.'),
  ('support', 'Platform Support', 'Read-oriented support access for tenant and infrastructure troubleshooting.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

-- Super Admin receives every active platform capability, including future platform
-- capabilities present when this migration is applied.
insert into public.platform_role_permissions (role_code, permission_code)
select 'super_admin', p.code
from public.permissions p
where p.code like 'platform.%' and p.is_active
on conflict do nothing;

insert into public.platform_role_permissions (role_code, permission_code) values
  ('admin', 'platform.overview.read'),
  ('admin', 'platform.organizations.read'),
  ('admin', 'platform.organizations.manage'),
  ('admin', 'platform.expressions.read'),
  ('admin', 'platform.expressions.manage'),
  ('admin', 'platform.users.read'),
  ('admin', 'platform.users.manage'),
  ('admin', 'platform.streaming.read'),
  ('admin', 'platform.streaming.manage'),
  ('admin', 'platform.ai.read'),
  ('admin', 'platform.ai.manage'),
  ('admin', 'platform.payments.read'),
  ('admin', 'platform.payments.manage'),
  ('admin', 'platform.integrations.read'),
  ('admin', 'platform.integrations.manage'),
  ('admin', 'platform.features.read'),
  ('admin', 'platform.features.manage'),
  ('admin', 'platform.audit.read'),
  ('admin', 'platform.branding.manage'),
  ('admin', 'platform.roles.read'),

  ('operations', 'platform.overview.read'),
  ('operations', 'platform.organizations.read'),
  ('operations', 'platform.expressions.read'),
  ('operations', 'platform.streaming.read'),
  ('operations', 'platform.streaming.manage'),
  ('operations', 'platform.ai.read'),
  ('operations', 'platform.payments.read'),
  ('operations', 'platform.integrations.read'),
  ('operations', 'platform.integrations.manage'),
  ('operations', 'platform.audit.read'),

  ('moderator', 'platform.overview.read'),
  ('moderator', 'platform.organizations.read'),
  ('moderator', 'platform.expressions.read'),
  ('moderator', 'platform.users.read'),
  ('moderator', 'platform.users.manage'),
  ('moderator', 'platform.audit.read'),
  ('moderator', 'platform.security.manage'),

  ('support', 'platform.overview.read'),
  ('support', 'platform.organizations.read'),
  ('support', 'platform.expressions.read'),
  ('support', 'platform.users.read'),
  ('support', 'platform.streaming.read'),
  ('support', 'platform.ai.read'),
  ('support', 'platform.payments.read'),
  ('support', 'platform.integrations.read')
on conflict do nothing;

create function public.has_platform_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_role_assignments pra
    join public.platform_role_permissions prp on prp.role_code = pra.role_code
    join public.permissions p on p.code = prp.permission_code
    where pra.profile_id = auth.uid()
      and prp.permission_code = requested_permission
      and p.is_active
      and (pra.expires_at is null or pra.expires_at > now())
  );
$$;

revoke all on function public.has_platform_permission(text) from public;
grant execute on function public.has_platform_permission(text) to authenticated;

create table public.platform_audit_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index platform_audit_time_idx on public.platform_audit_log(occurred_at desc);
create index platform_audit_target_idx on public.platform_audit_log(target_type, target_id);

alter table public.platform_roles enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.platform_audit_log enable row level security;

create policy platform_roles_read_authorized on public.platform_roles
for select to authenticated
using (public.has_platform_permission('platform.roles.read'));

create policy platform_role_permissions_read_authorized on public.platform_role_permissions
for select to authenticated
using (public.has_platform_permission('platform.roles.read'));

create policy platform_role_assignments_read_self_or_authorized on public.platform_role_assignments
for select to authenticated
using (
  profile_id = auth.uid()
  or public.has_platform_permission('platform.roles.read')
);

create policy platform_audit_read_authorized on public.platform_audit_log
for select to authenticated
using (public.has_platform_permission('platform.audit.read'));

comment on table public.platform_role_assignments is
  'Level-1 platform authority assignments. These are deliberately separate from organization/expression role assignments.';
comment on function public.has_platform_permission(text) is
  'Checks Level-1 platform authority independently from organization membership and organization-scoped RBAC.';

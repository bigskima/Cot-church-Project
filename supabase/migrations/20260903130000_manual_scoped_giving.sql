-- Production giving configuration: manual transfers now, provider payments later.
-- Church-wide giving is governed by Level-1 Platform Authority.
-- Expression giving is governed by expression-scoped organization permissions.

insert into public.permissions (code, name, description, category) values
  ('platform.giving.read', 'View church-wide giving configuration', 'Inspect church-wide giving settings, purposes, and transfer destinations.', 'platform'),
  ('platform.giving.manage', 'Manage church-wide giving configuration', 'Configure church-wide giving settings, purposes, and transfer destinations.', 'platform')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    is_active = true;

insert into public.platform_role_permissions (role_code, permission_code) values
  ('super_admin', 'platform.giving.read'),
  ('super_admin', 'platform.giving.manage'),
  ('admin', 'platform.giving.read'),
  ('admin', 'platform.giving.manage'),
  ('operations', 'platform.giving.read')
on conflict do nothing;

create table if not exists public.giving_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  display_title text not null default 'Giving' check (char_length(trim(display_title)) between 1 and 120),
  display_subtitle text not null default '' check (char_length(display_subtitle) <= 1000),
  is_enabled boolean not null default true,
  manual_transfer_enabled boolean not null default true,
  online_payment_enabled boolean not null default false,
  online_unavailable_message text not null default 'Online giving is not available yet.' check (char_length(online_unavailable_message) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create unique index if not exists giving_settings_organization_scope_uq
  on public.giving_settings (organization_id)
  where branch_id is null;
create unique index if not exists giving_settings_expression_scope_uq
  on public.giving_settings (organization_id, branch_id)
  where branch_id is not null;
create index if not exists giving_settings_scope_idx
  on public.giving_settings (organization_id, branch_id);

create table if not exists public.giving_purposes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  display_order integer not null default 0 check (display_order between -100000 and 100000),
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

create index if not exists giving_purposes_scope_idx
  on public.giving_purposes (organization_id, branch_id, status, display_order);
create unique index if not exists giving_purposes_organization_name_uq
  on public.giving_purposes (organization_id, lower(name))
  where branch_id is null and status <> 'archived';
create unique index if not exists giving_purposes_expression_name_uq
  on public.giving_purposes (organization_id, branch_id, lower(name))
  where branch_id is not null and status <> 'archived';
create unique index if not exists giving_purposes_organization_default_uq
  on public.giving_purposes (organization_id)
  where branch_id is null and is_default = true and status = 'active';
create unique index if not exists giving_purposes_expression_default_uq
  on public.giving_purposes (organization_id, branch_id)
  where branch_id is not null and is_default = true and status = 'active';

alter table public.organization_bank_accounts
  add column if not exists label text not null default 'Bank transfer',
  add column if not exists swift_code text,
  add column if not exists iban text,
  add column if not exists is_active boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists additional_instructions text not null default '';

alter table public.organization_bank_accounts
  alter column currency drop default;

alter table public.organization_bank_accounts
  drop constraint if exists organization_bank_accounts_organization_id_branch_id_currency_key;

create index if not exists organization_bank_accounts_scope_idx
  on public.organization_bank_accounts (organization_id, branch_id, is_active, display_order);
create unique index if not exists organization_bank_accounts_root_identity_uq
  on public.organization_bank_accounts (organization_id, currency, lower(bank_name), account_number)
  where branch_id is null;
create unique index if not exists organization_bank_accounts_expression_identity_uq
  on public.organization_bank_accounts (organization_id, branch_id, currency, lower(bank_name), account_number)
  where branch_id is not null;

-- Root/church-wide giving is intentionally not writable through organization RBAC.
-- Platform Authority writes it through trusted server-side control-plane functions.
drop policy if exists bank_accounts_manage on public.organization_bank_accounts;
create policy bank_accounts_expression_manage on public.organization_bank_accounts
  for all to authenticated
  using (
    branch_id is not null
    and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  )
  with check (
    branch_id is not null
    and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );

drop policy if exists bank_accounts_public_read on public.organization_bank_accounts;
create policy bank_accounts_public_read on public.organization_bank_accounts
  for select to anon, authenticated
  using (is_public = true and is_active = true);

alter table public.giving_settings enable row level security;
alter table public.giving_purposes enable row level security;

create policy giving_settings_public_read on public.giving_settings
  for select to anon, authenticated
  using (is_enabled = true);

create policy giving_settings_expression_manage on public.giving_settings
  for all to authenticated
  using (
    branch_id is not null
    and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  )
  with check (
    branch_id is not null
    and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );

create policy giving_purposes_public_read on public.giving_purposes
  for select to anon, authenticated
  using (status = 'active');

create policy giving_purposes_expression_manage on public.giving_purposes
  for all to authenticated
  using (
    branch_id is not null
    and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  )
  with check (
    branch_id is not null
    and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
  );

create trigger giving_settings_set_updated_at
before update on public.giving_settings
for each row execute function public.set_updated_at();

create trigger giving_purposes_set_updated_at
before update on public.giving_purposes
for each row execute function public.set_updated_at();

create trigger audit_giving_settings
after insert or update or delete on public.giving_settings
for each row execute function public.audit_row_change();

create trigger audit_giving_purposes
after insert or update or delete on public.giving_purposes
for each row execute function public.audit_row_change();

comment on table public.giving_settings is
  'Scope-specific giving availability and presentation. branch_id NULL is church-wide; branch_id set is expression-owned.';
comment on table public.giving_purposes is
  'Database-driven giving purposes/funds. No giving category is hardcoded in clients.';
comment on table public.organization_bank_accounts is
  'Currency-neutral manual transfer destinations. Multiple accounts per currency and scope are supported.';

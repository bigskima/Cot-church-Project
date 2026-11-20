-- Public Access, Scoped Giving Destinations, and Expression Bootstrap Architecture.

create table if not exists public.organization_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  bank_name text not null check (char_length(trim(bank_name)) between 1 and 120),
  account_name text not null check (char_length(trim(account_name)) between 1 and 160),
  account_number text not null check (char_length(trim(account_number)) between 3 and 64),
  routing_number text,
  currency char(3) not null default 'USD' check (currency = upper(currency)),
  transfer_instructions text not null default '',
  reference_prefix text default 'GIVE-',
  is_public boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, branch_id, currency),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade
);

alter table public.organization_bank_accounts enable row level security;

-- Public (guest/anon & member) read of explicit public payment instructions
create policy bank_accounts_public_read on public.organization_bank_accounts
  for select to anon, authenticated
  using (is_public = true);

create policy bank_accounts_manage on public.organization_bank_accounts
  for all to authenticated
  using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
  with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

-- Public read for active church giving campaigns
create policy campaigns_public_read on public.giving_campaigns
  for select to anon, authenticated
  using (status in ('active', 'completed'));

-- Bootstrap Expression function ensuring expression is never orphaned
create or replace function public.bootstrap_expression(
  target_organization_id uuid,
  expression_name text,
  expression_code text,
  leader_profile_id uuid default null,
  timezone_name text default 'UTC'
)
returns public.branches language plpgsql security definer set search_path = '' as $$
declare
  new_branch public.branches;
  operator_id uuid;
  admin_role_id uuid;
begin
  operator_id := coalesce(leader_profile_id, auth.uid());
  if operator_id is null then
    raise exception using errcode = '42501', message = 'Operator identity required';
  end if;

  if not (public.has_permission(target_organization_id, 'organizations.manage') or public.is_organization_member(target_organization_id)) then
    raise exception using errcode = '42501', message = 'Insufficient permission to bootstrap expression';
  end if;

  insert into public.branches (organization_id, name, code, timezone, is_active)
  values (target_organization_id, trim(expression_name), upper(trim(expression_code)), timezone_name, true)
  returning * into new_branch;

  -- Ensure leader has an active membership assigned to this branch
  insert into public.memberships (organization_id, branch_id, profile_id, status, joined_at)
  values (target_organization_id, new_branch.id, operator_id, 'active', current_date)
  on conflict (organization_id, profile_id) do update
  set branch_id = excluded.branch_id, status = 'active';

  -- Assign Expression Administrator role
  select id into admin_role_id from public.roles
  where organization_id = target_organization_id and (slug = 'admin' or name = 'Administrator') limit 1;

  if admin_role_id is not null then
    insert into public.role_assignments (organization_id, branch_id, profile_id, role_id, assigned_by)
    values (target_organization_id, new_branch.id, operator_id, admin_role_id, coalesce(auth.uid(), operator_id))
    on conflict do nothing;
  end if;

  return new_branch;
end;
$$;

grant execute on function public.bootstrap_expression(uuid, text, text, uuid, text) to authenticated;
create trigger audit_bank_accounts after insert or update or delete on public.organization_bank_accounts for each row execute function public.audit_row_change();

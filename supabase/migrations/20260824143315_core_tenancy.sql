-- Identity, organization, branch, and membership tenancy foundation.

create extension if not exists pgcrypto;

create type public.organization_status as enum ('active', 'suspended', 'archived');
create type public.membership_status as enum ('invited', 'active', 'inactive', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  phone_number text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_phone_number_key
  on public.profiles (phone_number)
  where phone_number is not null;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.organization_status not null default 'active',
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_branch_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 160),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  timezone text not null default 'UTC',
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id),
  foreign key (parent_branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.membership_status not null default 'invited',
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

create index branches_organization_id_idx on public.branches (organization_id);
create index memberships_profile_id_idx on public.memberships (profile_id);
create index memberships_organization_status_idx on public.memberships (organization_id, status);
create index memberships_branch_id_idx on public.memberships (branch_id) where branch_id is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger branches_set_updated_at before update on public.branches
for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone_number)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, new.phone, 'Member'), '@', 1)),
    new.phone
  );
  return new;
end;
$$;

create trigger auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_organization_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.memberships enable row level security;

create policy profiles_read_self on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_read_for_members on public.organizations
for select to authenticated using (public.is_organization_member(id));
create policy branches_read_for_members on public.branches
for select to authenticated using (public.is_organization_member(organization_id));
create policy memberships_read_self on public.memberships
for select to authenticated using (profile_id = auth.uid());

comment on table public.profiles is 'Application identity data separated from authentication and church membership.';
comment on table public.memberships is 'A person membership within an organization, optionally anchored to a branch.';

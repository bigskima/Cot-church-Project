-- Member-owned mute/block relationships.
-- Mute is one-way discovery filtering. Block is symmetric for signed-in interaction.

create table if not exists public.profile_safety_relationships (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('mute','block')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_profile_id,target_profile_id),
  check (owner_profile_id <> target_profile_id)
);

drop trigger if exists profile_safety_relationships_updated on public.profile_safety_relationships;
create trigger profile_safety_relationships_updated
before update on public.profile_safety_relationships
for each row execute function public.set_updated_at();

create index if not exists profile_safety_relationships_target_block_idx
on public.profile_safety_relationships(target_profile_id,owner_profile_id)
where mode='block';

alter table public.profile_safety_relationships enable row level security;

drop policy if exists profile_safety_relationships_no_client_access on public.profile_safety_relationships;
create policy profile_safety_relationships_no_client_access
on public.profile_safety_relationships
for all to anon, authenticated
using (false)
with check (false);

revoke all on table public.profile_safety_relationships from public, anon, authenticated;
grant select,insert,update,delete on table public.profile_safety_relationships to service_role;

comment on table public.profile_safety_relationships is
  'Private member safety preferences. Mute hides a target from the owner. Block also prevents signed-in interaction in either direction.';

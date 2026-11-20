-- Public/general prayer petition support.
-- A prayer request may come from an Expression member, an authenticated account
-- without church membership, or a visitor. Private identity is never required for
-- the public wall and is never exposed by the public API.

alter table public.prayer_requests
  alter column membership_id drop not null;

alter table public.prayer_requests
  add column if not exists submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists is_anonymous boolean not null default false;

create index if not exists prayer_requests_submitter_idx
  on public.prayer_requests(submitted_by_profile_id, created_at desc)
  where submitted_by_profile_id is not null;

create index if not exists prayer_requests_public_wall_idx
  on public.prayer_requests(organization_id, visibility, status, created_at desc);

create or replace function public.protect_prayer_request_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.membership_id is distinct from old.membership_id
     or new.submitted_by_profile_id is distinct from old.submitted_by_profile_id then
    raise exception using errcode = '23514', message = 'Prayer request ownership cannot be changed';
  end if;
  return new;
end;
$$;

-- Authenticated account holders retain ownership even when they have not joined an
-- Expression. Guest submissions are managed through the trusted Edge API only.
drop policy if exists prayer_owner_all on public.prayer_requests;
create policy prayer_owner_all on public.prayer_requests
  for all to authenticated
  using (
    submitted_by_profile_id = auth.uid()
    or exists (
      select 1
      from public.memberships m
      where m.id = membership_id
        and m.profile_id = auth.uid()
    )
  )
  with check (
    submitted_by_profile_id = auth.uid()
    or exists (
      select 1
      from public.memberships m
      where m.id = membership_id
        and m.profile_id = auth.uid()
    )
  );

-- Moderators must be able to read confidential pastoral petitions as well as
-- prayer-team/public-wall submissions. Public access remains Edge-API filtered.
drop policy if exists prayer_team_read on public.prayer_requests;
create policy prayer_team_read on public.prayer_requests
  for select to authenticated
  using (public.has_permission(organization_id, 'prayer.moderate', branch_id));

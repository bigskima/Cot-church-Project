-- Departments, ministries, groups, and privacy-sensitive prayer workflows.

create type public.group_membership_status as enum ('requested', 'active', 'declined', 'removed');
create type public.prayer_request_status as enum ('submitted', 'in_review', 'praying', 'answered', 'closed');
create type public.prayer_visibility as enum ('private', 'prayer_team', 'organization');

alter table public.permissions drop constraint if exists permissions_code_check;
alter table public.permissions add constraint permissions_code_check check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');

insert into public.permissions (code, name, description, category) values
  ('units.read', 'View ministries and departments', 'View organization units.', 'operations'),
  ('units.manage', 'Manage ministries and departments', 'Create and update organization units.', 'operations'),
  ('groups.read', 'View groups', 'Discover and view groups.', 'groups'),
  ('groups.manage', 'Manage groups', 'Create and administer groups.', 'groups'),
  ('groups.members.manage', 'Manage group members', 'Approve and remove group memberships.', 'groups'),
  ('prayer.moderate', 'Moderate prayer requests', 'Review organization and team prayer requests.', 'prayer')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_active = true;

create table public.departments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid, name text not null check (char_length(trim(name)) between 1 and 160), description text not null default '',
  leader_membership_id uuid, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, name), unique (id, organization_id),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
  foreign key (leader_membership_id, organization_id) references public.memberships(id, organization_id) on delete restrict
);

create table public.ministries (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid, branch_id uuid, name text not null check (char_length(trim(name)) between 1 and 160), description text not null default '',
  leader_membership_id uuid, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, name), unique (id, organization_id),
  foreign key (department_id, organization_id) references public.departments(id, organization_id) on delete restrict,
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
  foreign key (leader_membership_id, organization_id) references public.memberships(id, organization_id) on delete restrict
);

create table public.groups (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid, ministry_id uuid, name text not null check (char_length(trim(name)) between 1 and 160), description text not null default '',
  visibility text not null default 'members' check (visibility in ('members', 'private')), capacity integer check (capacity is null or capacity > 0),
  meeting_schedule jsonb not null default '{}'::jsonb check (jsonb_typeof(meeting_schedule) = 'object'), is_active boolean not null default true,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id), foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
  foreign key (ministry_id, organization_id) references public.ministries(id, organization_id) on delete restrict
);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null, membership_id uuid not null, status public.group_membership_status not null default 'requested',
  is_leader boolean not null default false, requested_at timestamptz not null default now(), responded_at timestamptz,
  unique (group_id, membership_id), foreign key (group_id, organization_id) references public.groups(id, organization_id) on delete cascade,
  foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade
);

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid, membership_id uuid not null, title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 5000), visibility public.prayer_visibility not null default 'private',
  status public.prayer_request_status not null default 'submitted', answered_testimony text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id), foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
  foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade
);

create index groups_discovery_idx on public.groups (organization_id, branch_id, is_active);
create index group_memberships_member_idx on public.group_memberships (membership_id, status);
create index prayer_requests_owner_idx on public.prayer_requests (membership_id, created_at desc);
create index prayer_requests_moderation_idx on public.prayer_requests (organization_id, status, created_at desc);
create trigger departments_updated before update on public.departments for each row execute function public.set_updated_at();
create trigger ministries_updated before update on public.ministries for each row execute function public.set_updated_at();
create trigger groups_updated before update on public.groups for each row execute function public.set_updated_at();
create trigger prayer_requests_updated before update on public.prayer_requests for each row execute function public.set_updated_at();
create function public.protect_prayer_request_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id <> old.organization_id or new.membership_id <> old.membership_id then
    raise exception using errcode = '23514', message = 'Prayer request ownership cannot be changed';
  end if;
  return new;
end; $$;
create trigger prayer_requests_protect_identity before update on public.prayer_requests for each row execute function public.protect_prayer_request_identity();

alter table public.departments enable row level security; alter table public.ministries enable row level security;
alter table public.groups enable row level security; alter table public.group_memberships enable row level security; alter table public.prayer_requests enable row level security;
create policy departments_read on public.departments for select to authenticated using (public.is_organization_member(organization_id));
create policy departments_manage on public.departments for all to authenticated using (public.has_permission(organization_id, 'units.manage', branch_id)) with check (public.has_permission(organization_id, 'units.manage', branch_id));
create policy ministries_read on public.ministries for select to authenticated using (public.is_organization_member(organization_id));
create policy ministries_manage on public.ministries for all to authenticated using (public.has_permission(organization_id, 'units.manage', branch_id)) with check (public.has_permission(organization_id, 'units.manage', branch_id));
create policy groups_discover on public.groups for select to authenticated using (public.is_organization_member(organization_id) and (visibility = 'members' or public.has_permission(organization_id, 'groups.manage', branch_id)));
create policy groups_manage on public.groups for all to authenticated using (public.has_permission(organization_id, 'groups.manage', branch_id)) with check (public.has_permission(organization_id, 'groups.manage', branch_id));
create policy group_memberships_self on public.group_memberships for select to authenticated using (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()));
create policy group_memberships_manage on public.group_memberships for select to authenticated using (public.has_permission(organization_id, 'groups.members.manage'));
create policy prayer_owner_all on public.prayer_requests for all to authenticated using (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid())) with check (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()));
create policy prayer_team_read on public.prayer_requests for select to authenticated using (visibility <> 'private' and public.has_permission(organization_id, 'prayer.moderate', branch_id));
create policy prayer_moderate_update on public.prayer_requests for update to authenticated using (public.has_permission(organization_id, 'prayer.moderate', branch_id)) with check (public.has_permission(organization_id, 'prayer.moderate', branch_id));

create function public.request_group_membership(target_group_id uuid)
returns public.group_memberships language plpgsql security definer set search_path = '' as $$
declare selected_group public.groups; member public.memberships; result public.group_memberships; active_count integer;
begin
  select * into selected_group from public.groups where id = target_group_id and is_active for update;
  if not found then raise exception using errcode = 'P0002', message = 'Group not found'; end if;
  select * into member from public.memberships where organization_id = selected_group.organization_id and profile_id = auth.uid() and status = 'active';
  if not found then raise exception using errcode = '42501', message = 'Active membership required'; end if;
  select count(*) into active_count from public.group_memberships where group_id = target_group_id and status = 'active';
  if selected_group.capacity is not null and active_count >= selected_group.capacity then raise exception using errcode = '23514', message = 'Group is full'; end if;
  insert into public.group_memberships (organization_id, group_id, membership_id) values (selected_group.organization_id, target_group_id, member.id)
  on conflict (group_id, membership_id) do update set status = 'requested', requested_at = now(), responded_at = null returning * into result;
  return result;
end; $$;

create function public.review_group_membership(target_group_membership_id uuid, approved boolean)
returns public.group_memberships language plpgsql security definer set search_path = '' as $$
declare result public.group_memberships; group_branch uuid;
begin
  select g.branch_id into group_branch from public.group_memberships gm join public.groups g on g.id = gm.group_id where gm.id = target_group_membership_id;
  if not found then raise exception using errcode = 'P0002', message = 'Request not found'; end if;
  if not public.has_permission((select organization_id from public.group_memberships where id = target_group_membership_id), 'groups.members.manage', group_branch) then raise exception using errcode = '42501', message = 'Permission denied'; end if;
  update public.group_memberships set status = case when approved then 'active' else 'declined' end, responded_at = now() where id = target_group_membership_id returning * into result;
  return result;
end; $$;

revoke all on function public.request_group_membership(uuid) from public; revoke all on function public.review_group_membership(uuid, boolean) from public;
grant execute on function public.request_group_membership(uuid) to authenticated; grant execute on function public.review_group_membership(uuid, boolean) to authenticated;
create trigger audit_departments after insert or update or delete on public.departments for each row execute function public.audit_row_change();
create trigger audit_ministries after insert or update or delete on public.ministries for each row execute function public.audit_row_change();
create trigger audit_groups after insert or update or delete on public.groups for each row execute function public.audit_row_change();
create trigger audit_group_memberships after insert or update or delete on public.group_memberships for each row execute function public.audit_row_change();
create function public.audit_prayer_metadata() returns trigger language plpgsql security definer set search_path = '' as $$
declare source_row public.prayer_requests;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_log (organization_id, branch_id, actor_profile_id, action, target_type, target_id, old_values, new_values)
  values (source_row.organization_id, source_row.branch_id, auth.uid(), lower(tg_op), 'prayer_requests', source_row.id::text,
    case when tg_op in ('UPDATE', 'DELETE') then jsonb_build_object('status', old.status, 'visibility', old.visibility) end,
    case when tg_op in ('INSERT', 'UPDATE') then jsonb_build_object('status', new.status, 'visibility', new.visibility) end);
  if tg_op = 'DELETE' then return old; end if; return new;
end; $$;
revoke all on function public.audit_prayer_metadata() from public;
create trigger audit_prayer_requests after insert or update or delete on public.prayer_requests for each row execute function public.audit_prayer_metadata();

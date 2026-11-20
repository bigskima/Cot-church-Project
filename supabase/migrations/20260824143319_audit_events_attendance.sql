-- Immutable audit trail plus event, registration, occurrence, and attendance domains.

create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed', 'archived');
create type public.registration_status as enum ('registered', 'waitlisted', 'cancelled', 'attended');

insert into public.permissions (code, name, description, category) values
  ('events.read', 'View events', 'View organization events.', 'events'),
  ('events.create', 'Create events', 'Create events and occurrences.', 'events'),
  ('events.update', 'Update events', 'Update, publish, cancel, and archive events.', 'events'),
  ('attendance.manage', 'Manage attendance', 'Open attendance and check members in.', 'attendance'),
  ('attendance.read', 'View attendance', 'View attendance records and summaries.', 'attendance')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_active = true;

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  branch_id uuid,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  request_id text,
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict
);
create index audit_log_tenant_time_idx on public.audit_log (organization_id, occurred_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);
alter table public.audit_log enable row level security;
create policy audit_read_authorized on public.audit_log for select to authenticated
using (public.has_permission(organization_id, 'audit.read', branch_id));

create function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare before_row jsonb; after_row jsonb; tenant_id uuid; scoped_branch_id uuid; row_id text;
begin
  before_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  tenant_id := coalesce((after_row ->> 'organization_id')::uuid, (before_row ->> 'organization_id')::uuid,
    case when tg_table_name = 'organizations' then coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid) end);
  scoped_branch_id := coalesce((after_row ->> 'branch_id')::uuid, (before_row ->> 'branch_id')::uuid);
  row_id := coalesce(after_row ->> 'id', before_row ->> 'id');
  insert into public.audit_log (organization_id, branch_id, actor_profile_id, action, target_type, target_id, request_id, old_values, new_values)
  values (tenant_id, scoped_branch_id, auth.uid(), lower(tg_op), tg_table_name, row_id,
    nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-request-id', ''), before_row, after_row);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_row_change() from public;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null default '',
  status public.event_status not null default 'draft',
  visibility text not null default 'members' check (visibility in ('members', 'public', 'private')),
  location jsonb not null default '{}'::jsonb check (jsonb_typeof(location) = 'object'),
  timezone text not null default 'UTC',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  recurrence_rule jsonb check (recurrence_rule is null or jsonb_typeof(recurrence_rule) = 'object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
  check (ends_at > starts_at),
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at > registration_opens_at)
);
create index events_tenant_start_idx on public.events (organization_id, starts_at desc);
create index events_branch_start_idx on public.events (branch_id, starts_at desc) where branch_id is not null;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger events_validate_timezone before insert or update of timezone on public.events for each row execute function public.validate_timezone();

create table public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status public.event_status not null default 'published',
  created_at timestamptz not null default now(),
  unique (event_id, starts_at), unique (id, organization_id), unique (id, event_id, organization_id),
  foreign key (event_id, organization_id) references public.events(id, organization_id) on delete cascade,
  check (ends_at > starts_at)
);
create index event_occurrences_tenant_start_idx on public.event_occurrences (organization_id, starts_at);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null,
  occurrence_id uuid,
  membership_id uuid not null,
  status public.registration_status not null default 'registered',
  registered_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (event_id, organization_id) references public.events(id, organization_id) on delete cascade,
  foreign key (occurrence_id, event_id, organization_id) references public.event_occurrences(id, event_id, organization_id) on delete cascade,
  foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade,
  unique nulls not distinct (event_id, occurrence_id, membership_id)
);
create index event_registrations_event_status_idx on public.event_registrations (event_id, occurrence_id, status);
create trigger event_registrations_set_updated_at before update on public.event_registrations for each row execute function public.set_updated_at();

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null, occurrence_id uuid, membership_id uuid not null, checked_in_at timestamptz not null default now(),
  checked_in_by uuid not null references public.profiles(id), notes text not null default '', created_at timestamptz not null default now(),
  foreign key (event_id, organization_id) references public.events(id, organization_id) on delete cascade,
  foreign key (occurrence_id, event_id, organization_id) references public.event_occurrences(id, event_id, organization_id) on delete cascade,
  foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade,
  unique nulls not distinct (event_id, occurrence_id, membership_id)
);
create index attendance_event_idx on public.attendance_records (event_id, occurrence_id, checked_in_at);

alter table public.events enable row level security;
alter table public.event_occurrences enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance_records enable row level security;
create policy events_member_read on public.events for select to authenticated using (public.is_organization_member(organization_id) and status <> 'draft');
create policy events_admin_read on public.events for select to authenticated using (public.has_permission(organization_id, 'events.read', branch_id));
create policy events_admin_insert on public.events for insert to authenticated with check (created_by = auth.uid() and public.has_permission(organization_id, 'events.create', branch_id));
create policy events_admin_update on public.events for update to authenticated using (public.has_permission(organization_id, 'events.update', branch_id)) with check (public.has_permission(organization_id, 'events.update', branch_id));
create policy occurrences_member_read on public.event_occurrences for select to authenticated using (public.is_organization_member(organization_id));
create policy occurrences_admin_write on public.event_occurrences for all to authenticated using (public.has_permission(organization_id, 'events.update')) with check (public.has_permission(organization_id, 'events.update'));
create policy registrations_self_read on public.event_registrations for select to authenticated using (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()));
create policy registrations_admin_read on public.event_registrations for select to authenticated using (public.has_permission(organization_id, 'attendance.read'));
create policy attendance_self_read on public.attendance_records for select to authenticated using (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()));
create policy attendance_admin_read on public.attendance_records for select to authenticated using (public.has_permission(organization_id, 'attendance.read'));

create function public.register_for_event(target_event_id uuid, target_occurrence_id uuid default null)
returns public.event_registrations language plpgsql security definer set search_path = '' as $$
declare selected_event public.events; member public.memberships; registration public.event_registrations; registered_count integer; selected_status public.registration_status;
begin
  select * into selected_event from public.events where id = target_event_id and status = 'published' for update;
  if not found then raise exception using errcode = 'P0002', message = 'Event not found'; end if;
  select * into member from public.memberships where organization_id = selected_event.organization_id and profile_id = auth.uid() and status = 'active';
  if not found then raise exception using errcode = '42501', message = 'Active membership required'; end if;
  if selected_event.registration_opens_at is not null and now() < selected_event.registration_opens_at then raise exception using errcode = '22023', message = 'Registration is not open'; end if;
  if selected_event.registration_closes_at is not null and now() > selected_event.registration_closes_at then raise exception using errcode = '22023', message = 'Registration is closed'; end if;
  select count(*) into registered_count from public.event_registrations where event_id = target_event_id and occurrence_id is not distinct from target_occurrence_id and status in ('registered', 'attended');
  selected_status := case when selected_event.capacity is not null and registered_count >= selected_event.capacity then 'waitlisted' else 'registered' end;
  insert into public.event_registrations (organization_id, event_id, occurrence_id, membership_id, status)
  values (selected_event.organization_id, target_event_id, target_occurrence_id, member.id, selected_status)
  on conflict (event_id, occurrence_id, membership_id) do update
    set status = case when public.event_registrations.status = 'attended' then 'attended'::public.registration_status else excluded.status end,
        registered_at = case when public.event_registrations.status = 'attended' then public.event_registrations.registered_at else now() end
  returning * into registration;
  return registration;
end;
$$;

create function public.check_in_member(target_event_id uuid, target_occurrence_id uuid, target_membership_id uuid, check_in_notes text default '')
returns public.attendance_records language plpgsql security definer set search_path = '' as $$
declare selected_event public.events; attendance public.attendance_records;
begin
  select * into selected_event from public.events where id = target_event_id;
  if not found then raise exception using errcode = 'P0002', message = 'Event not found'; end if;
  if not public.has_permission(selected_event.organization_id, 'attendance.manage', selected_event.branch_id) then raise exception using errcode = '42501', message = 'Permission denied'; end if;
  insert into public.attendance_records (organization_id, event_id, occurrence_id, membership_id, checked_in_by, notes)
  values (selected_event.organization_id, target_event_id, target_occurrence_id, target_membership_id, auth.uid(), left(coalesce(check_in_notes, ''), 500))
  on conflict (event_id, occurrence_id, membership_id) do update set checked_in_at = now(), checked_in_by = auth.uid(), notes = excluded.notes
  returning * into attendance;
  update public.event_registrations set status = 'attended' where event_id = target_event_id and occurrence_id is not distinct from target_occurrence_id and membership_id = target_membership_id;
  return attendance;
end;
$$;

revoke all on function public.register_for_event(uuid, uuid) from public;
revoke all on function public.check_in_member(uuid, uuid, uuid, text) from public;
grant execute on function public.register_for_event(uuid, uuid) to authenticated;
grant execute on function public.check_in_member(uuid, uuid, uuid, text) to authenticated;

create trigger audit_organizations after insert or update or delete on public.organizations for each row execute function public.audit_row_change();
create trigger audit_branches after insert or update or delete on public.branches for each row execute function public.audit_row_change();
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function public.audit_row_change();
create trigger audit_roles after insert or update or delete on public.roles for each row execute function public.audit_row_change();
create trigger audit_role_assignments after insert or update or delete on public.role_assignments for each row execute function public.audit_row_change();
create trigger audit_events after insert or update or delete on public.events for each row execute function public.audit_row_change();
create trigger audit_registrations after insert or update or delete on public.event_registrations for each row execute function public.audit_row_change();
create trigger audit_attendance after insert or update or delete on public.attendance_records for each row execute function public.audit_row_change();

-- Complete the public/Expression event boundary and registration lifecycle.

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
for select to anon, authenticated
using (status = 'published' and visibility = 'public');

drop policy if exists events_member_read on public.events;
create policy events_member_read on public.events
for select to authenticated
using (
  status <> 'draft'
  and visibility = 'members'
  and public.is_organization_member(organization_id)
  and (branch_id is null or public.is_expression_member(organization_id, branch_id))
);

drop policy if exists occurrences_member_read on public.event_occurrences;
create policy occurrences_member_read on public.event_occurrences
for select to authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_occurrences.event_id
      and event.organization_id = event_occurrences.organization_id
  )
);

create or replace function public.register_for_event(
  target_event_id uuid,
  target_occurrence_id uuid default null
)
returns public.event_registrations
language plpgsql security definer set search_path = '' as $$
declare
  selected_event public.events;
  selected_occurrence public.event_occurrences;
  member public.memberships;
  registration public.event_registrations;
  registered_count integer;
  selected_status public.registration_status;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into selected_event
  from public.events
  where id = target_event_id and status = 'published'
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Event not found'; end if;

  if selected_event.visibility = 'private' then
    raise exception using errcode = '42501', message = 'This event does not accept public registration';
  end if;
  if selected_event.branch_id is not null
    and selected_event.visibility <> 'public'
    and not public.is_expression_member(selected_event.organization_id, selected_event.branch_id) then
    raise exception using errcode = '42501', message = 'Active Expression membership required';
  end if;

  select * into member
  from public.memberships
  where organization_id = selected_event.organization_id
    and profile_id = auth.uid()
    and status = 'active';
  if not found then raise exception using errcode = '42501', message = 'Active church membership required'; end if;

  if target_occurrence_id is not null then
    select * into selected_occurrence
    from public.event_occurrences
    where id = target_occurrence_id
      and event_id = target_event_id
      and organization_id = selected_event.organization_id
      and status = 'published';
    if not found then raise exception using errcode = 'P0002', message = 'Event occurrence not found'; end if;
  end if;

  if selected_event.ends_at <= now() then raise exception using errcode = '22023', message = 'This event has ended'; end if;
  if selected_event.registration_opens_at is not null and now() < selected_event.registration_opens_at then raise exception using errcode = '22023', message = 'Registration is not open'; end if;
  if selected_event.registration_closes_at is not null and now() > selected_event.registration_closes_at then raise exception using errcode = '22023', message = 'Registration is closed'; end if;

  select count(*) into registered_count
  from public.event_registrations
  where event_id = target_event_id
    and occurrence_id is not distinct from target_occurrence_id
    and status in ('registered', 'attended');
  selected_status := case
    when selected_event.capacity is not null and registered_count >= selected_event.capacity then 'waitlisted'
    else 'registered'
  end;

  insert into public.event_registrations (organization_id, event_id, occurrence_id, membership_id, status)
  values (selected_event.organization_id, target_event_id, target_occurrence_id, member.id, selected_status)
  on conflict (event_id, occurrence_id, membership_id) do update
    set status = case
      when public.event_registrations.status = 'attended' then 'attended'::public.registration_status
      else excluded.status
    end,
    registered_at = case
      when public.event_registrations.status = 'attended' then public.event_registrations.registered_at
      else now()
    end
  returning * into registration;
  return registration;
end;
$$;

create function public.cancel_event_registration(
  target_event_id uuid,
  target_occurrence_id uuid default null
)
returns public.event_registrations
language plpgsql security definer set search_path = '' as $$
declare registration public.event_registrations;
begin
  update public.event_registrations er
  set status = 'cancelled'
  from public.memberships membership
  where er.event_id = target_event_id
    and er.occurrence_id is not distinct from target_occurrence_id
    and er.membership_id = membership.id
    and membership.profile_id = auth.uid()
    and er.status in ('registered', 'waitlisted')
  returning er.* into registration;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active event registration not found';
  end if;
  return registration;
end;
$$;

revoke all on function public.cancel_event_registration(uuid, uuid) from public;
grant execute on function public.cancel_event_registration(uuid, uuid) to authenticated;

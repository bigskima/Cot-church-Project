-- Winner selection and fulfillment must go through audited host workflows.
-- Direct Data API writes to giveaway_winners are removed so a host cannot bypass
-- entry eligibility, configured winner counts, closing time, or selection status.

create or replace function private.protect_giveaway_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id
     or new.branch_id is distinct from old.branch_id
     or new.host_profile_id is distinct from old.host_profile_id then
    raise exception using errcode = '23514', message = 'Giveaway scope and host cannot be changed after creation';
  end if;
  return new;
end;
$function$;

revoke all on function private.protect_giveaway_identity() from public, anon, authenticated;

drop trigger if exists protect_giveaway_identity on public.giveaways;
create trigger protect_giveaway_identity
before update of organization_id, branch_id, host_profile_id
on public.giveaways
for each row execute function private.protect_giveaway_identity();

-- Hosts may edit/cancel/archive their giveaway, but drawing/completion are reserved
-- for the controlled draw RPC below.
drop policy if exists giveaways_host_update on public.giveaways;
create policy giveaways_host_update on public.giveaways
for update to authenticated
using (host_profile_id = auth.uid())
with check (
  host_profile_id = auth.uid()
  and status not in ('drawing', 'completed')
  and (
    (branch_id is null and (
      visibility = 'public'
      or public.is_organization_member(organization_id)
    ))
    or (
      branch_id is not null
      and public.is_expression_member(organization_id, branch_id)
    )
  )
);

-- Selection is RPC-only. The SELECT policy remains so permitted feed readers can
-- see the recorded winner after the draw completes.
drop policy if exists giveaway_winners_host on public.giveaway_winners;
revoke insert, update, delete on public.giveaway_winners from authenticated;

create or replace function public.draw_community_giveaway(target_giveaway_id uuid)
returns table(profile_id uuid, display_name text, avatar_url text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  selected_giveaway public.giveaways%rowtype;
  entry_total bigint;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;

  select * into selected_giveaway
  from public.giveaways g
  where g.id = target_giveaway_id
  for update;

  if selected_giveaway.id is null then
    raise exception using errcode = 'P0002', message = 'Giveaway not found';
  end if;
  if selected_giveaway.host_profile_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the giveaway host can draw winners';
  end if;
  if selected_giveaway.status not in ('open', 'drawing') then
    raise exception using errcode = '22023', message = 'This giveaway cannot be drawn';
  end if;
  if selected_giveaway.opens_at is not null and selected_giveaway.opens_at > now() then
    raise exception using errcode = '22023', message = 'This giveaway has not opened yet';
  end if;
  if selected_giveaway.closes_at is not null and selected_giveaway.closes_at > now() then
    raise exception using errcode = '22023', message = 'The giveaway is still open';
  end if;

  select count(*) into entry_total
  from public.giveaway_entries e
  where e.giveaway_id = target_giveaway_id;

  if entry_total < 1 then
    raise exception using errcode = '22023', message = 'No eligible entries yet';
  end if;

  update public.giveaways
  set status = 'drawing'
  where id = target_giveaway_id;

  delete from public.giveaway_winners
  where giveaway_id = target_giveaway_id;

  insert into public.giveaway_winners(giveaway_id, profile_id, selected_by)
  select target_giveaway_id, e.profile_id, auth.uid()
  from public.giveaway_entries e
  where e.giveaway_id = target_giveaway_id
  order by random()
  limit least(selected_giveaway.winners_count, entry_total::integer);

  update public.giveaways
  set status = 'completed'
  where id = target_giveaway_id;

  return query
  select w.profile_id, p.display_name, p.avatar_url
  from public.giveaway_winners w
  join public.profiles p on p.id = w.profile_id
  where w.giveaway_id = target_giveaway_id
  order by w.selected_at;
end;
$function$;

revoke all on function public.draw_community_giveaway(uuid) from public, anon, authenticated;
grant execute on function public.draw_community_giveaway(uuid) to authenticated;

create or replace function public.mark_giveaway_winner_fulfilled(
  target_giveaway_id uuid,
  target_profile_id uuid,
  fulfillment_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  selected_giveaway public.giveaways%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;

  select * into selected_giveaway
  from public.giveaways g
  where g.id = target_giveaway_id;

  if selected_giveaway.id is null then
    raise exception using errcode = 'P0002', message = 'Giveaway not found';
  end if;
  if selected_giveaway.host_profile_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the giveaway host can confirm prize fulfillment';
  end if;
  if selected_giveaway.status <> 'completed' then
    raise exception using errcode = '22023', message = 'Winners must be selected before fulfillment can be recorded';
  end if;

  update public.giveaway_winners w
  set fulfilled_at = coalesce(w.fulfilled_at, now()),
      gift_note = left(coalesce(fulfillment_note, ''), 1000)
  where w.giveaway_id = target_giveaway_id
    and w.profile_id = target_profile_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Selected winner was not found';
  end if;
end;
$function$;

revoke all on function public.mark_giveaway_winner_fulfilled(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_giveaway_winner_fulfilled(uuid, uuid, text) to authenticated;

comment on function public.draw_community_giveaway(uuid) is
  'Host-only winner draw. Selection is limited to actual entrants and the configured winner count.';
comment on function public.mark_giveaway_winner_fulfilled(uuid, uuid, text) is
  'Host-only manual prize fulfillment confirmation for a previously selected winner.';

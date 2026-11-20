-- General COT is a public participation surface: signed-in accounts can enter
-- public polls and host/enter public giveaways without formal organization
-- membership. Expression participation remains membership-scoped.

drop policy if exists poll_votes_own on public.poll_votes;
create policy poll_votes_own on public.poll_votes for all to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid() and exists(
    select 1 from public.polls p
    where p.id = poll_id
      and p.status = 'open'
      and (p.closes_at is null or p.closes_at > now())
      and (
        (p.branch_id is null and (p.visibility = 'public' or public.is_organization_member(p.organization_id)))
        or (p.branch_id is not null and public.is_expression_member(p.organization_id, p.branch_id))
      )
  )
);

drop policy if exists giveaways_create on public.giveaways;
create policy giveaways_create on public.giveaways for insert to authenticated with check (
  host_profile_id = auth.uid()
  and (
    (branch_id is null and visibility = 'public' and exists(
      select 1 from public.organizations o where o.id = organization_id and o.status = 'active'
    ))
    or (branch_id is null and public.is_organization_member(organization_id))
    or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
  )
);

drop policy if exists giveaway_entries_own on public.giveaway_entries;
create policy giveaway_entries_own on public.giveaway_entries for insert to authenticated with check (
  profile_id = auth.uid() and exists(
    select 1 from public.giveaways g
    where g.id = giveaway_id
      and g.status = 'open'
      and (g.opens_at is null or g.opens_at <= now())
      and (g.closes_at is null or g.closes_at > now())
      and (
        (g.branch_id is null and (g.visibility = 'public' or public.is_organization_member(g.organization_id)))
        or (g.branch_id is not null and public.is_expression_member(g.organization_id, g.branch_id))
      )
  )
);

create or replace function public.vote_community_poll(
  target_poll_id uuid,
  target_option_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  selected_poll public.polls%rowtype;
  option_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in to vote'; end if;
  select * into selected_poll from public.polls p where p.id = target_poll_id for update;
  if selected_poll.id is null then raise exception using errcode = 'P0002', message = 'Poll not found'; end if;
  if selected_poll.status <> 'open' or (selected_poll.closes_at is not null and selected_poll.closes_at <= now()) then
    raise exception using errcode = '22023', message = 'This poll is closed';
  end if;
  if selected_poll.branch_id is null then
    if selected_poll.visibility <> 'public' and not public.is_organization_member(selected_poll.organization_id) then
      raise exception using errcode = '42501', message = 'Church membership required to vote in this poll';
    end if;
  elsif not public.is_expression_member(selected_poll.organization_id, selected_poll.branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required to vote';
  end if;
  if coalesce(cardinality(target_option_ids), 0) < 1 then raise exception using errcode = '22023', message = 'Choose at least one option'; end if;
  if not selected_poll.allows_multiple and cardinality(target_option_ids) <> 1 then raise exception using errcode = '22023', message = 'Choose one option for this poll'; end if;
  if cardinality(target_option_ids) > 12 then raise exception using errcode = '22023', message = 'Too many poll options selected'; end if;
  if exists (
    select 1 from unnest(target_option_ids) requested(id)
    where not exists(select 1 from public.poll_options o where o.poll_id = target_poll_id and o.id = requested.id)
  ) then raise exception using errcode = '22023', message = 'One or more selected options are invalid'; end if;

  delete from public.poll_votes where poll_id = target_poll_id and profile_id = auth.uid();
  foreach option_id in array target_option_ids loop
    insert into public.poll_votes(poll_id, option_id, profile_id)
    values (target_poll_id, option_id, auth.uid());
  end loop;
end;
$function$;

grant execute on function public.vote_community_poll(uuid, uuid[]) to authenticated;

create or replace function public.create_community_giveaway(
  target_organization_id uuid,
  target_branch_id uuid,
  giveaway_title text,
  giveaway_description text,
  prize text,
  number_of_winners integer default 1,
  open_at timestamptz default null,
  close_at timestamptz default null,
  giveaway_visibility text default 'members'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  created_id uuid;
  resolved_visibility text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in to host a giveaway'; end if;
  if not exists(select 1 from public.organizations o where o.id = target_organization_id and o.status = 'active') then
    raise exception using errcode = 'P0002', message = 'Church organization not found';
  end if;

  if target_branch_id is not null then
    if not public.is_expression_member(target_organization_id, target_branch_id) then
      raise exception using errcode = '42501', message = 'Expression membership required';
    end if;
    resolved_visibility := 'members';
  else
    resolved_visibility := case when giveaway_visibility = 'members' then 'members' else 'public' end;
    if resolved_visibility = 'members' and not public.is_organization_member(target_organization_id) then
      raise exception using errcode = '42501', message = 'Church membership required for a members-only giveaway';
    end if;
  end if;

  if nullif(btrim(giveaway_title), '') is null or nullif(btrim(prize), '') is null then
    raise exception using errcode = '22023', message = 'Giveaway title and prize are required';
  end if;
  if number_of_winners < 1 or number_of_winners > 100 then raise exception using errcode = '22023', message = 'Winners count must be between 1 and 100'; end if;
  if close_at is not null and close_at <= coalesce(open_at, now()) then raise exception using errcode = '22023', message = 'Giveaway closing time must be after opening time'; end if;

  insert into public.giveaways(
    organization_id, branch_id, host_profile_id, title, description,
    prize_description, status, visibility, winners_count, opens_at, closes_at
  ) values (
    target_organization_id, target_branch_id, auth.uid(), btrim(giveaway_title),
    coalesce(btrim(giveaway_description), ''), btrim(prize),
    case when open_at is not null and open_at > now() then 'draft' else 'open' end,
    resolved_visibility, number_of_winners, open_at, close_at
  ) returning id into created_id;
  return created_id;
end;
$function$;

grant execute on function public.create_community_giveaway(uuid, uuid, text, text, text, integer, timestamptz, timestamptz, text) to authenticated;

create or replace function public.enter_community_giveaway(target_giveaway_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  selected_giveaway public.giveaways%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in to enter'; end if;
  select * into selected_giveaway from public.giveaways g where g.id = target_giveaway_id;
  if selected_giveaway.id is null then raise exception using errcode = 'P0002', message = 'Giveaway not found'; end if;
  if selected_giveaway.status <> 'open'
    or (selected_giveaway.opens_at is not null and selected_giveaway.opens_at > now())
    or (selected_giveaway.closes_at is not null and selected_giveaway.closes_at <= now()) then
    raise exception using errcode = '22023', message = 'This giveaway is not accepting entries';
  end if;
  if selected_giveaway.branch_id is null then
    if selected_giveaway.visibility <> 'public' and not public.is_organization_member(selected_giveaway.organization_id) then
      raise exception using errcode = '42501', message = 'Church membership required to enter this giveaway';
    end if;
  elsif not public.is_expression_member(selected_giveaway.organization_id, selected_giveaway.branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required';
  end if;

  insert into public.giveaway_entries(giveaway_id, profile_id)
  values (target_giveaway_id, auth.uid())
  on conflict (giveaway_id, profile_id) do nothing;
end;
$function$;

grant execute on function public.enter_community_giveaway(uuid) to authenticated;

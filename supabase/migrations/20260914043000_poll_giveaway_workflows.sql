-- Harden and expose database-driven community participation workflows.
-- Poll creation remains permission-gated. Giveaways may be hosted by any active
-- member in the selected General COT / Expression scope. No Edge Function is
-- required for these transactional participation actions.

-- Draft/cancelled participation records must not leak to ordinary readers.
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select using (
  (
    status in ('open','closed')
    and (
      (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
      or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
    )
  )
  or author_profile_id = auth.uid()
  or public.has_permission(organization_id, 'polls.manage', branch_id)
);

drop policy if exists giveaways_read on public.giveaways;
create policy giveaways_read on public.giveaways for select using (
  (
    status in ('open','drawing','completed')
    and (
      (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
      or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
    )
  )
  or host_profile_id = auth.uid()
);

-- Entrant identity is visible only to the entrant and the giveaway host.
drop policy if exists giveaway_entries_read on public.giveaway_entries;
create policy giveaway_entries_read on public.giveaway_entries for select to authenticated using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.giveaways g
    where g.id = giveaway_id and g.host_profile_id = auth.uid()
  )
);

create or replace function public.community_poll_feed(
  target_organization_id uuid,
  target_branch_id uuid default null
)
returns table(
  id uuid,
  question text,
  description text,
  status text,
  allows_multiple boolean,
  closes_at timestamptz,
  created_at timestamptz,
  author_profile_id uuid,
  options jsonb,
  viewer_has_voted boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    p.id,
    p.question,
    p.description,
    p.status,
    p.allows_multiple,
    p.closes_at,
    p.created_at,
    p.author_profile_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'displayOrder', o.display_order,
          'votes', (select count(*) from public.poll_votes v where v.poll_id = p.id and v.option_id = o.id),
          'selected', exists(
            select 1 from public.poll_votes mine
            where mine.poll_id = p.id and mine.option_id = o.id and mine.profile_id = auth.uid()
          )
        )
        order by o.display_order, o.created_at
      )
      from public.poll_options o
      where o.poll_id = p.id
    ), '[]'::jsonb) as options,
    exists(select 1 from public.poll_votes v where v.poll_id = p.id and v.profile_id = auth.uid()) as viewer_has_voted
  from public.polls p
  where p.organization_id = target_organization_id
    and p.branch_id is not distinct from target_branch_id
  order by case when p.status = 'open' then 0 else 1 end, p.created_at desc;
$function$;

grant execute on function public.community_poll_feed(uuid, uuid) to anon, authenticated;

create or replace function public.create_community_poll(
  target_organization_id uuid,
  target_branch_id uuid,
  poll_question text,
  poll_description text,
  option_labels text[],
  allow_multiple boolean default false,
  close_at timestamptz default null,
  poll_visibility text default 'members'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  created_poll_id uuid;
  label text;
  position integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to create a poll';
  end if;
  if not public.has_permission(target_organization_id, 'polls.manage', target_branch_id) then
    raise exception using errcode = '42501', message = 'Poll publishing permission is required';
  end if;
  if target_branch_id is not null and not public.is_expression_member(target_organization_id, target_branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required';
  end if;
  if target_branch_id is null and not public.is_organization_member(target_organization_id) then
    raise exception using errcode = '42501', message = 'Church membership required';
  end if;
  if coalesce(cardinality(option_labels), 0) < 2 or cardinality(option_labels) > 12 then
    raise exception using errcode = '22023', message = 'A poll needs between 2 and 12 options';
  end if;
  if nullif(btrim(poll_question), '') is null then
    raise exception using errcode = '22023', message = 'Poll question is required';
  end if;
  if close_at is not null and close_at <= now() then
    raise exception using errcode = '22023', message = 'Poll closing time must be in the future';
  end if;

  insert into public.polls(
    organization_id, branch_id, author_profile_id, question, description,
    visibility, status, allows_multiple, closes_at
  ) values (
    target_organization_id, target_branch_id, auth.uid(), btrim(poll_question),
    coalesce(btrim(poll_description), ''),
    case when target_branch_id is null then coalesce(nullif(poll_visibility, ''), 'members') else 'members' end,
    'open', coalesce(allow_multiple, false), close_at
  ) returning id into created_poll_id;

  foreach label in array option_labels loop
    label := btrim(label);
    if label = '' then
      raise exception using errcode = '22023', message = 'Poll options cannot be blank';
    end if;
    insert into public.poll_options(poll_id, label, display_order)
    values (created_poll_id, label, position);
    position := position + 1;
  end loop;

  return created_poll_id;
end;
$function$;

grant execute on function public.create_community_poll(uuid, uuid, text, text, text[], boolean, timestamptz, text) to authenticated;

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
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to vote';
  end if;
  select * into selected_poll from public.polls p where p.id = target_poll_id for update;
  if selected_poll.id is null then
    raise exception using errcode = 'P0002', message = 'Poll not found';
  end if;
  if selected_poll.status <> 'open' or (selected_poll.closes_at is not null and selected_poll.closes_at <= now()) then
    raise exception using errcode = '22023', message = 'This poll is closed';
  end if;
  if selected_poll.branch_id is null then
    if not public.is_organization_member(selected_poll.organization_id) then
      raise exception using errcode = '42501', message = 'Church membership required to vote';
    end if;
  elsif not public.is_expression_member(selected_poll.organization_id, selected_poll.branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required to vote';
  end if;
  if coalesce(cardinality(target_option_ids), 0) < 1 then
    raise exception using errcode = '22023', message = 'Choose at least one option';
  end if;
  if not selected_poll.allows_multiple and cardinality(target_option_ids) <> 1 then
    raise exception using errcode = '22023', message = 'Choose one option for this poll';
  end if;
  if cardinality(target_option_ids) > 12 then
    raise exception using errcode = '22023', message = 'Too many poll options selected';
  end if;

  if exists (
    select 1 from unnest(target_option_ids) requested(id)
    where not exists(select 1 from public.poll_options o where o.poll_id = target_poll_id and o.id = requested.id)
  ) then
    raise exception using errcode = '22023', message = 'One or more selected options are invalid';
  end if;

  -- Re-voting replaces the viewer's previous selection atomically.
  delete from public.poll_votes where poll_id = target_poll_id and profile_id = auth.uid();
  foreach option_id in array target_option_ids loop
    insert into public.poll_votes(poll_id, option_id, profile_id)
    values (target_poll_id, option_id, auth.uid());
  end loop;
end;
$function$;

grant execute on function public.vote_community_poll(uuid, uuid[]) to authenticated;

create or replace function public.community_giveaway_feed(
  target_organization_id uuid,
  target_branch_id uuid default null
)
returns table(
  id uuid,
  title text,
  description text,
  prize_description text,
  status text,
  winners_count integer,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz,
  host_profile_id uuid,
  host_name text,
  viewer_entered boolean,
  entry_count bigint,
  winners jsonb
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    g.id,
    g.title,
    g.description,
    g.prize_description,
    g.status,
    g.winners_count,
    g.opens_at,
    g.closes_at,
    g.created_at,
    g.host_profile_id,
    hp.display_name as host_name,
    exists(select 1 from public.giveaway_entries mine where mine.giveaway_id = g.id and mine.profile_id = auth.uid()) as viewer_entered,
    case when g.host_profile_id = auth.uid() then (select count(*) from public.giveaway_entries e where e.giveaway_id = g.id) else 0 end as entry_count,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'profileId', w.profile_id,
        'displayName', wp.display_name,
        'avatarUrl', wp.avatar_url,
        'giftNote', w.gift_note,
        'fulfilledAt', w.fulfilled_at,
        'selectedAt', w.selected_at
      ) order by w.selected_at)
      from public.giveaway_winners w
      join public.profiles wp on wp.id = w.profile_id
      where w.giveaway_id = g.id
    ), '[]'::jsonb) as winners
  from public.giveaways g
  left join public.profiles hp on hp.id = g.host_profile_id
  where g.organization_id = target_organization_id
    and g.branch_id is not distinct from target_branch_id
  order by case when g.status = 'open' then 0 when g.status = 'drawing' then 1 else 2 end, g.created_at desc;
$function$;

grant execute on function public.community_giveaway_feed(uuid, uuid) to authenticated;

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
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to host a giveaway';
  end if;
  if target_branch_id is null then
    if not public.is_organization_member(target_organization_id) then
      raise exception using errcode = '42501', message = 'Church membership required';
    end if;
  elsif not public.is_expression_member(target_organization_id, target_branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required';
  end if;
  if nullif(btrim(giveaway_title), '') is null or nullif(btrim(prize), '') is null then
    raise exception using errcode = '22023', message = 'Giveaway title and prize are required';
  end if;
  if number_of_winners < 1 or number_of_winners > 100 then
    raise exception using errcode = '22023', message = 'Winners count must be between 1 and 100';
  end if;
  if close_at is not null and close_at <= coalesce(open_at, now()) then
    raise exception using errcode = '22023', message = 'Giveaway closing time must be after opening time';
  end if;

  insert into public.giveaways(
    organization_id, branch_id, host_profile_id, title, description,
    prize_description, status, visibility, winners_count, opens_at, closes_at
  ) values (
    target_organization_id, target_branch_id, auth.uid(), btrim(giveaway_title),
    coalesce(btrim(giveaway_description), ''), btrim(prize),
    case when open_at is not null and open_at > now() then 'draft' else 'open' end,
    case when target_branch_id is null then coalesce(nullif(giveaway_visibility, ''), 'members') else 'members' end,
    number_of_winners, open_at, close_at
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
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to enter';
  end if;
  select * into selected_giveaway from public.giveaways g where g.id = target_giveaway_id;
  if selected_giveaway.id is null then raise exception using errcode = 'P0002', message = 'Giveaway not found'; end if;
  if selected_giveaway.status <> 'open'
    or (selected_giveaway.opens_at is not null and selected_giveaway.opens_at > now())
    or (selected_giveaway.closes_at is not null and selected_giveaway.closes_at <= now()) then
    raise exception using errcode = '22023', message = 'This giveaway is not accepting entries';
  end if;
  if selected_giveaway.branch_id is null then
    if not public.is_organization_member(selected_giveaway.organization_id) then raise exception using errcode = '42501', message = 'Church membership required'; end if;
  elsif not public.is_expression_member(selected_giveaway.organization_id, selected_giveaway.branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required';
  end if;
  insert into public.giveaway_entries(giveaway_id, profile_id)
  values (target_giveaway_id, auth.uid())
  on conflict (giveaway_id, profile_id) do nothing;
end;
$function$;

grant execute on function public.enter_community_giveaway(uuid) to authenticated;

create or replace function public.draw_community_giveaway(target_giveaway_id uuid)
returns table(profile_id uuid, display_name text, avatar_url text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  selected_giveaway public.giveaways%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  select * into selected_giveaway from public.giveaways g where g.id = target_giveaway_id for update;
  if selected_giveaway.id is null then raise exception using errcode = 'P0002', message = 'Giveaway not found'; end if;
  if selected_giveaway.host_profile_id <> auth.uid() then raise exception using errcode = '42501', message = 'Only the giveaway host can draw winners'; end if;
  if selected_giveaway.status not in ('open','drawing') then raise exception using errcode = '22023', message = 'This giveaway cannot be drawn'; end if;
  if selected_giveaway.closes_at is not null and selected_giveaway.closes_at > now() then raise exception using errcode = '22023', message = 'The giveaway is still open'; end if;
  if (select count(*) from public.giveaway_entries e where e.giveaway_id = target_giveaway_id) < 1 then
    raise exception using errcode = '22023', message = 'No eligible entries yet';
  end if;

  update public.giveaways set status = 'drawing' where id = target_giveaway_id;
  delete from public.giveaway_winners where giveaway_id = target_giveaway_id;

  insert into public.giveaway_winners(giveaway_id, profile_id, selected_by)
  select target_giveaway_id, e.profile_id, auth.uid()
  from public.giveaway_entries e
  where e.giveaway_id = target_giveaway_id
  order by random()
  limit selected_giveaway.winners_count;

  update public.giveaways set status = 'completed' where id = target_giveaway_id;

  return query
  select w.profile_id, p.display_name, p.avatar_url
  from public.giveaway_winners w
  join public.profiles p on p.id = w.profile_id
  where w.giveaway_id = target_giveaway_id
  order by w.selected_at;
end;
$function$;

grant execute on function public.draw_community_giveaway(uuid) to authenticated;

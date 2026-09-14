-- Database-driven Home feed layout plan.
--
-- The app should not hardcode one permanent sermon/event/announcement shelf. This
-- function mixes the ordinary vertical stream with repeatable horizontal section
-- batches. The same section kind can therefore appear again later with different
-- content. Ranking/layout happens in Postgres rather than an Edge Function.

create or replace function public.home_feed_layer_plan(
  target_organization_id uuid,
  target_expression_id uuid default null,
  stream_limit integer default 48,
  section_batch_size integer default 6,
  stream_items_between_sections integer default 4
)
returns table(
  "position" numeric,
  unit_kind text,
  content_kind text,
  content_ids uuid[],
  newest_at timestamptz,
  score numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if target_organization_id is null then
    raise exception using errcode = '22023', message = 'organizationId is required';
  end if;
  if stream_limit < 1 or stream_limit > 200 then
    raise exception using errcode = '22023', message = 'stream_limit must be between 1 and 200';
  end if;
  if section_batch_size < 1 or section_batch_size > 20 then
    raise exception using errcode = '22023', message = 'section_batch_size must be between 1 and 20';
  end if;
  if stream_items_between_sections < 1 or stream_items_between_sections > 20 then
    raise exception using errcode = '22023', message = 'stream_items_between_sections must be between 1 and 20';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = target_organization_id and o.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'Church organization not found';
  end if;

  if target_expression_id is not null then
    if auth.uid() is null or not public.is_expression_member(target_organization_id, target_expression_id) then
      raise exception using errcode = '42501', message = 'Expression membership required';
    end if;
    if not exists (
      select 1 from public.branches b
      where b.id = target_expression_id
        and b.organization_id = target_organization_id
        and b.is_active
    ) then
      raise exception using errcode = 'P0002', message = 'Expression not found';
    end if;
  end if;

  return query
  with stream_candidates as (
    select
      ci.id,
      ci.content_type::text as kind,
      coalesce(ci.published_at, ci.created_at) as published_at,
      (
        extract(epoch from (now() - coalesce(ci.published_at, ci.created_at))) / -3600.0
      )::numeric as recency_score
    from public.content_items ci
    where ci.organization_id = target_organization_id
      and ci.status = 'published'
      and ci.content_type in ('post', 'reel', 'video')
      and (
        (target_expression_id is null and ci.visibility = 'public' and ci.expression_id is null and ci.group_id is null)
        or
        (target_expression_id is not null and ci.expression_id = target_expression_id and ci.group_id is null)
      )
    order by coalesce(ci.published_at, ci.created_at) desc
    limit stream_limit
  ), ranked_stream as (
    select
      sc.*,
      row_number() over (order by sc.recency_score desc, sc.published_at desc, sc.id) as rn
    from stream_candidates sc
  ), specialty_items as (
    select s.id, 'sermon'::text as kind, coalesce(s.published_at, s.created_at) as published_at
    from public.sermons s
    where s.organization_id = target_organization_id
      and s.status = 'published'
      and (
        (target_expression_id is null and s.visibility = 'public' and s.expression_id is null)
        or
        (target_expression_id is not null and s.expression_id = target_expression_id)
      )

    union all

    select e.id, 'event'::text, e.created_at
    from public.events e
    where e.organization_id = target_organization_id
      and e.status = 'published'
      and (
        (target_expression_id is null and e.visibility = 'public' and e.branch_id is null)
        or
        (target_expression_id is not null and e.branch_id = target_expression_id)
      )

    union all

    select a.id, 'announcement'::text, coalesce(a.published_at, a.created_at)
    from public.announcements a
    where a.organization_id = target_organization_id
      and a.status = 'published'
      and (
        (target_expression_id is null and a.branch_id is null)
        or
        (target_expression_id is not null and a.branch_id = target_expression_id)
      )
  ), specialty_ranked as (
    select
      si.*,
      row_number() over (partition by si.kind order by si.published_at desc, si.id) as kind_rn
    from specialty_items si
  ), specialty_chunks as (
    select
      sr.kind,
      ((sr.kind_rn - 1) / section_batch_size)::integer as chunk_index,
      array_agg(sr.id order by sr.published_at desc, sr.id) as ids,
      max(sr.published_at) as newest_at
    from specialty_ranked sr
    group by sr.kind, ((sr.kind_rn - 1) / section_batch_size)::integer
  ), specialty_ordered as (
    select
      sc.*,
      row_number() over (
        order by
          sc.chunk_index,
          case sc.kind when 'announcement' then 1 when 'event' then 2 when 'sermon' then 3 else 9 end,
          sc.newest_at desc
      ) as section_rn
    from specialty_chunks sc
  ), stream_units as (
    select
      (rs.rn * 100)::numeric as "position",
      'stream'::text as unit_kind,
      rs.kind as content_kind,
      array[rs.id]::uuid[] as content_ids,
      rs.published_at as newest_at,
      rs.recency_score as score
    from ranked_stream rs
  ), section_units as (
    select
      (
        (so.section_rn * stream_items_between_sections * 100)
        - 50
      )::numeric as "position",
      'section'::text as unit_kind,
      so.kind as content_kind,
      so.ids as content_ids,
      so.newest_at,
      (100000 - so.section_rn)::numeric as score
    from specialty_ordered so
  )
  select * from stream_units
  union all
  select * from section_units
  order by "position", newest_at desc;
end;
$function$;

grant execute on function public.home_feed_layer_plan(uuid, uuid, integer, integer, integer) to anon, authenticated;

comment on function public.home_feed_layer_plan(uuid, uuid, integer, integer, integer) is
  'Returns the ordered Home layout plan. Stream items stay vertical; sermon/event/announcement batches become repeatable horizontal sections interleaved by cadence.';

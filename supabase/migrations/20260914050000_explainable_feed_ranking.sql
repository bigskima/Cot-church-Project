-- Elementary, explainable feed ranking for General COT and Expressions.
-- Ranking remains deterministic and database-driven: freshness, meaningful
-- engagement, followed authors and unfinished media increase relevance, while
-- repeated authors are gently diversified. All weights are configurable without
-- redeploying the app.

insert into public.permissions(code, name, description, category)
values ('feed.ranking.manage', 'Manage feed ranking', 'Tune feed ranking weights for an organization or Expression.', 'social')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_active = true;

create table if not exists public.feed_ranking_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  enabled boolean not null default true,
  recency_weight numeric(8,3) not null default 6.000 check (recency_weight between 0 and 100),
  reaction_weight numeric(8,3) not null default 1.250 check (reaction_weight between 0 and 100),
  comment_weight numeric(8,3) not null default 1.750 check (comment_weight between 0 and 100),
  followed_author_boost numeric(8,3) not null default 3.000 check (followed_author_boost between 0 and 100),
  continuation_boost numeric(8,3) not null default 2.500 check (continuation_boost between 0 and 100),
  completed_penalty numeric(8,3) not null default 1.000 check (completed_penalty between 0 and 100),
  repeat_author_penalty numeric(8,3) not null default 1.200 check (repeat_author_penalty between 0 and 100),
  freshness_half_life_hours numeric(10,2) not null default 24.00 check (freshness_half_life_hours between 1 and 8760),
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  unique nulls not distinct(organization_id, branch_id)
);

alter table public.feed_ranking_settings enable row level security;

drop policy if exists feed_ranking_settings_read on public.feed_ranking_settings;
create policy feed_ranking_settings_read on public.feed_ranking_settings for select using (
  branch_id is null or public.is_expression_member(organization_id, branch_id)
);

drop policy if exists feed_ranking_settings_manage on public.feed_ranking_settings;
create policy feed_ranking_settings_manage on public.feed_ranking_settings for all to authenticated using (
  public.has_platform_permission('platform.features.manage')
  or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
) with check (
  public.has_platform_permission('platform.features.manage')
  or public.has_permission(organization_id, 'feed.ranking.manage', branch_id)
);

grant select on public.feed_ranking_settings to anon, authenticated;
grant insert, update, delete on public.feed_ranking_settings to authenticated;

drop trigger if exists feed_ranking_settings_updated on public.feed_ranking_settings;
create trigger feed_ranking_settings_updated
before update on public.feed_ranking_settings
for each row execute function public.set_updated_at();

-- Expression admins receive scoped tuning authority. Other delegated roles remain
-- least privilege unless ranking permission is explicitly assigned later.
update public.role_blueprints
set permission_codes = (
  select array_agg(distinct code order by code)
  from unnest(permission_codes || array['feed.ranking.manage']::text[]) code
), updated_at = now()
where code = 'expression_admin';

insert into public.role_permissions(role_id, permission_code)
select r.id, 'feed.ranking.manage'
from public.roles r
where r.code = 'expression_admin'
on conflict do nothing;

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
declare
  ranking_enabled boolean := true;
  w_recency numeric := 6.000;
  w_reaction numeric := 1.250;
  w_comment numeric := 1.750;
  w_follow numeric := 3.000;
  w_continue numeric := 2.500;
  w_completed numeric := 1.000;
  w_repeat numeric := 1.200;
  half_life numeric := 24.00;
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

  select
    s.enabled, s.recency_weight, s.reaction_weight, s.comment_weight,
    s.followed_author_boost, s.continuation_boost, s.completed_penalty,
    s.repeat_author_penalty, s.freshness_half_life_hours
  into ranking_enabled, w_recency, w_reaction, w_comment, w_follow,
       w_continue, w_completed, w_repeat, half_life
  from public.feed_ranking_settings s
  where s.organization_id = target_organization_id
    and s.branch_id is not distinct from target_expression_id
  limit 1;

  -- An Expression inherits organization-wide defaults when it has no override.
  if not found and target_expression_id is not null then
    select
      s.enabled, s.recency_weight, s.reaction_weight, s.comment_weight,
      s.followed_author_boost, s.continuation_boost, s.completed_penalty,
      s.repeat_author_penalty, s.freshness_half_life_hours
    into ranking_enabled, w_recency, w_reaction, w_comment, w_follow,
         w_continue, w_completed, w_repeat, half_life
    from public.feed_ranking_settings s
    where s.organization_id = target_organization_id and s.branch_id is null
    limit 1;
  end if;

  -- SELECT INTO with no row nulls the variables; restore human-readable defaults.
  ranking_enabled := coalesce(ranking_enabled, true);
  w_recency := coalesce(w_recency, 6.000);
  w_reaction := coalesce(w_reaction, 1.250);
  w_comment := coalesce(w_comment, 1.750);
  w_follow := coalesce(w_follow, 3.000);
  w_continue := coalesce(w_continue, 2.500);
  w_completed := coalesce(w_completed, 1.000);
  w_repeat := coalesce(w_repeat, 1.200);
  half_life := greatest(coalesce(half_life, 24.00), 1);

  return query
  with candidate_metrics as (
    select
      ci.id,
      ci.author_profile_id,
      ci.content_type::text as kind,
      coalesce(ci.published_at, ci.created_at) as published_at,
      greatest(extract(epoch from (now() - coalesce(ci.published_at, ci.created_at))) / 3600.0, 0)::numeric as age_hours,
      (select count(*) from public.content_reactions r where r.content_item_id = ci.id)::numeric as reaction_count,
      (select count(*) from public.content_comments c where c.content_item_id = ci.id and c.is_hidden = false)::numeric as comment_count,
      case when auth.uid() is not null and ci.author_profile_id is not null and exists(
        select 1 from public.follows f
        where f.profile_id = auth.uid() and f.target_profile_id = ci.author_profile_id
      ) then 1 else 0 end::numeric as follows_author,
      case when auth.uid() is not null and exists(
        select 1 from public.content_playback_progress p
        where p.profile_id = auth.uid() and p.content_item_id = ci.id
          and p.progress_seconds > 0 and p.completed = false
      ) then 1 else 0 end::numeric as continue_signal,
      case when auth.uid() is not null and exists(
        select 1 from public.content_playback_progress p
        where p.profile_id = auth.uid() and p.content_item_id = ci.id and p.completed = true
      ) then 1 else 0 end::numeric as completed_signal
    from public.content_items ci
    where ci.organization_id = target_organization_id
      and ci.status = 'published'
      and ci.content_type in ('post', 'reel', 'video')
      and (
        (target_expression_id is null and ci.visibility = 'public' and ci.expression_id is null and ci.group_id is null)
        or
        (target_expression_id is not null and ci.expression_id = target_expression_id and ci.group_id is null)
      )
  ), base_scored as (
    select
      cm.*,
      case when ranking_enabled then (
        (w_recency / (1 + (cm.age_hours / half_life)))
        + (w_reaction * ln(1 + cm.reaction_count))
        + (w_comment * ln(1 + cm.comment_count))
        + (w_follow * cm.follows_author)
        + (w_continue * cm.continue_signal)
        - (w_completed * cm.completed_signal)
      ) else (-cm.age_hours) end as base_score
    from candidate_metrics cm
  ), author_diversified as (
    select
      bs.*,
      row_number() over (
        partition by coalesce(bs.author_profile_id, bs.id)
        order by bs.base_score desc, bs.published_at desc, bs.id
      ) as author_sequence
    from base_scored bs
  ), ranked_stream as (
    select
      ad.*,
      (ad.base_score - case when ranking_enabled then w_repeat * greatest(ad.author_sequence - 1, 0) else 0 end)::numeric as final_score,
      row_number() over (
        order by
          (ad.base_score - case when ranking_enabled then w_repeat * greatest(ad.author_sequence - 1, 0) else 0 end) desc,
          ad.published_at desc,
          ad.id
      ) as rn
    from author_diversified ad
    order by final_score desc, ad.published_at desc
    limit stream_limit
  ), specialty_items as (
    select s.id, 'sermon'::text as kind, coalesce(s.published_at, s.created_at) as published_at
    from public.sermons s
    where s.organization_id = target_organization_id
      and s.status = 'published'
      and (
        (target_expression_id is null and s.visibility = 'public' and s.expression_id is null)
        or (target_expression_id is not null and s.expression_id = target_expression_id)
      )
    union all
    select e.id, 'event'::text, e.created_at
    from public.events e
    where e.organization_id = target_organization_id
      and e.status = 'published'
      and (
        (target_expression_id is null and e.visibility = 'public' and e.branch_id is null)
        or (target_expression_id is not null and e.branch_id = target_expression_id)
      )
    union all
    select a.id, 'announcement'::text, coalesce(a.published_at, a.created_at)
    from public.announcements a
    where a.organization_id = target_organization_id
      and a.status = 'published'
      and (
        (target_expression_id is null and a.branch_id is null)
        or (target_expression_id is not null and a.branch_id = target_expression_id)
      )
  ), specialty_ranked as (
    select si.*, row_number() over (partition by si.kind order by si.published_at desc, si.id) as kind_rn
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
    select sc.*, row_number() over (
      order by sc.chunk_index,
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
      rs.final_score as score
    from ranked_stream rs
  ), section_units as (
    select
      ((so.section_rn * stream_items_between_sections * 100) - 50)::numeric as "position",
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

comment on table public.feed_ranking_settings is
  'Database-controlled, explainable Home feed weights. Expression rows override the organization-wide row.';
comment on function public.home_feed_layer_plan(uuid, uuid, integer, integer, integer) is
  'Builds layered Home order using configurable freshness/engagement/relationship/continuation signals and repeat-author diversity; specialty shelves remain interleaved.';

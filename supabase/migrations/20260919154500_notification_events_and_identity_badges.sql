-- Complete event-driven COT notifications and extend public identity badges.
-- Presentation badges remain independent of RBAC/security roles.

alter table public.notification_preferences
  add column if not exists live_alerts_enabled boolean not null default true,
  add column if not exists followed_posts_enabled boolean not null default true,
  add column if not exists priority_leadership_posts_enabled boolean not null default true,
  add column if not exists urgent_platform_alerts_enabled boolean not null default true;

create unique index if not exists notifications_dedup_key_recipient_unique
on public.notifications(recipient_profile_id, (data->>'dedupKey'))
where data ? 'dedupKey';

create table if not exists public.platform_notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 1200),
  route text null check (route is null or (route like '/%' and route not like '//%')),
  is_urgent boolean not null default false,
  expires_at timestamptz null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade
);

alter table public.platform_notification_broadcasts enable row level security;
revoke all on table public.platform_notification_broadcasts from anon,authenticated;

insert into public.permissions(code,name,description,category)
values(
  'platform.notifications.broadcast',
  'Broadcast platform notifications',
  'Send audited urgent or informational notifications to a selected church or Expression.',
  'platform'
)
on conflict(code) do update
set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

insert into public.platform_role_permissions(role_code,permission_code)
select r.code,'platform.notifications.broadcast'
from public.platform_roles r
where r.code in ('admin','super_admin')
on conflict do nothing;

-- Identity badge definitions can now be General-COT scoped (branch_id null)
-- or Expression-scoped (branch_id set).
alter table public.identity_badge_definitions
  add column if not exists branch_id uuid null,
  add column if not exists badge_variant text not null default 'default',
  add column if not exists notify_priority_posts boolean not null default false;

alter table public.identity_badge_definitions
  drop constraint if exists identity_badge_definitions_organization_id_code_key;

alter table public.identity_badge_definitions
  drop constraint if exists identity_badge_definitions_branch_scope_fkey;

alter table public.identity_badge_definitions
  add constraint identity_badge_definitions_branch_scope_fkey
  foreign key(branch_id,organization_id)
  references public.branches(id,organization_id)
  on delete cascade;

alter table public.identity_badge_definitions
  drop constraint if exists identity_badge_definitions_badge_variant_check,
  add constraint identity_badge_definitions_badge_variant_check
  check (badge_variant in ('silver','gold','blue','teal','default','custom'));

create unique index if not exists identity_badge_definition_general_code_unique
on public.identity_badge_definitions(organization_id,code)
where branch_id is null;

create unique index if not exists identity_badge_definition_expression_code_unique
on public.identity_badge_definitions(organization_id,branch_id,code)
where branch_id is not null;

alter table public.identity_badge_assignments
  alter column branch_id drop not null;

alter table public.identity_badge_assignments
  drop constraint if exists identity_badge_assignments_branch_id_profile_id_badge_definition_id_key;

create unique index if not exists identity_badge_assignment_general_unique
on public.identity_badge_assignments(organization_id,profile_id,badge_definition_id)
where branch_id is null;

create unique index if not exists identity_badge_assignment_expression_unique
on public.identity_badge_assignments(organization_id,branch_id,profile_id,badge_definition_id)
where branch_id is not null;

-- Product defaults remain database rows and are editable later.
insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select id,null,'general_overseer','G.O','#C0C7D1','#111827',130,false,'silver',true
from public.organizations
on conflict do nothing;

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select id,null,'lead_pastor','Lead Pastor','#D4A017','#111827',120,false,'gold',true
from public.organizations
on conflict do nothing;

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select id,null,'pastor','Pastor','#2563EB','#FFFFFF',90,false,'blue',false
from public.organizations
on conflict do nothing;

update public.identity_badge_definitions
set badge_variant='gold', notify_priority_posts=true
where code='senior_pastor' and branch_id is null;

update public.identity_badge_definitions
set badge_variant='blue'
where code='associate_pastor' and branch_id is null;

update public.identity_badge_definitions
set badge_variant='teal'
where code='expression_pastor';

update public.identity_badge_definitions
set badge_variant='default'
where code in ('leader','member');

create or replace function public.notify_live_stream_started()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  scope_name text;
  route_path text;
  expression_name text;
begin
  if new.status::text <> 'live' or coalesce(old.status::text,'') = 'live' then
    return new;
  end if;

  if new.branch_id is null then
    scope_name := 'General COT';
    route_path := '/general/live/' || new.id::text;

    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      new.organization_id,
      recipient.profile_id,
      'live_started',
      'COT is live now',
      new.title,
      jsonb_build_object(
        'scope','general',
        'entityType','live_stream',
        'streamId',new.id,
        'route',route_path,
        'dedupKey','live:'||new.id::text
      )
    from (
      select distinct m.profile_id
      from public.memberships m
      where m.organization_id=new.organization_id and m.status='active'
    ) recipient
    left join public.notification_preferences p
      on p.profile_id=recipient.profile_id and p.organization_id=new.organization_id
    where recipient.profile_id<>new.created_by
      and coalesce(p.live_alerts_enabled,true)
    on conflict do nothing;
  else
    select name into expression_name from public.branches where id=new.branch_id;
    scope_name := coalesce(expression_name,'Expression');
    route_path := '/expressions/' || new.branch_id::text || '/live/' || new.id::text;

    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      new.organization_id,
      em.profile_id,
      'live_started',
      scope_name || ' is live now',
      new.title,
      jsonb_build_object(
        'scope','expression',
        'branchId',new.branch_id,
        'entityType','live_stream',
        'streamId',new.id,
        'route',route_path,
        'dedupKey','live:'||new.id::text
      )
    from public.expression_memberships em
    left join public.notification_preferences p
      on p.profile_id=em.profile_id and p.organization_id=new.organization_id
    where em.organization_id=new.organization_id
      and em.branch_id=new.branch_id
      and em.status='active'
      and em.profile_id<>new.created_by
      and coalesce(p.live_alerts_enabled,true)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists live_streams_notify_started on public.live_streams;
create trigger live_streams_notify_started
after update of status on public.live_streams
for each row execute function public.notify_live_stream_started();

create or replace function public.notify_social_post_published()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  author_profile uuid;
  author_name text;
  route_path text;
  is_priority_author boolean := false;
begin
  if new.status::text <> 'published' then return new; end if;
  if tg_op='UPDATE' and coalesce(old.status::text,'')='published' then return new; end if;
  if new.group_id is not null then return new; end if;

  if new.author_membership_id is not null then
    select m.profile_id into author_profile
    from public.memberships m
    where m.id=new.author_membership_id;
  else
    select ci.author_profile_id into author_profile
    from public.content_items ci
    where ci.id=new.id;
  end if;

  if author_profile is null then return new; end if;
  select coalesce(nullif(trim(p.display_name),''),nullif(trim(p.username),''),'COT member')
  into author_name
  from public.profiles p where p.id=author_profile;

  route_path := case
    when new.branch_id is null then '/general/post/'||new.id::text
    else '/expressions/'||new.branch_id::text||'/post/'||new.id::text
  end;

  -- Followers are notified only when they are allowed inside the post scope.
  if new.branch_id is null and new.visibility::text='public' then
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      new.organization_id,
      f.profile_id,
      'followed_profile_post',
      author_name || ' posted',
      left(coalesce(nullif(trim(new.body),''),'Shared a new post.'),180),
      jsonb_build_object(
        'scope','general',
        'entityType','social_post',
        'postId',new.id,
        'authorProfileId',author_profile,
        'route',route_path,
        'dedupKey','post:'||new.id::text
      )
    from public.follows f
    join public.memberships m
      on m.profile_id=f.profile_id and m.organization_id=new.organization_id and m.status='active'
    left join public.notification_preferences p
      on p.profile_id=f.profile_id and p.organization_id=new.organization_id
    where f.target_profile_id=author_profile
      and f.profile_id<>author_profile
      and coalesce(p.followed_posts_enabled,true)
    group by f.profile_id
    on conflict do nothing;
  elsif new.branch_id is not null then
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      new.organization_id,
      f.profile_id,
      'followed_profile_post',
      author_name || ' posted in your Expression',
      left(coalesce(nullif(trim(new.body),''),'Shared a new post.'),180),
      jsonb_build_object(
        'scope','expression',
        'branchId',new.branch_id,
        'entityType','social_post',
        'postId',new.id,
        'authorProfileId',author_profile,
        'route',route_path,
        'dedupKey','post:'||new.id::text
      )
    from public.follows f
    join public.expression_memberships em
      on em.profile_id=f.profile_id
      and em.organization_id=new.organization_id
      and em.branch_id=new.branch_id
      and em.status='active'
    left join public.notification_preferences p
      on p.profile_id=f.profile_id and p.organization_id=new.organization_id
    where f.target_profile_id=author_profile
      and f.profile_id<>author_profile
      and coalesce(p.followed_posts_enabled,true)
    on conflict do nothing;
  end if;

  select exists(
    select 1
    from public.identity_badge_assignments a
    join public.identity_badge_definitions d
      on d.id=a.badge_definition_id and d.organization_id=a.organization_id
    where a.organization_id=new.organization_id
      and a.profile_id=author_profile
      and a.is_active
      and d.is_active
      and d.notify_priority_posts
      and (
        (new.branch_id is null and a.branch_id is null)
        or
        (new.branch_id is not null and (a.branch_id is null or a.branch_id=new.branch_id))
      )
  ) into is_priority_author;

  if is_priority_author then
    if new.branch_id is null and new.visibility::text='public' then
      insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
      select
        new.organization_id,
        recipient.profile_id,
        'priority_ministry_post',
        author_name || ' shared an important update',
        left(coalesce(nullif(trim(new.body),''),'Open COT to view this ministry update.'),180),
        jsonb_build_object(
          'scope','general',
          'entityType','social_post',
          'postId',new.id,
          'authorProfileId',author_profile,
          'priorityLeadership',true,
          'route',route_path,
          'dedupKey','post:'||new.id::text
        )
      from (
        select distinct m.profile_id
        from public.memberships m
        where m.organization_id=new.organization_id and m.status='active'
      ) recipient
      left join public.notification_preferences p
        on p.profile_id=recipient.profile_id and p.organization_id=new.organization_id
      where recipient.profile_id<>author_profile
        and coalesce(p.priority_leadership_posts_enabled,true)
      on conflict do nothing;
    elsif new.branch_id is not null then
      insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
      select
        new.organization_id,
        em.profile_id,
        'priority_ministry_post',
        author_name || ' shared an important update',
        left(coalesce(nullif(trim(new.body),''),'Open COT to view this ministry update.'),180),
        jsonb_build_object(
          'scope','expression',
          'branchId',new.branch_id,
          'entityType','social_post',
          'postId',new.id,
          'authorProfileId',author_profile,
          'priorityLeadership',true,
          'route',route_path,
          'dedupKey','post:'||new.id::text
        )
      from public.expression_memberships em
      left join public.notification_preferences p
        on p.profile_id=em.profile_id and p.organization_id=new.organization_id
      where em.organization_id=new.organization_id
        and em.branch_id=new.branch_id
        and em.status='active'
        and em.profile_id<>author_profile
        and coalesce(p.priority_leadership_posts_enabled,true)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists social_posts_notify_published on public.social_posts;
create trigger social_posts_notify_published
after insert or update of status on public.social_posts
for each row execute function public.notify_social_post_published();

comment on column public.identity_badge_definitions.branch_id is
  'Null means General COT badge definition; non-null means Expression-scoped definition.';
comment on column public.identity_badge_definitions.notify_priority_posts is
  'Presentation designation may opt an author into priority ministry-post notifications; it grants no permission.';
comment on table public.platform_notification_broadcasts is
  'Audited platform-originated notices. Church ministry announcements remain in the church announcement domain.';

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

create or replace function public.create_platform_notification_broadcast(
  target_organization_id uuid,
  target_branch_id uuid,
  notice_title text,
  notice_body text,
  target_route text,
  urgent_notice boolean,
  target_expires_at timestamptz,
  actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $
declare
  broadcast_id uuid;
  recipient_count integer := 0;
  scope_name text;
begin
  if not exists(
    select 1 from public.organizations
    where id=target_organization_id and status='active'
  ) then
    raise exception using errcode='P0002',message='Active church organization not found';
  end if;

  if target_branch_id is not null and not exists(
    select 1 from public.branches
    where id=target_branch_id
      and organization_id=target_organization_id
      and is_active
  ) then
    raise exception using errcode='P0002',message='Active Expression not found';
  end if;

  insert into public.platform_notification_broadcasts(
    organization_id,branch_id,title,body,route,is_urgent,expires_at,created_by
  )
  values(
    target_organization_id,target_branch_id,trim(notice_title),trim(notice_body),
    nullif(trim(target_route),''),coalesce(urgent_notice,false),target_expires_at,actor_profile_id
  )
  returning id into broadcast_id;

  if target_branch_id is null then
    scope_name := 'general';
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      target_organization_id,
      recipient.profile_id,
      case when urgent_notice then 'platform_urgent' else 'platform_notice' end,
      trim(notice_title),
      trim(notice_body),
      jsonb_build_object(
        'scope','general',
        'entityType','platform_broadcast',
        'broadcastId',broadcast_id,
        'urgent',coalesce(urgent_notice,false),
        'route',coalesce(nullif(trim(target_route),''),'/general/notifications'),
        'dedupKey','platform-broadcast:'||broadcast_id::text
      )
    from (
      select distinct m.profile_id
      from public.memberships m
      where m.organization_id=target_organization_id and m.status='active'
    ) recipient
    on conflict do nothing;
  else
    scope_name := 'expression';
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      target_organization_id,
      em.profile_id,
      case when urgent_notice then 'platform_urgent' else 'platform_notice' end,
      trim(notice_title),
      trim(notice_body),
      jsonb_build_object(
        'scope','expression',
        'branchId',target_branch_id,
        'entityType','platform_broadcast',
        'broadcastId',broadcast_id,
        'urgent',coalesce(urgent_notice,false),
        'route',coalesce(nullif(trim(target_route),''),'/expressions/'||target_branch_id::text||'/notifications'),
        'dedupKey','platform-broadcast:'||broadcast_id::text
      )
    from public.expression_memberships em
    where em.organization_id=target_organization_id
      and em.branch_id=target_branch_id
      and em.status='active'
    on conflict do nothing;
  end if;

  get diagnostics recipient_count = row_count;
  return jsonb_build_object(
    'broadcastId',broadcast_id,
    'recipientCount',recipient_count,
    'scope',scope_name,
    'urgent',coalesce(urgent_notice,false)
  );
end;
$;

revoke all on function public.create_platform_notification_broadcast(uuid,uuid,text,text,text,boolean,timestamptz,uuid)
from public,anon,authenticated;
grant execute on function public.create_platform_notification_broadcast(uuid,uuid,text,text,text,boolean,timestamptz,uuid)
to service_role;

insert into public.permissions(code,name,description,category)
values
  (
    'platform.notifications.broadcast',
    'Broadcast platform notifications',
    'Send audited urgent or informational notifications to a selected church or Expression.',
    'platform'
  ),
  (
    'platform.identity_badges.manage',
    'Manage public titles and badges',
    'Create and assign non-permission public ministry titles for church identities.',
    'platform'
  )
on conflict(code) do update
set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

insert into public.platform_role_permissions(role_code,permission_code)
select r.code,p.permission_code
from public.platform_roles r
cross join (values
  ('platform.notifications.broadcast'),
  ('platform.identity_badges.manage')
) p(permission_code)
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

create or replace function public.enforce_identity_badge_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path=''
as $
declare
  definition_branch uuid;
begin
  select d.branch_id into definition_branch
  from public.identity_badge_definitions d
  where d.id=new.badge_definition_id
    and d.organization_id=new.organization_id;

  if not found then
    raise exception using errcode='23503',message='Badge definition not found in this church';
  end if;

  if new.branch_id is distinct from definition_branch then
    raise exception using errcode='23514',message='Badge assignment scope must match its badge definition';
  end if;
  return new;
end;
$;

drop trigger if exists identity_badge_assignment_scope_guard on public.identity_badge_assignments;
create trigger identity_badge_assignment_scope_guard
before insert or update of organization_id,branch_id,badge_definition_id
on public.identity_badge_assignments
for each row execute function public.enforce_identity_badge_assignment_scope();

create or replace function public.set_expression_identity_badge(
  target_organization_id uuid,
  target_branch_id uuid,
  target_email text,
  target_badge_definition_id uuid,
  enable_badge boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $
declare
  normalized_email text;
  target_profile uuid;
  badge public.identity_badge_definitions;
begin
  if not public.has_permission(target_organization_id,'expression.leadership.manage',target_branch_id) then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  normalized_email:=lower(trim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+
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

create or replace function public.seed_expression_identity_badges()
returns trigger
language plpgsql
security definer
set search_path=''
as $
begin
  insert into public.identity_badge_definitions(
    organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
  )
  values
    (new.organization_id,new.id,'expression_pastor','Expression Pastor','#0F766E','#FFFFFF',110,false,'teal',true),
    (new.organization_id,new.id,'pastor','Pastor','#2563EB','#FFFFFF',90,false,'blue',false),
    (new.organization_id,new.id,'leader','Leader','#475569','#FFFFFF',60,false,'default',false)
  on conflict do nothing;
  return new;
end;
$;

drop trigger if exists branches_seed_identity_badges on public.branches;
create trigger branches_seed_identity_badges
after insert on public.branches
for each row execute function public.seed_expression_identity_badges();

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select b.organization_id,b.id,'expression_pastor','Expression Pastor','#0F766E','#FFFFFF',110,false,'teal',true
from public.branches b
on conflict do nothing;

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select b.organization_id,b.id,'pastor','Pastor','#2563EB','#FFFFFF',90,false,'blue',false
from public.branches b
on conflict do nothing;

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select b.organization_id,b.id,'leader','Leader','#475569','#FFFFFF',60,false,'default',false
from public.branches b
on conflict do nothing;

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
  if new.status::text <> 'live' then
    return new;
  end if;
  if tg_op='UPDATE' and coalesce(old.status::text,'')='live' then
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
after insert or update of status on public.live_streams
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
 then
    raise exception using errcode='22023',message='Invalid email';
  end if;
  select id into target_profile from auth.users where lower(email)=normalized_email;
  if target_profile is null then raise exception using errcode='P0002',message='Registered user not found'; end if;
  if not exists(
    select 1 from public.expression_memberships
    where organization_id=target_organization_id
      and branch_id=target_branch_id
      and profile_id=target_profile
      and status='active'
  ) then
    raise exception using errcode='42501',message='User is not an active member of this Expression';
  end if;

  select * into badge
  from public.identity_badge_definitions
  where id=target_badge_definition_id
    and organization_id=target_organization_id
    and branch_id=target_branch_id
    and is_active
    and not is_membership_default;
  if not found then raise exception using errcode='P0002',message='Expression badge definition not found'; end if;

  if enable_badge then
    update public.identity_badge_assignments
    set is_active=true,assigned_by=auth.uid()
    where organization_id=target_organization_id
      and branch_id=target_branch_id
      and profile_id=target_profile
      and badge_definition_id=target_badge_definition_id;

    if not found then
      insert into public.identity_badge_assignments(
        organization_id,branch_id,profile_id,badge_definition_id,assigned_by,is_active
      )
      values(
        target_organization_id,target_branch_id,target_profile,target_badge_definition_id,auth.uid(),true
      );
    end if;
  else
    update public.identity_badge_assignments
    set is_active=false,assigned_by=auth.uid()
    where organization_id=target_organization_id
      and branch_id=target_branch_id
      and profile_id=target_profile
      and badge_definition_id=target_badge_definition_id;
  end if;

  insert into public.audit_log(
    organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values
  )
  values(
    target_organization_id,target_branch_id,auth.uid(),
    case when enable_badge then 'assign' else 'revoke' end,
    'identity_badge',target_profile::text,
    jsonb_build_object('badgeId',target_badge_definition_id,'email',normalized_email)
  );
  return jsonb_build_object('profileId',target_profile,'badgeId',target_badge_definition_id,'active',enable_badge);
end;
$;

revoke all on function public.set_expression_identity_badge(uuid,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.set_expression_identity_badge(uuid,uuid,text,uuid,boolean) to authenticated,service_role;

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

create or replace function public.seed_expression_identity_badges()
returns trigger
language plpgsql
security definer
set search_path=''
as $
begin
  insert into public.identity_badge_definitions(
    organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
  )
  values
    (new.organization_id,new.id,'expression_pastor','Expression Pastor','#0F766E','#FFFFFF',110,false,'teal',true),
    (new.organization_id,new.id,'pastor','Pastor','#2563EB','#FFFFFF',90,false,'blue',false),
    (new.organization_id,new.id,'leader','Leader','#475569','#FFFFFF',60,false,'default',false)
  on conflict do nothing;
  return new;
end;
$;

drop trigger if exists branches_seed_identity_badges on public.branches;
create trigger branches_seed_identity_badges
after insert on public.branches
for each row execute function public.seed_expression_identity_badges();

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select b.organization_id,b.id,'expression_pastor','Expression Pastor','#0F766E','#FFFFFF',110,false,'teal',true
from public.branches b
on conflict do nothing;

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select b.organization_id,b.id,'pastor','Pastor','#2563EB','#FFFFFF',90,false,'blue',false
from public.branches b
on conflict do nothing;

insert into public.identity_badge_definitions(
  organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,badge_variant,notify_priority_posts
)
select b.organization_id,b.id,'leader','Leader','#475569','#FFFFFF',60,false,'default',false
from public.branches b
on conflict do nothing;

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

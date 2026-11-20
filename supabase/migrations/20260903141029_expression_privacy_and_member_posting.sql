-- Expression-private content must never widen to all organization members.
-- Also allow ordinary active Expression members to publish to their own Expression
-- public/member feed and the church-wide public feed, subject to moderation controls.

create function public.is_expression_member(target_organization_id uuid, target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_branch_id is not null and exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.branch_id = target_branch_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
  );
$$;

create function public.can_read_branch_scoped_resource(target_organization_id uuid, target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_branch_id is null then public.is_organization_member(target_organization_id)
    else public.is_expression_member(target_organization_id, target_branch_id)
  end;
$$;

revoke all on function public.is_expression_member(uuid,uuid) from public;
revoke all on function public.can_read_branch_scoped_resource(uuid,uuid) from public;
grant execute on function public.is_expression_member(uuid,uuid) to authenticated;
grant execute on function public.can_read_branch_scoped_resource(uuid,uuid) to authenticated;

create table public.profile_posting_controls (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  posting_allowed boolean not null default true,
  reason text not null default '',
  restricted_until timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (posting_allowed or char_length(trim(reason)) between 1 and 1000)
);
create trigger profile_posting_controls_updated
before update on public.profile_posting_controls
for each row execute function public.set_updated_at();
alter table public.profile_posting_controls enable row level security;
create policy posting_controls_self_read on public.profile_posting_controls
for select to authenticated using (profile_id=auth.uid());
create policy posting_controls_platform_read on public.profile_posting_controls
for select to authenticated using (public.has_platform_permission('platform.users.read'));

create function public.can_profile_post(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pc.posting_allowed
      or (pc.restricted_until is not null and pc.restricted_until <= now())
    from public.profile_posting_controls pc
    where pc.profile_id = target_profile_id
  ), true);
$$;
revoke all on function public.can_profile_post(uuid) from public;
grant execute on function public.can_profile_post(uuid) to authenticated;

-- Published branch-specific announcements are visible only inside that Expression.
drop policy if exists announcements_feed on public.announcements;
create policy announcements_feed on public.announcements
for select to authenticated
using (
  status='published'
  and public.can_read_branch_scoped_resource(organization_id,branch_id)
);

-- Events preserve explicit public visibility, but member/private branch content is exact-Expression only.
drop policy if exists events_member_read on public.events;
create policy events_member_read on public.events
for select to authenticated
using (
  status <> 'draft'
  and (
    visibility='public'
    or (
      visibility in ('members','private')
      and public.can_read_branch_scoped_resource(organization_id,branch_id)
    )
  )
);

-- Occurrences inherit the parent event's scope instead of organization-wide membership.
drop policy if exists occurrences_member_read on public.event_occurrences;
create policy occurrences_member_read on public.event_occurrences
for select to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id=event_id
      and e.organization_id=event_occurrences.organization_id
      and e.status<>'draft'
      and (
        e.visibility='public'
        or (e.visibility in ('members','private') and public.can_read_branch_scoped_resource(e.organization_id,e.branch_id))
      )
  )
);

-- Expression directory/operations metadata is likewise limited to the exact Expression.
drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments
for select to authenticated using (public.can_read_branch_scoped_resource(organization_id,branch_id));

drop policy if exists ministries_read on public.ministries;
create policy ministries_read on public.ministries
for select to authenticated using (public.can_read_branch_scoped_resource(organization_id,branch_id));

drop policy if exists volunteer_opportunities_read on public.volunteer_opportunities;
create policy volunteer_opportunities_read on public.volunteer_opportunities
for select to authenticated using (public.can_read_branch_scoped_resource(organization_id,branch_id));

-- Discoverable Expression groups require Expression membership. Private groups require
-- actual group membership or management authority.
drop policy if exists groups_discover on public.groups;
create policy groups_discover on public.groups
for select to authenticated
using (
  (
    visibility='members'
    and public.can_read_branch_scoped_resource(organization_id,branch_id)
  )
  or (
    visibility='private'
    and exists (
      select 1
      from public.group_memberships gm
      join public.memberships m on m.id=gm.membership_id
      where gm.group_id=groups.id
        and gm.status='active'
        and m.profile_id=auth.uid()
    )
  )
  or public.has_permission(organization_id,'groups.manage',branch_id)
);

-- Stream chat/reactions can never be broader than the stream's own visibility.
drop policy if exists stream_messages_read on public.stream_messages;
create policy stream_messages_read on public.stream_messages
for select to authenticated
using (
  exists (
    select 1 from public.live_streams s
    where s.id=stream_id
      and s.organization_id=stream_messages.organization_id
      and public.can_read_social_scope(s.organization_id,s.visibility,s.branch_id,s.group_id)
  )
);

drop policy if exists stream_reactions_read on public.stream_reactions;
create policy stream_reactions_read on public.stream_reactions
for select to authenticated
using (
  exists (
    select 1 from public.live_streams s
    where s.id=stream_id
      and s.organization_id=stream_reactions.organization_id
      and public.can_read_social_scope(s.organization_id,s.visibility,s.branch_id,s.group_id)
  )
);

create or replace function public.publish_social_post(
  target_organization_id uuid,
  target_visibility public.content_visibility,
  post_body text,
  target_branch_id uuid default null,
  target_group_id uuid default null,
  post_media jsonb default '[]'::jsonb
)
returns public.social_posts
language plpgsql
security definer
set search_path=''
as $$
declare
  member public.memberships;
  result public.social_posts;
begin
  select * into member
  from public.memberships
  where organization_id=target_organization_id
    and profile_id=auth.uid()
    and status='active';
  if not found then raise exception using errcode='42501',message='Active membership required'; end if;
  if member.branch_id is null then raise exception using errcode='42501',message='Expression membership required to publish'; end if;
  if not public.can_profile_post(auth.uid()) then raise exception using errcode='42501',message='Posting is restricted for this account'; end if;
  if jsonb_typeof(post_media)<>'array' then raise exception using errcode='22023',message='Post media must be an array'; end if;

  if target_visibility='public' then
    if target_group_id is not null then raise exception using errcode='22023',message='Public posts cannot target a private group'; end if;
    if target_branch_id is not null and target_branch_id<>member.branch_id then
      raise exception using errcode='42501',message='You can only publish to your own Expression';
    end if;
  elsif target_visibility='branch' then
    if target_branch_id is null or target_branch_id<>member.branch_id then
      raise exception using errcode='42501',message='You can only publish member content to your own Expression';
    end if;
    if target_group_id is not null then raise exception using errcode='22023',message='Expression posts cannot target a group simultaneously'; end if;
  elsif target_visibility='group' then
    if target_group_id is null or not exists(
      select 1 from public.group_memberships gm
      where gm.group_id=target_group_id and gm.membership_id=member.id and gm.status='active'
    ) then raise exception using errcode='42501',message='Active group membership required'; end if;
    if target_branch_id is not null and target_branch_id<>member.branch_id then raise exception using errcode='42501',message='Group does not belong to your selected Expression'; end if;
  else
    -- Organization/private publishing remains a delegated moderation capability.
    if not public.has_permission(target_organization_id,'feed.post',target_branch_id) then
      raise exception using errcode='42501',message='Permission denied for this visibility';
    end if;
  end if;

  insert into public.social_posts(organization_id,author_membership_id,branch_id,group_id,visibility,body,media)
  values(target_organization_id,member.id,target_branch_id,target_group_id,target_visibility,trim(post_body),post_media)
  returning * into result;
  insert into public.domain_events(organization_id,event_type,aggregate_type,aggregate_id,actor_profile_id,payload,deduplication_key)
  values(target_organization_id,'social.post.published','social_post',result.id::text,auth.uid(),jsonb_build_object('postId',result.id,'visibility',result.visibility,'branchId',result.branch_id),'social-post:'||result.id);
  return result;
end;
$$;

revoke all on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) from public;
grant execute on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) to authenticated;

comment on table public.profile_posting_controls is 'Platform moderation control that can restrict social publishing without disabling the user account.';

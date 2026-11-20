-- Public and Expression context separation.
-- Organisation membership remains one row per person/organisation. Expression
-- membership is many-to-one and is the authority for exact Expression entry.

create table public.expression_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  membership_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('invited','active','suspended','left')),
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, profile_id),
  unique (id, organization_id),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  foreign key (membership_id, organization_id) references public.memberships(id, organization_id) on delete cascade,
  check ((status = 'active' and joined_at is not null and left_at is null) or status <> 'active')
);

create index expression_memberships_profile_active_idx
  on public.expression_memberships(profile_id, status, branch_id);
create index expression_memberships_membership_idx
  on public.expression_memberships(membership_id, status);
create trigger expression_memberships_updated before update on public.expression_memberships
for each row execute function public.set_updated_at();

insert into public.expression_memberships(
  organization_id, branch_id, membership_id, profile_id, status, joined_at
)
select m.organization_id, m.branch_id, m.id, m.profile_id,
  case when m.status = 'active' then 'active' else 'suspended' end,
  case when m.status = 'active' then coalesce(m.joined_at::timestamptz, m.created_at) end
from public.memberships m
where m.branch_id is not null
on conflict (branch_id, profile_id) do nothing;

create function public.sync_legacy_membership_expression()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.branch_id is not null then
    insert into public.expression_memberships(organization_id,branch_id,membership_id,profile_id,status,joined_at,left_at)
    values(new.organization_id,new.branch_id,new.id,new.profile_id,
      case when new.status='active' then 'active' else 'suspended' end,
      case when new.status='active' then coalesce(new.joined_at::timestamptz,now()) end,
      null)
    on conflict(branch_id,profile_id) do update
      set membership_id=excluded.membership_id,
          status=excluded.status,
          joined_at=coalesce(public.expression_memberships.joined_at,excluded.joined_at),
          left_at=case when excluded.status='active' then null else public.expression_memberships.left_at end;
  end if;
  return new;
end; $$;
revoke all on function public.sync_legacy_membership_expression() from public;
create trigger memberships_sync_expression
after insert or update of branch_id,status on public.memberships
for each row execute function public.sync_legacy_membership_expression();

create table public.expression_invite_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (char_length(code_hint) between 4 and 12),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit between 1 and 100000),
  usage_count integer not null default 0 check (usage_count >= 0),
  created_by uuid not null references public.profiles(id),
  revoked_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  check (expires_at is null or expires_at > created_at),
  check (usage_limit is null or usage_count <= usage_limit),
  check ((status = 'revoked' and revoked_at is not null and revoked_by is not null) or status <> 'revoked')
);

create index expression_invite_codes_manage_idx
  on public.expression_invite_codes(organization_id, branch_id, status, created_at desc);
create trigger expression_invite_codes_updated before update on public.expression_invite_codes
for each row execute function public.set_updated_at();

alter table public.expression_memberships enable row level security;
alter table public.expression_invite_codes enable row level security;

create or replace function public.is_expression_member(
  target_organization_id uuid,
  target_branch_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.expression_memberships em
    join public.memberships m
      on m.id = em.membership_id and m.organization_id = em.organization_id
    join public.organizations o on o.id = em.organization_id
    join public.branches b
      on b.id = em.branch_id and b.organization_id = em.organization_id
    where em.organization_id = target_organization_id
      and em.branch_id = target_branch_id
      and em.profile_id = auth.uid()
      and em.status = 'active'
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
      and b.is_active
  );
$$;

revoke all on function public.is_expression_member(uuid,uuid) from public;
grant execute on function public.is_expression_member(uuid,uuid) to anon,authenticated;

create policy expression_memberships_self_read on public.expression_memberships
for select to authenticated using (profile_id = auth.uid());

create policy expression_memberships_scoped_manage on public.expression_memberships
for all to authenticated
using (public.has_permission(organization_id, 'members.update', branch_id))
with check (public.has_permission(organization_id, 'members.update', branch_id));

create policy expression_invite_codes_scoped_manage on public.expression_invite_codes
for select to authenticated
using (public.has_permission(organization_id, 'members.invite', branch_id));

create or replace function public.has_permission(
  target_organization_id uuid,
  requested_permission text,
  target_branch_id uuid default null
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select requested_permission not like 'platform.%'
    and (target_branch_id is null or public.is_expression_member(target_organization_id, target_branch_id))
    and exists (
      select 1
      from public.memberships m
      join public.organizations o on o.id = m.organization_id
      join public.role_assignments ra
        on ra.membership_id = m.id and ra.organization_id = m.organization_id
      join public.role_permissions rp on rp.role_id = ra.role_id
      join public.permissions p on p.code = rp.permission_code
      where m.profile_id = auth.uid()
        and m.organization_id = target_organization_id
        and m.status = 'active'
        and o.status = 'active'
        and p.code = requested_permission
        and p.is_active
        and (ra.expires_at is null or ra.expires_at > now())
        and (ra.branch_id is null or ra.branch_id = target_branch_id)
        and (
          target_branch_id is null
          or exists (
            select 1 from public.branches b
            where b.id = target_branch_id
              and b.organization_id = target_organization_id
              and b.is_active
          )
        )
    );
$$;

create or replace function public.can_read_social_scope(
  target_organization_id uuid,
  target_visibility public.content_visibility,
  target_branch_id uuid,
  target_group_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select case target_visibility
    when 'public' then true
    when 'organization' then public.is_organization_member(target_organization_id)
    when 'branch' then public.is_expression_member(target_organization_id,target_branch_id)
    when 'group' then public.is_expression_member(target_organization_id,target_branch_id) and exists(
      select 1 from public.group_memberships gm
      join public.memberships m on m.id=gm.membership_id
      where gm.group_id=target_group_id and gm.status='active'
        and m.profile_id=auth.uid() and m.status='active'
    )
    when 'private' then false
    else false
  end;
$$;

create function public.preview_expression_invite_code(raw_code text)
returns table (organization_name text, expression_name text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare invite public.expression_invite_codes;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select c.* into invite
  from public.expression_invite_codes c
  join public.organizations o on o.id=c.organization_id and o.status='active'
  join public.branches b on b.id=c.branch_id and b.organization_id=c.organization_id and b.is_active
  where c.code_hash=encode(extensions.digest(upper(regexp_replace(trim(raw_code),'[^A-Z0-9]','','g')),'sha256'),'hex')
    and c.status='active'
    and (c.expires_at is null or c.expires_at>now())
    and (c.usage_limit is null or c.usage_count<c.usage_limit);
  if not found then raise exception using errcode='P0002',message='Invite code is invalid or unavailable'; end if;
  return query select o.name,b.name,invite.expires_at
    from public.organizations o join public.branches b on b.organization_id=o.id
    where o.id=invite.organization_id and b.id=invite.branch_id;
end; $$;

create function public.redeem_expression_invite_code(raw_code text)
returns table (organization_id uuid, branch_id uuid, expression_name text)
language plpgsql security definer set search_path = '' as $$
declare invite public.expression_invite_codes; org_membership public.memberships; branch_name text; already_member boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select * into invite from public.expression_invite_codes
  where code_hash=encode(extensions.digest(upper(regexp_replace(trim(raw_code),'[^A-Z0-9]','','g')),'sha256'),'hex')
  for update;
  if not found or invite.status<>'active' then raise exception using errcode='P0002',message='Invite code is invalid or unavailable'; end if;
  if invite.expires_at is not null and invite.expires_at<=now() then
    update public.expression_invite_codes set status='expired' where id=invite.id;
    raise exception using errcode='22023',message='Invite code has expired';
  end if;
  if invite.usage_limit is not null and invite.usage_count>=invite.usage_limit then
    raise exception using errcode='22023',message='Invite code usage limit reached';
  end if;
  if not exists(select 1 from public.organizations where id=invite.organization_id and status='active')
    or not exists(select 1 from public.branches where id=invite.branch_id and organization_id=invite.organization_id and is_active)
  then raise exception using errcode='42501',message='Expression is unavailable'; end if;

  select exists(
    select 1 from public.expression_memberships
    where organization_id=invite.organization_id and branch_id=invite.branch_id
      and profile_id=auth.uid() and status='active'
  ) into already_member;
  if already_member then
    select name into branch_name from public.branches where id=invite.branch_id;
    return query select invite.organization_id,invite.branch_id,branch_name;
    return;
  end if;

  insert into public.memberships(organization_id,profile_id,status,joined_at)
  values(invite.organization_id,auth.uid(),'active',current_date)
  on conflict(organization_id,profile_id) do update
    set status='active',joined_at=coalesce(public.memberships.joined_at,current_date)
  returning * into org_membership;

  insert into public.expression_memberships(organization_id,branch_id,membership_id,profile_id,status,joined_at,left_at)
  values(invite.organization_id,invite.branch_id,org_membership.id,auth.uid(),'active',now(),null)
  on conflict(branch_id,profile_id) do update
    set membership_id=excluded.membership_id,status='active',joined_at=coalesce(public.expression_memberships.joined_at,now()),left_at=null;

  update public.expression_invite_codes set usage_count=usage_count+1 where id=invite.id;
  select name into branch_name from public.branches where id=invite.branch_id;
  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values)
  values(invite.organization_id,invite.branch_id,auth.uid(),'join','expression_membership',auth.uid()::text,
    jsonb_build_object('inviteCodeId',invite.id,'status','active'));
  return query select invite.organization_id,invite.branch_id,branch_name;
end; $$;

create function public.generate_expression_invite_code(
  target_organization_id uuid,
  target_branch_id uuid,
  validity_hours integer default 168,
  maximum_uses integer default null
)
returns table (id uuid, invite_code text, code_hint text, expires_at timestamptz, usage_limit integer)
language plpgsql security definer set search_path = '' as $$
declare raw_compact text; raw_display text; expiration timestamptz; created public.expression_invite_codes;
begin
  if not public.has_permission(target_organization_id,'members.invite',target_branch_id) then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  if validity_hours is not null and validity_hours not between 1 and 2160 then
    raise exception using errcode='22023',message='Validity must be 1-2160 hours';
  end if;
  if maximum_uses is not null and maximum_uses not between 1 and 100000 then
    raise exception using errcode='22023',message='Usage limit must be 1-100000';
  end if;
  raw_compact := upper(encode(extensions.gen_random_bytes(8),'hex'));
  raw_display := 'COT-'||substr(raw_compact,1,4)||'-'||substr(raw_compact,5,4)||'-'||substr(raw_compact,9,4)||'-'||substr(raw_compact,13,4);
  expiration := case when validity_hours is null then null else now()+make_interval(hours=>validity_hours) end;
  insert into public.expression_invite_codes(organization_id,branch_id,code_hash,code_hint,expires_at,usage_limit,created_by)
  values(target_organization_id,target_branch_id,encode(extensions.digest('COT'||raw_compact,'sha256'),'hex'),right(raw_display,4),expiration,maximum_uses,auth.uid())
  returning * into created;
  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,new_values)
  values(target_organization_id,target_branch_id,auth.uid(),'create','expression_invite_code',created.id::text,
    jsonb_build_object('expiresAt',expiration,'usageLimit',maximum_uses));
  return query select created.id,raw_display,created.code_hint,created.expires_at,created.usage_limit;
end; $$;

create function public.revoke_expression_invite_code(target_code_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare invite public.expression_invite_codes;
begin
  select * into invite from public.expression_invite_codes where id=target_code_id for update;
  if not found then raise exception using errcode='P0002',message='Invite code not found'; end if;
  if not public.has_permission(invite.organization_id,'members.invite',invite.branch_id) then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  update public.expression_invite_codes set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=invite.id and status='active';
  insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,old_values,new_values)
  values(invite.organization_id,invite.branch_id,auth.uid(),'update','expression_invite_code',invite.id::text,
    jsonb_build_object('status',invite.status),jsonb_build_object('status','revoked'));
end; $$;

revoke all on function public.preview_expression_invite_code(text) from public;
revoke all on function public.redeem_expression_invite_code(text) from public;
revoke all on function public.generate_expression_invite_code(uuid,uuid,integer,integer) from public;
revoke all on function public.revoke_expression_invite_code(uuid) from public;
grant execute on function public.preview_expression_invite_code(text) to authenticated;
grant execute on function public.redeem_expression_invite_code(text) to authenticated;
grant execute on function public.generate_expression_invite_code(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.revoke_expression_invite_code(uuid) to authenticated;

comment on table public.expression_memberships is
  'Many-to-one membership authority for deliberate entry into contained Expression spaces.';
comment on table public.expression_invite_codes is
  'Hashed, auditable, capability-managed codes for invite-only Expression membership.';

-- Replace remaining single-branch read paths with the many-Expression authority.
drop policy if exists content_items_read on public.content_items;
create policy content_items_read on public.content_items for select using (
  (status='published' and (
    visibility='public'
    or (visibility='organization' and public.is_organization_member(organization_id))
    or (visibility='branch' and public.is_expression_member(organization_id,expression_id))
    or (visibility='group' and public.can_read_social_scope(organization_id,visibility,expression_id,group_id))
  ))
  or author_profile_id=auth.uid()
  or public.has_permission(organization_id,'posts.publish',expression_id)
  or public.has_permission(organization_id,'reels.publish',expression_id)
  or public.has_permission(organization_id,'videos.publish',expression_id)
  or public.has_permission(organization_id,'sermons.publish',expression_id)
);

drop policy if exists sermons_read_published on public.sermons;
create policy sermons_read_published on public.sermons for select using (
  status='published' and (
    visibility='public'
    or (visibility='organization' and public.is_organization_member(organization_id))
    or (visibility='branch' and public.is_expression_member(organization_id,expression_id))
  )
);

drop policy if exists streams_scoped_member_read on public.live_streams;
create policy streams_scoped_member_read on public.live_streams for select to authenticated using (
  status<>'draft' and (
    visibility='public'
    or (visibility='organization' and public.is_organization_member(organization_id))
    or (visibility='branch' and public.is_expression_member(organization_id,branch_id))
    or (visibility='group' and public.can_read_social_scope(organization_id,visibility,branch_id,group_id))
  )
);

create or replace function public.can_access_stream(target_stream_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare s public.live_streams;
begin
  select * into s from public.live_streams
  where id=target_stream_id and status in('scheduled','live','ended');
  if not found then return false; end if;
  if s.visibility='public' then return true; end if;
  if auth.uid() is null then return false; end if;
  if s.visibility='organization' then return public.is_organization_member(s.organization_id); end if;
  if s.visibility='branch' then return public.is_expression_member(s.organization_id,s.branch_id); end if;
  if s.visibility='group' then return public.can_read_social_scope(s.organization_id,s.visibility,s.branch_id,s.group_id); end if;
  return public.has_permission(s.organization_id,'streams.manage',s.branch_id);
end; $$;

create or replace function public.add_stream_interaction(target_stream_id uuid,interaction_action text,interaction_value text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.live_streams; member public.memberships; created_id text; created_time timestamptz:=now();
begin
  if auth.uid() is null or not public.can_access_stream(target_stream_id) then
    raise exception using errcode='42501',message='Stream access denied';
  end if;
  select * into s from public.live_streams where id=target_stream_id;
  select * into member from public.memberships
    where organization_id=s.organization_id and profile_id=auth.uid() and status='active';
  if interaction_action='react' then
    insert into public.stream_reactions(organization_id,stream_id,profile_id,reaction)
    values(s.organization_id,s.id,auth.uid(),interaction_value) returning id::text,created_at into created_id,created_time;
  elsif interaction_action='chat' then
    if not found then raise exception using errcode='42501',message='Active membership required for chat'; end if;
    insert into public.stream_messages(organization_id,stream_id,membership_id,body)
    values(s.organization_id,s.id,member.id,trim(interaction_value)) returning id::text,created_at into created_id,created_time;
  elsif interaction_action='follow_up' then
    insert into public.live_follow_ups(organization_id,stream_id,profile_id,branch_id,type)
    values(s.organization_id,s.id,auth.uid(),s.branch_id,interaction_value::public.live_follow_up_type)
    returning id::text,created_at into created_id,created_time;
  else raise exception using errcode='22023',message='Invalid interaction'; end if;
  return jsonb_build_object('id',created_id,'accepted',true,'created_at',created_time);
end; $$;

create or replace function public.publish_social_post(
  target_organization_id uuid,
  target_visibility public.content_visibility,
  post_body text,
  target_branch_id uuid default null,
  target_group_id uuid default null,
  post_media jsonb default '[]'::jsonb
)
returns public.social_posts language plpgsql security definer set search_path='' as $$
declare member public.memberships; result public.social_posts; elevated_publisher boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select * into member from public.memberships
  where organization_id=target_organization_id and profile_id=auth.uid() and status='active';
  if not found then raise exception using errcode='42501',message='Active organisation membership required'; end if;
  if public.is_profile_restricted(auth.uid(),'posting') then raise exception using errcode='42501',message='Posting is currently restricted for this account'; end if;
  if char_length(trim(post_body)) not between 1 and 10000 then raise exception using errcode='22023',message='Post body is required'; end if;
  if jsonb_typeof(post_media)<>'array' then raise exception using errcode='22023',message='Post media must be an array'; end if;
  if target_visibility not in ('public','branch','group') then raise exception using errcode='22023',message='Unsupported community post visibility'; end if;
  if target_visibility='public' and target_group_id is not null then raise exception using errcode='22023',message='Public posts cannot target a group'; end if;
  if target_branch_id is not null and not public.is_expression_member(target_organization_id,target_branch_id) then
    raise exception using errcode='42501',message='Expression membership required';
  end if;
  if target_visibility in ('branch','group') and target_branch_id is null then
    raise exception using errcode='22023',message='Expression context is required';
  end if;

  elevated_publisher := public.has_permission(target_organization_id,'feed.post',target_branch_id);
  if target_visibility<>'public' and not elevated_publisher then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  if target_visibility='group' and not exists(
    select 1 from public.group_memberships gm
    where gm.group_id=target_group_id and gm.membership_id=member.id and gm.status='active'
  ) and not public.has_permission(target_organization_id,'feed.moderate',target_branch_id) then
    raise exception using errcode='42501',message='Group access denied';
  end if;

  insert into public.social_posts(organization_id,author_membership_id,branch_id,group_id,visibility,body,media)
  values(target_organization_id,member.id,target_branch_id,target_group_id,target_visibility,trim(post_body),post_media)
  returning * into result;
  insert into public.domain_events(organization_id,event_type,aggregate_type,aggregate_id,actor_profile_id,payload,deduplication_key)
  values(target_organization_id,'social.post.published','social_post',result.id::text,auth.uid(),
    jsonb_build_object('postId',result.id,'visibility',result.visibility,'branchId',result.branch_id),'social-post:'||result.id);
  return result;
end; $$;

create trigger audit_expression_memberships
after insert or update or delete on public.expression_memberships
for each row execute function public.audit_row_change();

create or replace function public.can_read_giving_scope(target_organization_id uuid,target_branch_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select case when auth.uid() is null then false
    when target_branch_id is null then public.is_organization_member(target_organization_id)
    else public.is_expression_member(target_organization_id,target_branch_id)
  end;
$$;

create function public.enforce_group_expression_membership()
returns trigger language plpgsql security definer set search_path='' as $$
declare group_row public.groups; actor_profile uuid;
begin
  select * into group_row from public.groups where id=new.group_id;
  select profile_id into actor_profile from public.memberships where id=new.membership_id;
  if group_row.branch_id is not null
    and not exists(
      select 1 from public.expression_memberships em
      where em.organization_id=group_row.organization_id and em.branch_id=group_row.branch_id
        and em.profile_id=actor_profile and em.status='active'
    ) then raise exception using errcode='42501',message='This group belongs to another Expression';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_group_expression_membership() from public;
create trigger group_memberships_expression_guard
before insert or update of group_id,membership_id,status on public.group_memberships
for each row execute function public.enforce_group_expression_membership();

create or replace function public.expression_birthdays(
  target_organization_id uuid,target_branch_id uuid,days_ahead integer default 60
)
returns table(profile_id uuid,display_name text,username text,avatar_url text,birthday_month integer,birthday_day integer,next_birthday date,days_until integer)
language plpgsql stable security definer set search_path='' as $$
declare branch_timezone text; local_today date;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if days_ahead<0 or days_ahead>366 then raise exception using errcode='22023',message='days_ahead must be between 0 and 366'; end if;
  select b.timezone into branch_timezone from public.branches b
  where b.id=target_branch_id and b.organization_id=target_organization_id and b.is_active;
  if branch_timezone is null then raise exception using errcode='P0002',message='Expression not found'; end if;
  if not public.is_expression_member(target_organization_id,target_branch_id)
    and not public.has_permission(target_organization_id,'members.read',target_branch_id)
  then raise exception using errcode='42501',message='Expression membership required'; end if;
  local_today := (now() at time zone branch_timezone)::date;
  return query with eligible as (
    select p.id,p.display_name,p.username,p.avatar_url,p.birthday,
      public.birthday_occurrence(p.birthday,extract(year from local_today)::integer) this_year
    from public.expression_memberships em join public.profiles p on p.id=em.profile_id
    where em.organization_id=target_organization_id and em.branch_id=target_branch_id
      and em.status='active' and p.birthday is not null and p.birthday_expression_visible
  ), resolved as (
    select e.*,case when e.this_year>=local_today then e.this_year
      else public.birthday_occurrence(e.birthday,extract(year from local_today)::integer+1) end occurrence
    from eligible e
  ) select r.id,r.display_name,r.username,r.avatar_url,extract(month from r.birthday)::integer,
    extract(day from r.birthday)::integer,r.occurrence,(r.occurrence-local_today)::integer
  from resolved r where r.occurrence<=local_today+days_ahead
  order by r.occurrence,lower(r.display_name),r.id;
end; $$;

create or replace function public.enqueue_expression_birthday_notifications(reference_time timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
  with birthday_people as (
    select b.organization_id,b.id branch_id,b.name branch_name,
      (reference_time at time zone b.timezone)::date local_date,p.id birthday_profile_id,p.display_name,
      extract(month from p.birthday)::integer birthday_month,extract(day from p.birthday)::integer birthday_day
    from public.branches b join public.expression_memberships em
      on em.organization_id=b.organization_id and em.branch_id=b.id and em.status='active'
    join public.profiles p on p.id=em.profile_id
    where b.is_active and p.birthday is not null and p.birthday_expression_visible
      and extract(month from p.birthday)::integer=extract(month from (reference_time at time zone b.timezone)::date)::integer
      and extract(day from p.birthday)::integer=extract(day from (reference_time at time zone b.timezone)::date)::integer
  ), recipients as (
    select bp.*,recipient.profile_id recipient_profile_id from birthday_people bp
    join public.expression_memberships recipient on recipient.organization_id=bp.organization_id
      and recipient.branch_id=bp.branch_id and recipient.status='active'
  ) insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
  select r.organization_id,r.recipient_profile_id,
    'expression_birthday:'||r.birthday_profile_id::text||':'||to_char(r.local_date,'YYYYMMDD'),
    case when r.recipient_profile_id=r.birthday_profile_id then 'Happy Birthday!' else 'Birthday today · '||r.branch_name end,
    case when r.recipient_profile_id=r.birthday_profile_id then 'Your Expression is celebrating with you today. Happy birthday, '||r.display_name||'!'
      else r.display_name||' is celebrating a birthday today.' end,
    jsonb_build_object('kind','expression_birthday','branchId',r.branch_id,'birthdayProfileId',r.birthday_profile_id,
      'birthdayMonth',r.birthday_month,'birthdayDay',r.birthday_day,'localDate',r.local_date)
  from recipients r on conflict do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end; $$;

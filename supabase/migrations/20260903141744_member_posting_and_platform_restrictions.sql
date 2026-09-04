-- Active Expression members may publish ordinary public community posts without an admin role.
-- Platform Authority can separately restrict posting without banning the entire identity.

create table public.platform_user_restrictions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  restriction_code text not null check (restriction_code ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  is_active boolean not null default true,
  reason text not null default '',
  imposed_by uuid not null references public.profiles(id) on delete restrict,
  imposed_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lifted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(profile_id,restriction_code),
  check (expires_at is null or expires_at > imposed_at)
);

create trigger platform_user_restrictions_updated
before update on public.platform_user_restrictions
for each row execute function public.set_updated_at();

alter table public.platform_user_restrictions enable row level security;
create policy platform_user_restrictions_self_read on public.platform_user_restrictions
for select to authenticated using (profile_id=auth.uid());
create policy platform_user_restrictions_authority_read on public.platform_user_restrictions
for select to authenticated using (public.has_platform_permission('platform.users.read'));

create or replace function public.is_profile_restricted(target_profile_id uuid,requested_restriction text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.platform_user_restrictions r
    where r.profile_id=target_profile_id
      and r.restriction_code=requested_restriction
      and r.is_active
      and (r.expires_at is null or r.expires_at>now())
  );
$$;

revoke all on function public.is_profile_restricted(uuid,text) from public;
grant execute on function public.is_profile_restricted(uuid,text) to authenticated;

create or replace function public.set_platform_user_restriction(
  target_profile_id uuid,
  target_restriction text,
  enable_restriction boolean,
  restriction_reason text default '',
  restriction_expires_at timestamptz default null
)
returns public.platform_user_restrictions
language plpgsql
security definer
set search_path=''
as $$
declare result public.platform_user_restrictions;
begin
  if not public.has_platform_permission('platform.users.manage') then
    raise exception using errcode='42501',message='Permission denied';
  end if;
  if target_restriction not in ('posting') then
    raise exception using errcode='22023',message='Unsupported restriction';
  end if;
  if enable_restriction and char_length(trim(coalesce(restriction_reason,'')))<3 then
    raise exception using errcode='22023',message='A restriction reason is required';
  end if;
  if restriction_expires_at is not null and restriction_expires_at<=now() then
    raise exception using errcode='22023',message='Restriction expiration must be in the future';
  end if;
  if not exists(select 1 from public.profiles where id=target_profile_id) then
    raise exception using errcode='P0002',message='Profile not found';
  end if;

  insert into public.platform_user_restrictions(profile_id,restriction_code,is_active,reason,imposed_by,imposed_at,expires_at,lifted_by,lifted_at)
  values(target_profile_id,target_restriction,enable_restriction,trim(coalesce(restriction_reason,'')),auth.uid(),now(),restriction_expires_at,case when enable_restriction then null else auth.uid() end,case when enable_restriction then null else now() end)
  on conflict(profile_id,restriction_code) do update set
    is_active=excluded.is_active,
    reason=excluded.reason,
    imposed_by=case when excluded.is_active then auth.uid() else public.platform_user_restrictions.imposed_by end,
    imposed_at=case when excluded.is_active then now() else public.platform_user_restrictions.imposed_at end,
    expires_at=case when excluded.is_active then excluded.expires_at else null end,
    lifted_by=case when excluded.is_active then null else auth.uid() end,
    lifted_at=case when excluded.is_active then null else now() end
  returning * into result;

  insert into public.platform_audit_log(actor_profile_id,action,target_type,target_id,metadata)
  values(auth.uid(),case when enable_restriction then 'identity.posting_restricted' else 'identity.posting_restored' end,'identity',target_profile_id::text,jsonb_build_object('reason',restriction_reason,'expiresAt',restriction_expires_at));
  return result;
end;
$$;

revoke all on function public.set_platform_user_restriction(uuid,text,boolean,text,timestamptz) from public;
grant execute on function public.set_platform_user_restriction(uuid,text,boolean,text,timestamptz) to authenticated;

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
  elevated_publisher boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select * into member from public.memberships
  where organization_id=target_organization_id and profile_id=auth.uid() and status='active';
  if not found then raise exception using errcode='42501',message='Active membership required'; end if;
  if member.branch_id is null then raise exception using errcode='42501',message='Expression membership required to post'; end if;
  if public.is_profile_restricted(auth.uid(),'posting') then raise exception using errcode='42501',message='Posting is currently restricted for this account'; end if;
  if char_length(trim(post_body)) not between 1 and 10000 then raise exception using errcode='22023',message='Post body is required'; end if;
  if jsonb_typeof(post_media)<>'array' then raise exception using errcode='22023',message='Post media must be an array'; end if;

  elevated_publisher := public.has_permission(target_organization_id,'feed.post',target_branch_id);

  if not elevated_publisher then
    -- Ordinary members may publish only to the church-wide public feed or their own Expression public feed.
    if target_visibility<>'public' or target_group_id is not null then
      raise exception using errcode='42501',message='Members may publish only public community posts';
    end if;
    if target_branch_id is not null and target_branch_id<>member.branch_id then
      raise exception using errcode='42501',message='You may post only to your own Expression';
    end if;
  else
    if target_visibility='branch' and (target_branch_id is null or member.branch_id<>target_branch_id)
      and not public.has_permission(target_organization_id,'feed.moderate',target_branch_id) then
      raise exception using errcode='42501',message='Expression access denied';
    end if;
    if target_visibility='group' and not exists(
      select 1 from public.group_memberships
      where group_id=target_group_id and membership_id=member.id and status='active'
    ) and not public.has_permission(target_organization_id,'feed.moderate',target_branch_id) then
      raise exception using errcode='42501',message='Group access denied';
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

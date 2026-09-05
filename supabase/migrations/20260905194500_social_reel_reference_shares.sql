-- Allow ordinary Expression members to reshare an already-public Reel into
-- General Community without granting Reel publication authority or duplicating media.

create or replace function public.publish_social_reel_share(
  target_organization_id uuid,
  target_reel_id uuid,
  post_body text default ''
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.memberships;
  shared_reel public.reels;
  content_row public.content_items;
  active_expression_member boolean := false;
  elevated_publisher boolean := false;
  result public.social_posts;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into member
  from public.memberships
  where organization_id = target_organization_id
    and profile_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception using errcode='42501', message='Active organisation membership required';
  end if;

  if public.is_profile_restricted(auth.uid(), 'posting') then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
  end if;

  select exists (
    select 1
    from public.expression_memberships em
    join public.branches b on b.id = em.branch_id
    where em.organization_id = target_organization_id
      and em.profile_id = auth.uid()
      and em.status = 'active'
      and b.is_active = true
  ) into active_expression_member;

  select exists (
    select 1
    from public.role_assignments ra
    join public.role_permissions rp on rp.role_id = ra.role_id
    join public.permissions p on p.code = rp.permission_code
    where ra.membership_id = member.id
      and ra.organization_id = target_organization_id
      and rp.permission_code = 'feed.post'
      and p.is_active = true
      and (ra.expires_at is null or ra.expires_at > now())
  ) into elevated_publisher;

  if not active_expression_member and not elevated_publisher then
    raise exception using errcode='42501', message='Active Expression membership required for General Community publishing';
  end if;

  select r.* into shared_reel
  from public.reels r
  where r.id = target_reel_id
    and r.organization_id = target_organization_id;

  if not found then
    raise exception using errcode='P0002', message='Reel not found';
  end if;

  select * into content_row
  from public.content_items ci
  where ci.id = shared_reel.id
    and ci.organization_id = target_organization_id
    and ci.content_type = 'reel'
    and ci.visibility = 'public'
    and ci.status = 'published';

  if not found then
    raise exception using errcode='42501', message='Only published public Reels can be shared to General Community';
  end if;

  result := public.publish_social_post(
    target_organization_id,
    'public',
    left(trim(coalesce(post_body, '')), 10000),
    null,
    null,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'reel_reference',
        'reelId', shared_reel.id,
        'mediaAssetId', shared_reel.media_asset_id,
        'caption', shared_reel.caption
      )
    )
  );

  update public.reels
  set shares_count = coalesce(shares_count, 0) + 1
  where id = shared_reel.id;

  return result;
end;
$$;

revoke all on function public.publish_social_reel_share(uuid,uuid,text) from public, anon;
grant execute on function public.publish_social_reel_share(uuid,uuid,text) to authenticated, service_role;

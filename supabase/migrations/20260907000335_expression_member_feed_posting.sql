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
as $function$
declare
  member public.memberships;
  result public.social_posts;
  elevated_publisher boolean := false;
  content_id uuid;
  normalized_body text := trim(coalesce(post_body, ''));
  normalized_media jsonb := coalesce(post_media, '[]'::jsonb);
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = target_organization_id
      and o.status = 'active'
  ) then
    raise exception using errcode='22023', message='This church community is not available';
  end if;

  select * into member
  from public.memberships
  where organization_id = target_organization_id
    and profile_id = auth.uid()
    and status = 'active'
  order by created_at asc
  limit 1;

  if public.is_profile_restricted(auth.uid(), 'posting') then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
  end if;

  if jsonb_typeof(normalized_media) <> 'array' then
    raise exception using errcode='22023', message='Post media must be an array';
  end if;
  if char_length(normalized_body) > 10000 then
    raise exception using errcode='22023', message='Post body must be 10,000 characters or fewer';
  end if;
  if char_length(normalized_body) = 0 and jsonb_array_length(normalized_media) = 0 then
    raise exception using errcode='22023', message='Write something or attach media before publishing';
  end if;

  if target_visibility is null or target_visibility not in ('public','branch','group') then
    raise exception using errcode='22023', message='Unsupported community post visibility';
  end if;
  if target_visibility = 'group' and target_group_id is null then
    raise exception using errcode='22023', message='Group context is required';
  end if;
  if target_visibility <> 'group' and target_group_id is not null then
    raise exception using errcode='22023', message='Group context is only valid for group posts';
  end if;
  if target_visibility in ('branch','group') and target_branch_id is null then
    raise exception using errcode='22023', message='Expression context is required';
  end if;

  if target_branch_id is not null then
    if member.id is null then
      raise exception using errcode='42501', message='Active organisation membership required for scoped publishing';
    end if;
    if not public.is_expression_member(target_organization_id, target_branch_id) then
      raise exception using errcode='42501', message='Expression membership required';
    end if;
  elsif target_group_id is not null then
    raise exception using errcode='22023', message='Expression context is required for group posts';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id,
    'feed.post',
    target_branch_id
  );

  -- Every active member of an Expression can publish into that Expression feed.
  -- feed.post remains elevated authority for group publishing and broader
  -- publishing workflows, while branch visibility preserves Expression privacy.
  if target_visibility = 'group' and not elevated_publisher then
    raise exception using errcode='42501', message='Permission denied';
  end if;

  if target_visibility = 'group' then
    if member.id is null then
      raise exception using errcode='42501', message='Active organisation membership required for group publishing';
    end if;
    if not exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = target_group_id
        and gm.membership_id = member.id
        and gm.status = 'active'
    )
    and not public.has_permission(
      target_organization_id,
      'feed.moderate',
      target_branch_id
    ) then
      raise exception using errcode='42501', message='Group access denied';
    end if;
  end if;

  insert into public.content_items (
    organization_id, expression_id, group_id, author_profile_id,
    content_type, visibility, status, published_at
  )
  values (
    target_organization_id, target_branch_id, target_group_id, auth.uid(),
    'post', target_visibility, 'published', now()
  )
  returning id into content_id;

  insert into public.social_posts (
    id, organization_id, author_membership_id, branch_id, group_id,
    visibility, status, body, media, published_at
  )
  values (
    content_id, target_organization_id, member.id, target_branch_id, target_group_id,
    target_visibility, 'published', normalized_body, normalized_media, now()
  )
  returning * into result;

  insert into public.domain_events (
    organization_id, event_type, aggregate_type, aggregate_id,
    actor_profile_id, payload, deduplication_key
  )
  values (
    target_organization_id,
    'social.post.published',
    'social_post',
    result.id::text,
    auth.uid(),
    jsonb_build_object(
      'postId', result.id,
      'visibility', result.visibility,
      'branchId', result.branch_id,
      'groupId', result.group_id
    ),
    'social-post:' || result.id
  );

  return result;
end
$function$;

revoke all on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.publish_social_post(uuid,public.content_visibility,text,uuid,uuid,jsonb) to service_role;

-- Add canonical in-app quote sharing for social posts without duplicating media.
-- Public posts may be quoted into General COT. Expression posts may only be
-- quoted back into the same Expression. Group/private content never escapes
-- its original scope.

create or replace function public.publish_social_post_share(
  target_organization_id uuid,
  target_post_id uuid,
  post_body text default '',
  target_branch_id uuid default null
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  shared_post public.social_posts;
  result public.social_posts;
  elevated_publisher boolean := false;
  normalized_body text := trim(coalesce(post_body, ''));
  target_visibility public.content_visibility;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not public.can_profile_post(auth.uid()) then
    raise exception using errcode='42501', message='Posting is currently restricted for this account';
  end if;

  select p.* into shared_post
  from public.social_posts p
  where p.id = target_post_id
    and p.organization_id = target_organization_id
    and p.status = 'published';

  if not found then
    raise exception using errcode='P0002', message='Post not found';
  end if;

  if shared_post.group_id is not null or shared_post.visibility not in ('public','branch') then
    raise exception using errcode='42501', message='This post cannot be shared outside its current conversation';
  end if;

  if target_branch_id is null then
    if shared_post.visibility <> 'public' then
      raise exception using errcode='42501', message='Only public posts can be shared to General COT';
    end if;
    if not public.can_profile_post_publicly(auth.uid()) then
      raise exception using errcode='42501', message='Public posting is currently unavailable for this account';
    end if;
    target_visibility := 'public';
    elevated_publisher := public.has_permission(target_organization_id, 'feed.post', null);
    normalized_body := left(normalized_body, case when elevated_publisher then 10000 else 2200 end);
  else
    if shared_post.visibility = 'branch' and shared_post.branch_id is distinct from target_branch_id then
      raise exception using errcode='42501', message='Expression posts can only be shared inside the same Expression';
    end if;
    if not public.is_expression_member(target_organization_id, target_branch_id) then
      raise exception using errcode='42501', message='Expression membership required';
    end if;
    target_visibility := 'branch';
    normalized_body := left(normalized_body, 10000);
  end if;

  result := public.publish_social_post(
    target_organization_id,
    target_visibility,
    normalized_body,
    target_branch_id,
    null,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'post_reference',
        'postId', shared_post.id
      )
    )
  );

  return result;
end
$function$;

revoke all on function public.publish_social_post_share(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.publish_social_post_share(uuid, uuid, text, uuid) to authenticated, service_role;

comment on function public.publish_social_post_share(uuid, uuid, text, uuid)
is 'Creates an in-app quoted social post by canonical reference. Public quotes stay public; Expression quotes stay in the same Expression.';

-- Canonicalize social posts onto content_items and move Community engagement
-- to the profile-based universal engagement layer.

insert into public.content_items (
  id, organization_id, expression_id, group_id, author_profile_id,
  content_type, visibility, status, published_at, created_at, updated_at
)
select
  sp.id, sp.organization_id, sp.branch_id, sp.group_id, m.profile_id,
  'post'::public.content_item_type,
  sp.visibility,
  case sp.status::text
    when 'published' then 'published'::public.publication_status
    when 'draft' then 'draft'::public.publication_status
    else 'archived'::public.publication_status
  end,
  case when sp.status::text = 'published' then sp.published_at else null end,
  sp.created_at,
  coalesce(sp.edited_at, sp.updated_at, sp.created_at)
from public.social_posts sp
join public.memberships m
  on m.id = sp.author_membership_id
 and m.organization_id = sp.organization_id
where not exists (
  select 1 from public.content_items ci where ci.id = sp.id
);

do $check$
begin
  if exists (
    select 1
    from public.social_posts sp
    left join public.content_items ci on ci.id = sp.id
    where ci.id is null
       or ci.organization_id <> sp.organization_id
       or ci.content_type <> 'post'::public.content_item_type
  ) then
    raise exception 'Social post/content item identity backfill failed';
  end if;
end
$check$;

insert into public.content_comments (
  id, content_item_id, author_profile_id, parent_comment_id,
  body, is_hidden, created_at, updated_at
)
select
  sc.id, sc.post_id, m.profile_id, null,
  sc.body, sc.is_hidden, sc.created_at, sc.updated_at
from public.social_comments sc
join public.memberships m
  on m.id = sc.author_membership_id
 and m.organization_id = sc.organization_id
join public.content_items ci
  on ci.id = sc.post_id
 and ci.organization_id = sc.organization_id
where not exists (
  select 1 from public.content_comments cc where cc.id = sc.id
);

update public.content_comments cc
set parent_comment_id = sc.parent_comment_id
from public.social_comments sc
where cc.id = sc.id
  and cc.content_item_id = sc.post_id
  and sc.parent_comment_id is not null
  and exists (
    select 1 from public.content_comments parent where parent.id = sc.parent_comment_id
  );

insert into public.content_reactions (
  content_item_id, profile_id, reaction, created_at
)
select sr.post_id, m.profile_id, sr.reaction, sr.created_at
from public.social_reactions sr
join public.memberships m
  on m.id = sr.membership_id
 and m.organization_id = sr.organization_id
join public.content_items ci
  on ci.id = sr.post_id
 and ci.organization_id = sr.organization_id
on conflict (content_item_id, profile_id) do nothing;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.social_posts'::regclass
      and conname = 'social_posts_content_item_fkey'
  ) then
    alter table public.social_posts
      add constraint social_posts_content_item_fkey
      foreign key (id, organization_id)
      references public.content_items(id, organization_id)
      on delete cascade;
  end if;
end
$constraint$;

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
set search_path = ''
as $function$
declare
  member public.memberships;
  result public.social_posts;
  elevated_publisher boolean;
  content_id uuid;
  normalized_body text := trim(coalesce(post_body, ''));
  normalized_media jsonb := coalesce(post_media, '[]'::jsonb);
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
  if target_branch_id is not null
     and not public.is_expression_member(target_organization_id, target_branch_id) then
    raise exception using errcode='42501', message='Expression membership required';
  end if;
  if target_visibility in ('branch','group') and target_branch_id is null then
    raise exception using errcode='22023', message='Expression context is required';
  end if;

  elevated_publisher := public.has_permission(
    target_organization_id, 'feed.post', target_branch_id
  );
  if target_visibility <> 'public' and not elevated_publisher then
    raise exception using errcode='42501', message='Permission denied';
  end if;

  if target_visibility = 'group'
     and not exists (
       select 1
       from public.group_memberships gm
       where gm.group_id = target_group_id
         and gm.membership_id = member.id
         and gm.status = 'active'
     )
     and not public.has_permission(
       target_organization_id, 'feed.moderate', target_branch_id
     ) then
    raise exception using errcode='42501', message='Group access denied';
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
      'branchId', result.branch_id
    ),
    'social-post:' || result.id
  );

  return result;
end
$function$;

revoke all on function public.publish_social_post(
  uuid, public.content_visibility, text, uuid, uuid, jsonb
) from public;
grant execute on function public.publish_social_post(
  uuid, public.content_visibility, text, uuid, uuid, jsonb
) to authenticated;

drop policy if exists reactions_self on public.content_reactions;
create policy reactions_self
on public.content_reactions
for all to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_reactions.content_item_id
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_reactions.content_item_id
  )
);

drop policy if exists comments_manage on public.content_comments;
create policy comments_manage
on public.content_comments
for all to authenticated
using (
  author_profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
  )
)
with check (
  author_profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_comments.content_item_id
  )
);

drop policy if exists bookmarks_self on public.content_bookmarks;
create policy bookmarks_self
on public.content_bookmarks
for all to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_bookmarks.content_item_id
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_bookmarks.content_item_id
  )
);

drop policy if exists playback_self on public.content_playback_progress;
create policy playback_self
on public.content_playback_progress
for all to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_playback_progress.content_item_id
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.content_items ci
    where ci.id = content_playback_progress.content_item_id
  )
);

do $verify$
declare
  legacy_comment_count bigint;
  canonical_comment_count bigint;
  legacy_reaction_count bigint;
  canonical_reaction_count bigint;
begin
  select count(*) into legacy_comment_count from public.social_comments;
  select count(*) into canonical_comment_count
  from public.content_comments cc
  join public.social_posts sp on sp.id = cc.content_item_id;

  select count(*) into legacy_reaction_count from public.social_reactions;
  select count(*) into canonical_reaction_count
  from public.content_reactions cr
  join public.social_posts sp on sp.id = cr.content_item_id;

  if canonical_comment_count < legacy_comment_count then
    raise exception 'Legacy social comments were not fully preserved';
  end if;
  if canonical_reaction_count < legacy_reaction_count then
    raise exception 'Legacy social reactions were not fully preserved';
  end if;
end
$verify$;

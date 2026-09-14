-- Keep denormalized Reel/Watch counters consistent with the canonical engagement tables.
-- The trigger helper is private and cannot be called from the Data API. SECURITY
-- DEFINER is used only so a normal member reaction/comment can update derived
-- counters without granting that member UPDATE permission on the media record.

create or replace function private.sync_media_engagement_counters(target_content_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reaction_total bigint;
  comment_total bigint;
begin
  if target_content_id is null then return; end if;

  select count(*) into reaction_total
  from public.content_reactions r
  where r.content_item_id = target_content_id;

  select count(*) into comment_total
  from public.content_comments c
  where c.content_item_id = target_content_id
    and c.is_hidden = false;

  update public.reels
  set likes_count = reaction_total,
      comments_count = comment_total
  where id = target_content_id
    and (likes_count is distinct from reaction_total or comments_count is distinct from comment_total);

  update public.videos
  set likes_count = reaction_total,
      comments_count = comment_total
  where id = target_content_id
    and (likes_count is distinct from reaction_total or comments_count is distinct from comment_total);
end;
$function$;

revoke all on function private.sync_media_engagement_counters(uuid) from public, anon, authenticated;

create or replace function private.sync_media_engagement_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    perform private.sync_media_engagement_counters(old.content_item_id);
    return old;
  end if;

  perform private.sync_media_engagement_counters(new.content_item_id);
  if tg_op = 'UPDATE' and old.content_item_id is distinct from new.content_item_id then
    perform private.sync_media_engagement_counters(old.content_item_id);
  end if;
  return new;
end;
$function$;

revoke all on function private.sync_media_engagement_trigger() from public, anon, authenticated;

drop trigger if exists sync_media_reaction_counters on public.content_reactions;
create trigger sync_media_reaction_counters
after insert or update or delete on public.content_reactions
for each row execute function private.sync_media_engagement_trigger();

drop trigger if exists sync_media_comment_counters on public.content_comments;
create trigger sync_media_comment_counters
after insert or update of content_item_id, is_hidden or delete on public.content_comments
for each row execute function private.sync_media_engagement_trigger();

-- Repair any stale aggregates already present before the trigger becomes active.
update public.reels r
set likes_count = (select count(*) from public.content_reactions x where x.content_item_id = r.id),
    comments_count = (select count(*) from public.content_comments x where x.content_item_id = r.id and x.is_hidden = false);

update public.videos v
set likes_count = (select count(*) from public.content_reactions x where x.content_item_id = v.id),
    comments_count = (select count(*) from public.content_comments x where x.content_item_id = v.id and x.is_hidden = false);

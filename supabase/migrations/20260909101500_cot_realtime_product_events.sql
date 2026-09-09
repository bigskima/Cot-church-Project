-- Realtime is part of the product contract for conversations and published content.
-- RLS remains authoritative: subscribing does not grant read access to rows.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'conversations',
    'conversation_participants',
    'messages',
    'social_posts',
    'social_comments',
    'social_reactions',
    'content_items',
    'content_comments',
    'content_reactions',
    'content_bookmarks',
    'reels',
    'videos',
    'media_assets',
    'media_renditions',
    'media_thumbnails',
    'media_tracks',
    'live_streams',
    'stream_messages',
    'stream_reactions',
    'groups',
    'group_memberships',
    'branches',
    'expression_memberships',
    'events',
    'sermons',
    'profiles',
    'notifications',
    'follows'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format('alter table public.%I replica identity full', target_table);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;

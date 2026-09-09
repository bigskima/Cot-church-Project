import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@/state/session';
import { invalidate } from '@/services/query-cache';

const realtimeUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const realtimeAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

const tableInvalidations: Record<string, string[]> = {
  conversations: ['chat:'],
  conversation_participants: ['chat:'],
  messages: ['chat:'],
  social_posts: ['mobile:home-feed:', 'mobile:community:', 'expression:'],
  social_comments: ['comments:', 'mobile:home-feed:', 'mobile:community:', 'expression:'],
  social_reactions: ['mobile:home-feed:', 'mobile:community:', 'expression:'],
  content_items: ['mobile:home-feed:', 'mobile:community:', 'expression:', 'reels:immersive:', 'watch:catalogue:'],
  content_comments: ['comments:', 'mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  content_reactions: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  content_bookmarks: ['mobile:home-feed:', 'saved:', 'reels:immersive:', 'watch:catalogue:'],
  reels: ['mobile:home-feed:', 'reels:immersive:', 'expression:'],
  videos: ['mobile:home-feed:', 'watch:catalogue:', 'expression:'],
  media_assets: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  media_renditions: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  media_thumbnails: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  media_tracks: ['reels:immersive:', 'watch:catalogue:', 'expression:'],
  live_streams: ['live:', 'leadership:streams:', 'mobile:home-feed:', 'expression:'],
  stream_messages: ['live:'],
  stream_reactions: ['live:'],
  groups: ['expression:groups:', 'expression:'],
  group_memberships: ['expression:groups:', 'expression:'],
  branches: ['expression:', 'mobile:home-feed:'],
  expression_memberships: ['expression:', 'chat:'],
  events: ['events:', 'mobile:home-feed:', 'expression:'],
  sermons: ['sermon:', 'mobile:home-feed:', 'expression:'],
  profiles: ['chat:', 'comments:', 'mobile:community:'],
  notifications: ['notifications:'],
  follows: ['mobile:home-feed:'],
};

const contextTables = new Set(['branches', 'expression_memberships']);

export function RealtimeBridge() {
  const { auth, mode, refreshContext } = useSession();
  const accessToken = auth?.session.accessToken ?? '';

  useEffect(() => {
    if (mode === 'restoring' || !realtimeUrl || !realtimeAnonKey) return;

    const client = createClient(realtimeUrl, realtimeAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });

    if (accessToken) client.realtime.setAuth(accessToken);
    let channel = client.channel(`cot-live-${accessToken ? auth?.session.expiresAt ?? 'member' : 'visitor'}`);

    for (const table of Object.keys(tableInvalidations)) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          tableInvalidations[table].forEach(invalidate);
          if (accessToken && contextTables.has(table)) refreshContext();
        },
      );
    }

    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
      void client.removeAllChannels();
    };
  }, [accessToken, auth?.session.expiresAt, mode, refreshContext]);

  return null;
}

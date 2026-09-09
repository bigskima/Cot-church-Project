import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@/state/session';
import { invalidate } from '@/services/query-cache';
import { apiUrl } from '@/api';

type RealtimeConfig = { url: string; anonKey: string };

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
    if (mode === 'restoring' || !apiUrl) return;

    let disposed = false;
    let client: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    const connect = async () => {
      try {
        const response = await fetch(`${apiUrl}/realtime-config`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const payload = await response.json() as { data?: RealtimeConfig };
        const config = payload.data;
        if (disposed || !config?.url || !config.anonKey) return;

        client = createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          },
          realtime: { params: { eventsPerSecond: 20 } },
        });

        if (accessToken) client.realtime.setAuth(accessToken);
        let nextChannel = client.channel(`cot-live-${accessToken ? auth?.session.expiresAt ?? 'member' : 'visitor'}`);

        for (const table of Object.keys(tableInvalidations)) {
          nextChannel = nextChannel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            () => {
              tableInvalidations[table].forEach(invalidate);
              if (accessToken && contextTables.has(table)) refreshContext();
            },
          );
        }

        channel = nextChannel;
        channel.subscribe();
      } catch {
        // Realtime is an enhancement over the canonical Edge Function reads.
        // A transient socket/config failure must never blank the application.
      }
    };

    void connect();
    return () => {
      disposed = true;
      if (client && channel) void client.removeChannel(channel);
      if (client) void client.removeAllChannels();
    };
  }, [accessToken, auth?.session.expiresAt, mode, refreshContext]);

  return null;
}

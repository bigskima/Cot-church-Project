import { useEffect } from 'react';
import { useSession } from '@/state/session';
import { invalidate } from '@/services/query-cache';
import { apiUrl } from '@/api';

type RealtimeConfig = { url: string; anonKey: string };

type RealtimeClient = {
  realtime: {
    setAuth: (token: string) => void;
  };
  channel: (name: string) => any;
  removeChannel: (channel: any) => Promise<unknown> | unknown;
  removeAllChannels: () => Promise<unknown> | unknown;
};

const tableInvalidations: Record<string, string[]> = {
  conversations: ['chat:'],
  conversation_participants: ['chat:'],
  messages: ['chat:'],
  direct_conversations: ['chat:'],
  direct_messages: ['chat:'],
  group_messages: ['group-chat:'],
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
  profiles: ['chat:', 'comments:', 'mobile:community:', 'mobile:home-feed:', 'public-profile:'],
  notifications: ['notifications:'],
  follows: ['mobile:home-feed:', 'public-profile:'],
};

const contextTables = new Set(['branches', 'expression_memberships']);

export function RealtimeBridge() {
  const { auth, mode, refreshContext } = useSession();
  const accessToken = auth?.session.accessToken ?? '';

  useEffect(() => {
    if (mode === 'restoring' || !apiUrl) return;

    let disposed = false;
    let client: RealtimeClient | null = null;
    let channel: any = null;

    const connect = async () => {
      try {
        // Realtime is an optional enhancement, not an application bootstrap dependency.
        // Load the Supabase realtime client only after React has rendered so a module,
        // browser, websocket or runtime-configuration failure can never blank the app.
        const [{ createClient }, response] = await Promise.all([
          import('@supabase/supabase-js'),
          fetch(`${apiUrl}/realtime-config`, {
            headers: { Accept: 'application/json' },
          }),
        ]);

        if (disposed || !response.ok) return;
        const payload = await response.json() as { data?: RealtimeConfig };
        const config = payload.data;
        if (disposed || !config?.url || !config.anonKey) return;

        const nextClient = createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          },
          realtime: { params: { eventsPerSecond: 20 } },
        }) as unknown as RealtimeClient;

        if (disposed) {
          void nextClient.removeAllChannels();
          return;
        }

        client = nextClient;
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
      } catch (error) {
        // Canonical Edge Function reads continue to work when realtime is unavailable.
        // Keep this failure isolated from the route tree and leave a development-only
        // diagnostic instead of ever failing the application shell.
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('Realtime enhancement unavailable:', error);
        }
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

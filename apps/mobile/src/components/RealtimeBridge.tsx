import { useEffect } from 'react';
import { useSession } from '@/state/session';
import { invalidate } from '@/services/query-cache';
import { apiUrl } from '@/api';
import { engagementResources } from '@/services/resource-invalidation';

type RealtimeConfig = { url: string; anonKey: string };

type RealtimeClient = {
  realtime: {
    setAuth: (token: string) => Promise<void> | void;
  };
  channel: (name: string) => any;
  removeChannel: (channel: any) => Promise<unknown> | unknown;
  removeAllChannels: () => Promise<unknown> | unknown;
};

// Tables that exist in the current production schema. Keep these on the primary
// channel so unreleased draft migrations can never disable established realtime.
const tableInvalidations: Record<string, string[]> = {
  conversations: ['chat:'],
  conversation_participants: ['chat:'],
  messages: ['chat:'],
  direct_conversations: ['chat:'],
  direct_messages: ['chat:'],
  direct_message_reactions: ['chat:'],
  group_messages: ['group-chat:'],
  group_message_reactions: ['group-chat:'],
  group_chat_sections: ['group-chat:', 'expression:groups:'],
  group_chat_section_members: ['group-chat:'],
  group_roles: ['group-chat:', 'expression:groups:'],
  group_role_assignments: ['group-chat:', 'expression:groups:'],
  group_announcements: ['group-chat:', 'expression:groups:'],
  group_events: ['group-chat:', 'expression:groups:'],
  group_giving_options: ['group-chat:', 'expression:groups:'],
  social_posts: ['mobile:home-feed:', 'mobile:community:', 'expression:'],
  social_comments: ['comments:', 'mobile:home-feed:', 'mobile:community:', 'expression:'],
  social_reactions: ['mobile:home-feed:', 'mobile:community:', 'expression:'],
  content_items: ['mobile:home-feed:', 'mobile:community:', 'expression:', 'reels:immersive:', 'watch:catalogue:'],
  content_comments: engagementResources,
  content_reactions: engagementResources,
  content_bookmarks: engagementResources,
  content_playback_progress: ['mobile:home-feed:', 'expression:', 'reels:immersive:', 'watch:catalogue:', 'playback:'],
  reels: ['mobile:home-feed:', 'reels:immersive:', 'expression:'],
  videos: ['mobile:home-feed:', 'watch:catalogue:', 'expression:'],
  media_assets: ['playback:', 'mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  media_renditions: ['playback:', 'mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  media_thumbnails: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  media_tracks: ['reels:immersive:', 'watch:catalogue:', 'expression:'],
  live_streams: ['live:', 'leadership:streams:', 'mobile:home-feed:', 'expression:'],
  stream_messages: ['live:'],
  stream_reactions: ['live:'],
  groups: ['expression:groups:', 'expression:'],
  group_memberships: ['expression:groups:', 'expression:'],
  branches: ['expression:', 'mobile:home-feed:'],
  expression_memberships: ['expression:', 'chat:', 'expression-chat:'],
  events: ['events:', 'mobile:home-feed:', 'expression:'],
  announcements: ['announcements:', 'mobile:home-feed:', 'expression:'],
  sermons: ['sermon:', 'mobile:home-feed:', 'expression:'],
  profiles: ['chat:', 'comments:', 'mobile:community:', 'mobile:home-feed:', 'public-profile:', 'birthdays:', 'expression:birthdays:', 'expression-chat:'],
  notifications: ['notifications:'],
  follows: ['mobile:home-feed:', 'public-profile:', 'expression:'],
  giving_purposes: ['expression:finance-books:', 'giving:'],
  giving_campaigns: ['expression:finance-books:', 'giving:'],
  giving_settings: ['expression:finance-books:', 'giving:'],
};

// These tables are introduced by draft migrations. They intentionally live on a
// second channel: if a migration has not been promoted yet, that channel may fail
// without affecting established chat/feed/media realtime.
const optionalTableInvalidations: Record<string, string[]> = {
  polls: ['participation:'],
  poll_options: ['participation:'],
  poll_votes: ['participation:'],
  giveaways: ['participation:'],
  giveaway_entries: ['participation:'],
  giveaway_winners: ['participation:'],
  testimonies: ['expression:testimonies:'],
  testimony_responses: ['expression:testimonies:'],
  financial_accounts: ['expression:finance-books:'],
  financial_sessions: ['expression:finance-books:'],
  financial_ledger_entries: ['expression:finance-books:'],
  feed_ranking_settings: ['mobile:home-feed:', 'expression:layered-home:'],
  expression_chat_messages: ['expression-chat:'],
  expression_chat_reactions: ['expression-chat:'],
};

const contextTables = new Set(['branches', 'expression_memberships']);

export function RealtimeBridge() {
  const { auth, mode, refreshContext } = useSession();
  const accessToken = auth?.session.accessToken ?? '';

  useEffect(() => {
    if (mode === 'restoring' || !apiUrl) return;

    let disposed = false;
    let client: RealtimeClient | null = null;
    const channels: any[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const pendingPrefixes = new Set<string>();
    const queueInvalidation = (prefix: string) => {
      pendingPrefixes.add(prefix);
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        if (disposed) return;
        pendingPrefixes.forEach(invalidate);
        pendingPrefixes.clear();
      }, 150);
    };

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
        if (accessToken) await client.realtime.setAuth(accessToken);
        if (disposed) return;

        const attach = (name: string, invalidations: Record<string, string[]>, refreshMembershipContext: boolean) => {
          let nextChannel = client!.channel(name);
          for (const table of Object.keys(invalidations)) {
            nextChannel = nextChannel.on(
              'postgres_changes',
              { event: '*', schema: 'public', table },
              () => {
                invalidations[table].forEach(queueInvalidation);
                if (refreshMembershipContext && accessToken && contextTables.has(table)) refreshContext();
              },
            );
          }

          let subscribed = false;
          nextChannel.subscribe((status: string) => {
            if (disposed || status !== 'SUBSCRIBED') return;
            // Postgres changes are not replayed after a disconnected socket.
            if (subscribed) Object.values(invalidations).flat().forEach(queueInvalidation);
            subscribed = true;
          });
          channels.push(nextChannel);
        };

        const identity = accessToken ? auth?.session.expiresAt ?? 'member' : 'visitor';
        attach(`cot-live-core-${identity}`, tableInvalidations, true);
        attach(`cot-live-draft-${identity}`, optionalTableInvalidations, false);
      } catch (error) {
        // Canonical reads continue to work when realtime is unavailable. Keep a
        // websocket/config failure isolated from the route tree instead of ever
        // blanking the application shell.
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('Realtime enhancement unavailable:', error);
        }
      }
    };

    void connect();
    return () => {
      disposed = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (client) {
        channels.forEach((channel) => void client!.removeChannel(channel));
        void client.removeAllChannels();
      }
    };
  }, [accessToken, auth?.session.expiresAt, mode, refreshContext]);

  return null;
}

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

type RealtimeDomain = {
  name: string;
  tables: Record<string, string[]>;
  refreshContext?: boolean;
};

// Keep domains deliberately small and only subscribe to tables that are enabled
// in the production Realtime publication. A missing/unpublished table must never
// be able to take down chat, calls, or feeds as collateral damage.
const realtimeDomains: RealtimeDomain[] = [
  {
    name: 'direct-chat',
    tables: {
      direct_conversations: ['chat:'],
      direct_messages: ['chat:'],
      direct_message_reactions: ['chat:'],
      conversations: ['chat:'],
      conversation_participants: ['chat:'],
      messages: ['chat:'],
      profiles: ['chat:', 'public-profile:'],
      follows: ['chat:', 'public-profile:', 'mobile:home-feed:'],
    },
  },
  {
    name: 'community-chat',
    tables: {
      expression_chat_messages: ['expression-chat:'],
      expression_chat_reactions: ['expression-chat:'],
      group_messages: ['group-chat:'],
      group_message_reactions: ['group-chat:'],
      group_chat_sections: ['group-chat:', 'expression:groups:', 'church:groups:'],
      group_chat_section_members: ['group-chat:'],
      group_roles: ['group-chat:', 'expression:groups:', 'church:groups:'],
      group_role_assignments: ['group-chat:', 'expression:groups:', 'church:groups:'],
      group_announcements: ['group-chat:', 'expression:groups:', 'church:groups:'],
      group_events: ['group-chat:', 'expression:groups:', 'church:groups:'],
      group_giving_options: ['group-chat:', 'expression:groups:', 'church:groups:'],
    },
  },
  {
    name: 'calls-notifications',
    tables: {
      chat_call_sessions: ['chat-call:'],
      chat_call_participants: ['chat-call:'],
      notifications: ['notifications:', 'chat-call:incoming:'],
    },
  },
  {
    name: 'social-content',
    tables: {
      social_posts: ['mobile:home-feed:', 'mobile:community:', 'expression:'],
      social_comments: ['comments:', 'mobile:home-feed:', 'mobile:community:', 'expression:'],
      social_reactions: ['mobile:home-feed:', 'mobile:community:', 'expression:'],
      content_items: ['mobile:home-feed:', 'mobile:community:', 'expression:', 'reels:immersive:', 'watch:catalogue:'],
      content_comments: engagementResources,
      content_reactions: engagementResources,
      content_bookmarks: engagementResources,
      reels: ['mobile:home-feed:', 'reels:immersive:', 'expression:'],
      videos: ['mobile:home-feed:', 'watch:catalogue:', 'expression:'],
      media_assets: ['playback:', 'mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
      media_renditions: ['playback:', 'mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
      media_thumbnails: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
      media_tracks: ['reels:immersive:', 'watch:catalogue:', 'expression:'],
    },
  },
  {
    name: 'ministry-content',
    tables: {
      events: ['events:', 'event:', 'discover:events:', 'leadership:events:', 'general:ministry:events:', 'home:spotlight:banners:', 'expression:'],
      announcements: ['general:announcements:', 'general:announcement:', 'expression:announcements:', 'leadership:announcements:', 'general:ministry:announcements:', 'home:spotlight:banners:', 'expression:'],
      sermons: ['sermon:', 'general:sermons:', 'discover:sermons:', 'discover:series:', 'leadership:sermons:', 'general:ministry:sermons:', 'mobile:home-feed:', 'expression:', 'saved:'],
      library_books: ['library:'],
      library_reviews: ['library:'],
      library_reading_progress: ['library:'],
      devotional_series: ['devotional:'],
      devotional_entries: ['devotional:'],
      general_home_notice_signals: ['general-home-notice:'],
    },
  },
  {
    name: 'live-groups',
    tables: {
      live_streams: ['live:', 'leadership:streams:', 'mobile:home-feed:', 'expression:'],
      stream_messages: ['live:'],
      stream_reactions: ['live:'],
      groups: ['expression:groups:', 'church:groups:', 'expression:'],
      group_memberships: ['expression:groups:', 'church:groups:', 'expression:'],
    },
  },
  {
    name: 'membership-context',
    refreshContext: true,
    tables: {
      branches: ['expression:', 'mobile:home-feed:'],
      expression_memberships: ['expression:', 'chat:', 'expression-chat:'],
    },
  },
];

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
      }, 90);
    };

    const connect = async () => {
      try {
        const [{ createClient }, response] = await Promise.all([
          import('@supabase/supabase-js'),
          fetch(`${apiUrl}/realtime-config`, { headers: { Accept: 'application/json' } }),
        ]);

        if (disposed || !response.ok) return;
        const payload = await response.json() as { data?: RealtimeConfig };
        const config = payload.data;
        if (disposed || !config?.url || !config.anonKey) return;

        const nextClient = createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
          realtime: { params: { eventsPerSecond: 40 } },
        }) as unknown as RealtimeClient;

        if (disposed) {
          void nextClient.removeAllChannels();
          return;
        }

        client = nextClient;
        if (accessToken) await client.realtime.setAuth(accessToken);
        if (disposed) return;

        const identity = accessToken ? auth?.session.expiresAt ?? 'member' : 'visitor';

        for (const domain of realtimeDomains) {
          let channel = client.channel(`cot-live-${domain.name}-${identity}`);
          for (const [table, prefixes] of Object.entries(domain.tables)) {
            channel = channel.on(
              'postgres_changes',
              { event: '*', schema: 'public', table },
              () => {
                prefixes.forEach(queueInvalidation);
                if (domain.refreshContext && accessToken) refreshContext();
              },
            );
          }

          let subscribedOnce = false;
          channel.subscribe((status: string) => {
            if (disposed) return;
            if (status === 'SUBSCRIBED') {
              // Supabase does not replay Postgres Changes after a disconnected
              // socket. Refresh only this domain after reconnecting.
              if (subscribedOnce) {
                Object.values(domain.tables).flat().forEach(queueInvalidation);
              }
              subscribedOnce = true;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // Never poison other realtime domains. Their channels remain
              // subscribed even if one feature/domain experiences a problem.
              if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.warn(`Realtime domain ${domain.name} is unavailable (${status}).`);
              }
            }
          });
          channels.push(channel);
        }
      } catch (error) {
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

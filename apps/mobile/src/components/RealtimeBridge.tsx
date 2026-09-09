import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@/state/session';
import { invalidate } from '@/services/query-cache';

const realtimeUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const realtimeAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

const tableInvalidations: Record<string, string[]> = {
  messages: ['chat:'],
  content_items: ['mobile:home-feed:', 'mobile:community:', 'expression:', 'reels:immersive:', 'watch:catalogue:'],
  content_comments: ['comments:', 'mobile:home-feed:', 'reels:immersive:', 'expression:'],
  social_comments: ['comments:', 'mobile:home-feed:', 'reels:immersive:', 'expression:'],
  media_assets: ['mobile:home-feed:', 'reels:immersive:', 'watch:catalogue:', 'expression:'],
  live_streams: ['live:', 'leadership:streams:', 'mobile:home-feed:', 'expression:'],
  groups: ['expression:groups:', 'expression:'],
  branches: ['expression:', 'mobile:home-feed:'],
};

export function RealtimeBridge() {
  const { auth, mode } = useSession();
  const accessToken = auth?.session.accessToken ?? '';

  useEffect(() => {
    if (mode !== 'authenticated' || !accessToken || !realtimeUrl || !realtimeAnonKey) return;

    const client = createClient(realtimeUrl, realtimeAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      realtime: { params: { eventsPerSecond: 20 } },
    });

    client.realtime.setAuth(accessToken);
    let channel = client.channel(`cot-live-${auth?.session.expiresAt ?? 'session'}`);

    for (const table of Object.keys(tableInvalidations)) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => tableInvalidations[table].forEach(invalidate),
      );
    }

    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
      void client.removeAllChannels();
    };
  }, [accessToken, auth?.session.expiresAt, mode]);

  return null;
}

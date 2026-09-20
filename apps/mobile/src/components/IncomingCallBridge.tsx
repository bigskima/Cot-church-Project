import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { Avatar, Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { ActiveCallPayload } from '@/features/calls/call-types';

const RINGTONE_URI = 'data:audio/wav;base64,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';

export function IncomingCallBridge() {
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const pathname = usePathname();
  const player = useAudioPlayer(RINGTONE_URI, { updateInterval: 500, downloadFirst: false });
  const profileId = context?.profile?.id ?? '';
  const [dismissedCallId, setDismissedCallId] = useState('');
  const [busy, setBusy] = useState<'answer' | 'decline' | ''>('');
  const lastRingingId = useRef('');

  const incoming = useResource<ActiveCallPayload | null>(
    `chat-call:incoming:${profileId || 'none'}`,
    (signal) => mode === 'authenticated' && profileId
      ? api.request<ActiveCallPayload | null>('noop?service=calls&incoming=true', { signal, context: 'public' })
      : Promise.resolve(null),
  );

  const call = incoming.data?.call ?? null;
  const caller = useMemo(
    () => incoming.data?.participants.find((item) => item.profile_id === call?.created_by_profile_id)?.profile ?? null,
    [call?.created_by_profile_id, incoming.data?.participants],
  );
  const visible = Boolean(
    call
    && call.id !== dismissedCallId
    && !pathname.startsWith(`/calls/${call.id}`)
    && ['ringing', 'active'].includes(call.status),
  );

  useEffect(() => {
    if (!visible || !call) {
      if (lastRingingId.current) {
        player.pause();
        void player.seekTo(0).catch(() => undefined);
        lastRingingId.current = '';
      }
      return;
    }
    if (lastRingingId.current === call.id) return;
    lastRingingId.current = call.id;
    player.loop = true;
    player.volume = Platform.OS === 'web' ? 0.42 : 0.62;
    try { player.play(); } catch {}
    return () => {
      player.pause();
      void player.seekTo(0).catch(() => undefined);
    };
  }, [call?.id, player, visible]);

  useEffect(() => {
    if (!visible || !call) return;
    const remaining = Math.max(0, 60_000 - (Date.now() - new Date(call.created_at).getTime()));
    const timer = setTimeout(() => {
      invalidate('chat-call:incoming:');
      invalidate('chat-call:session:');
    }, remaining + 250);
    return () => clearTimeout(timer);
  }, [call?.created_at, call?.id, visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !call || typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const displayName = caller?.display_name || caller?.username || 'COT member';
    const notice = new Notification(`${displayName} is calling`, {
      body: `Incoming ${call.call_kind} call on COT`,
      tag: `cot-call-${call.id}`,
      requireInteraction: true,
    });
    notice.onclick = () => {
      window.focus();
      router.push({ pathname: '/calls/[callId]', params: { callId: call.id } } as any);
      notice.close();
    };
    return () => notice.close();
  }, [call?.id, call?.call_kind, caller?.display_name, caller?.username, visible]);

  useEffect(() => {
    if (!call || call.id !== dismissedCallId) return;
    if (!incoming.data || !['ringing', 'active'].includes(incoming.data.call.status)) {
      setDismissedCallId('');
    }
  }, [call?.id, call?.status, dismissedCallId, incoming.data]);

  const stopRingtone = () => {
    player.pause();
    void player.seekTo(0).catch(() => undefined);
    lastRingingId.current = '';
  };

  const answer = () => {
    if (!call || busy) return;
    setBusy('answer');
    stopRingtone();
    setDismissedCallId(call.id);
    router.push({ pathname: '/calls/[callId]', params: { callId: call.id, answer: '1' } } as any);
    setBusy('');
  };

  const decline = async () => {
    if (!call || busy) return;
    setBusy('decline');
    stopRingtone();
    setDismissedCallId(call.id);
    try {
      await api.request('noop?service=calls', {
        method: 'POST',
        context: 'public',
        feedback: false,
        body: JSON.stringify({ action: 'decline', callId: call.id }),
      });
    } finally {
      invalidate('chat-call:');
      setBusy('');
    }
  };

  if (!visible || !call) return null;
  const displayName = caller?.display_name || caller?.username || 'COT member';
  const scopeLabel = call.scope === 'direct'
    ? 'Direct call'
    : call.scope === 'expression'
      ? 'Expression call'
      : call.section_id
        ? 'Temporary Group call'
        : 'Group call';

  return (
    <View pointerEvents='box-none' style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.lg]}>
        <View style={styles.ringingRow}>
          <View style={[styles.pulse, { backgroundColor: colors.primarySoft }]}>
            <Icon name={call.call_kind === 'video' ? 'videocam' : 'call'} size={22} color={colors.interactive} />
          </View>
          <Text style={[styles.ringing, { color: colors.interactive }]}>INCOMING {call.call_kind.toUpperCase()} CALL</Text>
        </View>
        <View style={styles.identity}>
          <Avatar url={caller?.avatar_url ?? undefined} name={displayName} size='lg' />
          <View style={styles.copy}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>{scopeLabel}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable disabled={!!busy} onPress={() => void decline()} style={[styles.ignore, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name='close' size={19} color={colors.text} />
            <Text style={[styles.ignoreText, { color: colors.text }]}>Ignore</Text>
          </Pressable>
          <Pressable disabled={!!busy} onPress={answer} style={[styles.answer, { backgroundColor: colors.interactive }]}>
            <Icon name={call.call_kind === 'video' ? 'videocam' : 'call'} size={19} color='#FFFFFF' />
            <Text style={styles.answerText}>{busy === 'answer' ? 'Opening…' : 'Answer'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1200, justifyContent: 'flex-start', alignItems: 'center', paddingTop: Platform.OS === 'web' ? 18 : 54, paddingHorizontal: spacing.md },
  card: { width: '100%', maxWidth: 430, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  ringingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  ringing: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.05 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.35 },
  meta: { fontSize: 11.5, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  ignore: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  answer: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  ignoreText: { fontSize: 11.5, fontWeight: '900' },
  answerText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
});

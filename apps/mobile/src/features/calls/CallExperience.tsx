import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { AgoraCallSession } from './AgoraCallSession';
import type { JoinedCallPayload } from './call-types';

export function CallExperience({ callId }: { callId: string }) {
  const { api, context } = useSession();
  const { colors } = useTheme();
  const [payload, setPayload] = useState<JoinedCallPayload | null>(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const leftRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    void api.request<JoinedCallPayload>('chat-calls', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({ action: 'join', callId }),
    }).then((data) => {
      if (!disposed) setPayload(data);
    }).catch((value) => {
      if (!disposed) setError(value instanceof Error ? value.message : 'Unable to join this call.');
    });
    return () => {
      disposed = true;
      if (!leftRef.current) {
        leftRef.current = true;
        void api.request('chat-calls', { method: 'POST', context: 'public', body: JSON.stringify({ action: 'leave', callId }) }).catch(() => {});
      }
    };
  }, [api, callId]);

  const leave = async (endForEveryone = false) => {
    if (leaving) return;
    setLeaving(true);
    leftRef.current = true;
    try {
      await api.request('chat-calls', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ action: endForEveryone ? 'end' : 'leave', callId }),
      });
    } catch (value) {
      if (endForEveryone) setError(value instanceof Error ? value.message : 'Unable to end the call for everyone.');
    } finally {
      router.back();
      setLeaving(false);
    }
  };

  if (error && !payload) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><Icon name='call-outline' size={34} color={colors.textMuted} /><Text style={[styles.title, { color: colors.text }]}>Call unavailable</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{error}</Text><Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.text }]}><Text style={[styles.backText, { color: colors.bg }]}>Back</Text></Pressable></View>;
  }
  if (!payload) return <View style={[styles.center, { backgroundColor: '#03060B' }]}><ActivityIndicator color='#FFFFFF' /><Text style={styles.loading}>Joining call…</Text></View>;

  const owner = payload.call.created_by_profile_id === context?.profile?.id;
  return (
    <View style={styles.screen}>
      <AgoraCallSession grant={payload.grant} kind={payload.call.call_kind} onError={setError} />
      <View style={styles.topBar} pointerEvents='box-none'>
        <Pressable onPress={() => void leave(false)} style={styles.round}><Icon name='chevron-down' size={22} color='#FFFFFF' /></Pressable>
        <View style={styles.topCopy}><Text style={styles.callType}>{payload.call.call_kind === 'video' ? 'Video call' : 'Audio call'}</Text><Text style={styles.callMeta}>{payload.call.scope === 'direct' ? 'Direct message' : payload.call.scope === 'expression' ? 'Expression discussion' : 'Group discussion'}</Text></View>
      </View>
      {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
      <View style={styles.endRow}>
        <Pressable disabled={leaving} onPress={() => void leave(false)} style={styles.leave}><Icon name='call' size={21} color='#FFFFFF' /><Text style={styles.leaveText}>Leave</Text></Pressable>
        {owner ? <Pressable disabled={leaving} onPress={() => void leave(true)} style={styles.endAll}><Text style={styles.endAllText}>End for everyone</Text></Pressable> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#03060B' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  loading: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '900' },
  copy: { maxWidth: 340, textAlign: 'center', lineHeight: 19 },
  back: { paddingHorizontal: 18, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  backText: { fontWeight: '900' },
  topBar: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' },
  topCopy: { backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  callType: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  callMeta: { color: '#CBD5E1', fontSize: 9, marginTop: 1 },
  errorBanner: { position: 'absolute', left: 16, right: 16, top: 70, backgroundColor: 'rgba(127,29,29,0.88)', padding: 9, borderRadius: 12 },
  errorText: { color: '#FFFFFF', fontSize: 11, textAlign: 'center' },
  endRow: { position: 'absolute', bottom: 18, left: 12, right: 12, flexDirection: 'row', justifyContent: 'center', gap: 10, pointerEvents: 'box-none' },
  leave: { minWidth: 98, height: 48, borderRadius: 24, paddingHorizontal: 17, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  leaveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  endAll: { minWidth: 138, height: 48, borderRadius: 24, paddingHorizontal: 17, backgroundColor: 'rgba(20,25,35,0.92)', alignItems: 'center', justifyContent: 'center' },
  endAllText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
});

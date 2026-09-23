import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar, Icon } from '@/components';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { AgoraCallSession } from './AgoraCallSession';
import type { ActiveCallPayload, JoinedCallPayload } from './call-types';

async function requestNativeCallPermissions(video: boolean) {
  if (Platform.OS !== 'android') return true;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (video) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const microphoneGranted = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  const cameraGranted = !video || result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
  return microphoneGranted && cameraGranted;
}

export function CallExperience({ callId, autoAnswer = false }: { callId: string; autoAnswer?: boolean }) {
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const viewerId = context?.profile?.id ?? '';
  const [payload, setPayload] = useState<JoinedCallPayload | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [declining, setDeclining] = useState(false);
  const leftRef = useRef(false);

  const metadata = useResource<ActiveCallPayload>(
    `chat-call:session:${callId}`,
    (signal) => mode === 'authenticated'
      ? api.request<ActiveCallPayload>(`noop?service=calls&callId=${encodeURIComponent(callId)}`, { signal, context: 'public' })
      : Promise.reject(new Error('Sign in to use calls.')),
  );

  const call = metadata.data?.call ?? payload?.call ?? null;
  const participants = metadata.data?.participants ?? payload?.participants ?? [];
  const viewerParticipant = participants.find((item) => item.profile_id === viewerId);
  const caller = participants.find((item) => item.profile_id === call?.created_by_profile_id)?.profile ?? null;
  const other = useMemo(
    () => participants.find((item) => item.profile_id !== viewerId)?.profile ?? null,
    [participants, viewerId],
  );
  const directOtherName = other?.display_name || other?.username || (call?.scope === 'direct' ? 'COT member' : null);
  const ended = Boolean(call && ['ended', 'cancelled'].includes(call.status));

  const join = async () => {
    if (joining || payload || ended) return;
    setJoining(true);
    setError('');
    try {
      const permissionGranted = await requestNativeCallPermissions(call?.call_kind === 'video');
      if (!permissionGranted) {
        setError(call?.call_kind === 'video'
          ? 'Microphone and camera access are required for this video call.'
          : 'Microphone access is required for this audio call.');
        return;
      }
      const data = await api.request<JoinedCallPayload>('noop?service=calls', {
        method: 'POST',
        context: 'public',
        feedback: false,
        body: JSON.stringify({ action: 'join', callId }),
      });
      leftRef.current = false;
      setPayload(data);
      invalidate('chat-call:');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to join this call.');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!call || payload || joining || ended || !viewerId) return;
    const callerOpeningOwnCall = call.created_by_profile_id === viewerId;
    const alreadyJoined = viewerParticipant?.state === 'joined';
    if (callerOpeningOwnCall || alreadyJoined || (autoAnswer && viewerParticipant?.state === 'invited')) {
      void join();
    }
  }, [autoAnswer, call?.id, call?.created_by_profile_id, ended, joining, payload, viewerId, viewerParticipant?.state]);

  useEffect(() => {
    if (!payload || !call || !['ended', 'cancelled'].includes(call.status)) return;
    leftRef.current = true;
  }, [call?.status, payload]);

  // Realtime remains the primary transport, but a lightweight per-call refresh
  // guarantees that an authoritative "end for everyone" state closes every
  // participant's media session even if a browser misses a realtime frame.
  useEffect(() => {
    if (!payload || ended) return;
    const timer = setInterval(() => {
      void metadata.refresh();
    }, 1500);
    return () => clearInterval(timer);
  }, [ended, metadata.refresh, payload]);

  useEffect(() => () => {
    if (!payload || leftRef.current || ended) return;
    leftRef.current = true;
    void api.request('noop?service=calls', {
      method: 'POST',
      context: 'public',
      feedback: false,
      body: JSON.stringify({ action: 'leave', callId }),
    }).catch(() => {});
  }, [api, callId, ended, payload]);

  const decline = async () => {
    if (declining || !call) return;
    setDeclining(true);
    setError('');
    try {
      await api.request('noop?service=calls', {
        method: 'POST',
        context: 'public',
        feedback: false,
        body: JSON.stringify({ action: 'decline', callId }),
      });
      invalidate('chat-call:');
      if (router.canGoBack()) router.back();
      else router.replace('/general/chat' as any);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to decline this call.');
    } finally {
      setDeclining(false);
    }
  };

  const leave = async (endForEveryone = false) => {
    if (leaving) return;
    setLeaving(true);
    leftRef.current = true;
    try {
      await api.request('noop?service=calls', {
        method: 'POST',
        context: 'public',
        feedback: false,
        body: JSON.stringify({ action: endForEveryone ? 'end' : 'leave', callId }),
      });
    } catch (value) {
      if (endForEveryone) setError(value instanceof Error ? value.message : 'Unable to end the call for everyone.');
    } finally {
      invalidate('chat-call:');
      if (router.canGoBack()) router.back();
      else router.replace('/general/chat' as any);
      setLeaving(false);
    }
  };

  if (metadata.loading && !metadata.data && !payload) {
    return <View style={[styles.center, { backgroundColor: '#03060B' }]}><ActivityIndicator color='#FFFFFF' /><Text style={styles.loading}>Preparing call…</Text></View>;
  }

  if ((metadata.error || error) && !call && !payload) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Icon name='call-outline' size={34} color={colors.textMuted} />
        <Text style={[styles.title, { color: colors.text }]}>Call unavailable</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{error || metadata.error}</Text>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/general/chat' as any)} style={[styles.back, { backgroundColor: colors.text }]}><Text style={[styles.backText, { color: colors.bg }]}>Back</Text></Pressable>
      </View>
    );
  }

  if (ended && call) {
    const cancelled = call.status === 'cancelled';
    return (
      <View style={[styles.center, { backgroundColor: '#03060B' }]}>
        <View style={styles.endedIcon}><Icon name={cancelled ? 'call-outline' : 'call'} size={31} color='#FFFFFF' /></View>
        <Text style={styles.endedTitle}>{cancelled ? 'Call not answered' : 'Call ended'}</Text>
        <Text style={styles.endedCopy}>{cancelled && call.scope === 'direct' ? 'The call was declined, cancelled, or timed out.' : 'This conversation is no longer on a live call.'}</Text>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/general/chat' as any)} style={styles.endedBack}><Text style={styles.endedBackText}>Return to chat</Text></Pressable>
      </View>
    );
  }

  if (!payload && call) {
    const incoming = viewerParticipant?.state === 'invited' && call.created_by_profile_id !== viewerId;
    const groupJoin = !incoming && call.created_by_profile_id !== viewerId;
    const displayName = caller?.display_name || caller?.username || 'COT member';
    return (
      <View style={styles.prejoin}>
        <View style={styles.prejoinGlow} />
        <View style={styles.prejoinContent}>
          <Avatar url={caller?.avatar_url ?? undefined} name={displayName} size='xl' />
          <Text style={styles.prejoinEyebrow}>{incoming ? 'INCOMING' : 'LIVE'} {call.call_kind.toUpperCase()} CALL</Text>
          <Text style={styles.prejoinName}>{incoming ? displayName : (call.scope === 'direct' ? displayName : 'COT conversation')}</Text>
          <Text style={styles.prejoinMeta}>
            {call.scope === 'direct'
              ? 'Direct message'
              : call.scope === 'expression'
                ? 'Expression discussion'
                : call.section_id
                  ? 'Temporary Group discussion'
                  : 'Group discussion'}
          </Text>
          {error ? <Text style={styles.prejoinError}>{error}</Text> : null}
          <View style={styles.prejoinActions}>
            {incoming ? (
              <Pressable disabled={declining || joining} onPress={() => void decline()} style={styles.declineButton}>
                <Icon name='close' size={21} color='#FFFFFF' />
                <Text style={styles.actionText}>{declining ? 'Ignoring…' : 'Ignore'}</Text>
              </Pressable>
            ) : null}
            <Pressable disabled={joining || declining} onPress={() => void join()} style={styles.answerButton}>
              <Icon name={call.call_kind === 'video' ? 'videocam' : 'call'} size={21} color='#FFFFFF' />
              <Text style={styles.actionText}>{joining ? 'Joining…' : (groupJoin ? 'Join call' : 'Answer')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!payload || !call) {
    return <View style={[styles.center, { backgroundColor: '#03060B' }]}><ActivityIndicator color='#FFFFFF' /><Text style={styles.loading}>Joining call…</Text></View>;
  }

  const owner = call.created_by_profile_id === viewerId;
  const directWaiting = call.scope === 'direct' && call.status === 'ringing';
  return (
    <View style={styles.screen}>
      <AgoraCallSession
        grant={payload.grant}
        kind={call.call_kind}
        scope={call.scope}
        otherName={directOtherName}
        onError={setError}
        overlayBottomInset={Math.max(insets.bottom, 10) + 62}
      />
      <View style={styles.topBar} pointerEvents='box-none'>
        <Pressable onPress={() => void leave(false)} style={styles.round}><Icon name='chevron-down' size={22} color='#FFFFFF' /></Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.callType}>{directWaiting ? `Calling ${directOtherName || 'member'}…` : call.call_kind === 'video' ? 'Video call' : 'Audio call'}</Text>
          <Text style={styles.callMeta}>
            {call.scope === 'direct'
              ? (directWaiting ? 'Waiting for answer' : 'Direct call')
              : call.scope === 'expression'
                ? `${participants.filter((item) => item.state === 'joined').length} in Expression call`
                : `${participants.filter((item) => item.state === 'joined').length} in Group call`}
          </Text>
        </View>
      </View>
      {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
      <View style={[styles.endRow, { bottom: Math.max(insets.bottom, 10) + 10 }]} pointerEvents='box-none'>
        {owner && call.scope === 'direct' ? (
          <Pressable disabled={leaving} onPress={() => void leave(true)} style={styles.leave}>
            <Icon name='call' size={21} color='#FFFFFF' />
            <Text style={styles.leaveText}>{directWaiting ? 'Cancel call' : 'End call'}</Text>
          </Pressable>
        ) : (
          <Pressable disabled={leaving} onPress={() => void leave(false)} style={styles.leave}>
            <Icon name='call' size={21} color='#FFFFFF' />
            <Text style={styles.leaveText}>{directWaiting ? 'Cancel' : 'Leave'}</Text>
          </Pressable>
        )}
        {owner && call.scope !== 'direct' ? (
          <Pressable disabled={leaving} onPress={() => void leave(true)} style={styles.endAll}>
            <Text style={styles.endAllText}>End for everyone</Text>
          </Pressable>
        ) : null}
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
  prejoin: { flex: 1, backgroundColor: '#03060B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  prejoinGlow: { position: 'absolute', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(29,155,240,0.11)' },
  prejoinContent: { width: '100%', maxWidth: 440, padding: 28, alignItems: 'center' },
  prejoinEyebrow: { color: '#60A5FA', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 22 },
  prejoinName: { color: '#FFFFFF', fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  prejoinMeta: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  prejoinError: { color: '#FCA5A5', fontSize: 11, textAlign: 'center', marginTop: 15 },
  prejoinActions: { flexDirection: 'row', gap: 14, marginTop: 32 },
  declineButton: { minWidth: 118, height: 52, borderRadius: 26, backgroundColor: '#B91C1C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  answerButton: { minWidth: 138, height: 52, borderRadius: 26, backgroundColor: '#0EA5E9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  endedIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  endedTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 8 },
  endedCopy: { color: '#9CA3AF', maxWidth: 330, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  endedBack: { height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  endedBackText: { color: '#050A11', fontWeight: '900', fontSize: 11 },
  topBar: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' },
  topCopy: { backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '75%' },
  callType: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  callMeta: { color: '#CBD5E1', fontSize: 9, marginTop: 1 },
  errorBanner: { position: 'absolute', left: 16, right: 16, top: 70, backgroundColor: 'rgba(127,29,29,0.88)', padding: 9, borderRadius: 12 },
  errorText: { color: '#FFFFFF', fontSize: 11, textAlign: 'center' },
  endRow: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, zIndex: 20 },
  leave: { minWidth: 98, height: 48, borderRadius: 24, paddingHorizontal: 17, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  leaveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  endAll: { minWidth: 138, height: 48, borderRadius: 24, paddingHorizontal: 17, backgroundColor: 'rgba(20,25,35,0.92)', alignItems: 'center', justifyContent: 'center' },
  endAllText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
});

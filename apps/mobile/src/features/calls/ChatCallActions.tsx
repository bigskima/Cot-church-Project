import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { ActiveCallPayload, ChatCallKind, ChatCallScope } from './call-types';

type Props = {
  scope: ChatCallScope;
  conversationId?: string | null;
  expressionId?: string | null;
  groupId?: string | null;
  sectionId?: string | null;
  compact?: boolean;
};

function queryString(props: Props) {
  const query = new URLSearchParams({ scope: props.scope });
  if (props.conversationId) query.set('conversationId', props.conversationId);
  if (props.expressionId) query.set('expressionId', props.expressionId);
  if (props.groupId) query.set('groupId', props.groupId);
  if (props.sectionId) query.set('sectionId', props.sectionId);
  return query.toString();
}

export function ChatCallActions(props: Props) {
  const { api, mode } = useSession();
  const { colors } = useTheme();
  const [busy, setBusy] = useState<ChatCallKind | ''>('');
  const [error, setError] = useState('');
  const scopeKey = queryString(props);
  const active = useResource<ActiveCallPayload | null>(
    `chat-call:${scopeKey}`,
    (signal) => mode === 'authenticated'
      ? api.request<ActiveCallPayload | null>(`chat-calls?${scopeKey}`, { signal, context: 'public' })
      : Promise.resolve(null),
  );

  const openCall = (callId: string) => router.push(`/calls/${callId}` as any);
  const start = async (kind: ChatCallKind) => {
    if (busy) return;
    if (active.data?.call?.id) {
      openCall(active.data.call.id);
      return;
    }
    setBusy(kind);
    setError('');
    try {
      const result = await api.request<ActiveCallPayload & { existing?: boolean }>('chat-calls', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: 'create',
          scope: props.scope,
          conversationId: props.conversationId || undefined,
          expressionId: props.expressionId || undefined,
          groupId: props.groupId || undefined,
          sectionId: props.sectionId || undefined,
          callKind: kind,
        }),
      });
      invalidate('chat-call:');
      openCall(result.call.id);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start this call.');
    } finally {
      setBusy('');
    }
  };

  if (mode !== 'authenticated') return null;

  if (props.compact) {
    return (
      <View style={styles.compactWrap}>
        {active.data?.call ? (
          <Pressable onPress={() => openCall(active.data!.call.id)} style={[styles.liveButton, { backgroundColor: colors.primarySoft }]} accessibilityRole='button' accessibilityLabel='Join active call'>
            <Icon name={active.data.call.call_kind === 'video' ? 'videocam' : 'call'} size={18} color={colors.interactive} />
          </Pressable>
        ) : (
          <>
            <Pressable disabled={!!busy} onPress={() => void start('audio')} style={styles.iconButton} accessibilityRole='button' accessibilityLabel='Start audio call'>
              <Icon name='call-outline' size={19} color={colors.text} />
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => void start('video')} style={styles.iconButton} accessibilityRole='button' accessibilityLabel='Start video call'>
              <Icon name='videocam-outline' size={21} color={colors.text} />
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        {active.data?.call ? (
          <Pressable onPress={() => openCall(active.data!.call.id)} style={[styles.joinButton, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
            <Icon name={active.data.call.call_kind === 'video' ? 'videocam' : 'call'} size={15} color={colors.interactive} />
            <Text style={[styles.label, { color: colors.interactive }]}>Join call</Text>
          </Pressable>
        ) : (
          <>
            <Pressable disabled={!!busy} onPress={() => void start('audio')} style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Icon name='call-outline' size={15} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>{busy === 'audio' ? 'Starting…' : 'Audio'}</Text>
            </Pressable>
            <Pressable disabled={!!busy} onPress={() => void start('video')} style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Icon name='videocam-outline' size={16} color={colors.textSecondary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>{busy === 'video' ? 'Starting…' : 'Video'}</Text>
            </Pressable>
          </>
        )}
      </View>
      {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  liveButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { minHeight: 34, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5 },
  joinButton: { minHeight: 34, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10.5, fontWeight: '800' },
  error: { fontSize: 10, maxWidth: 220 },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import type { CallHistoryEntry } from './call-types';

function durationLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return '';
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (!Number.isFinite(seconds) || seconds < 1) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function CallHistoryBubble({
  entry,
  viewerId,
}: {
  entry: CallHistoryEntry;
  viewerId: string;
}) {
  const { colors } = useTheme();
  const { call, participants } = entry;
  const viewer = participants.find((participant) => participant.profile_id === viewerId);
  const owner = call.created_by_profile_id === viewerId;
  const active = call.status === 'ringing' || call.status === 'active';
  const joined = viewer?.state === 'joined' || viewer?.state === 'left';
  const missed = viewer?.state === 'missed';
  const declined = viewer?.state === 'declined';
  const kindLabel = call.call_kind === 'video' ? 'Video call' : 'Audio call';

  let stateLabel = 'Call ended';
  let icon: React.ComponentProps<typeof Icon>['name'] = call.call_kind === 'video' ? 'videocam-outline' : 'call-outline';
  let accent = colors.textSecondary;

  if (active) {
    stateLabel = owner ? 'Call in progress' : 'Join now';
    accent = colors.interactive;
  } else if (missed) {
    stateLabel = 'Missed call';
    icon = 'call-outline';
    accent = colors.live;
  } else if (declined) {
    stateLabel = 'Call declined';
    accent = colors.textMuted;
  } else if (joined) {
    stateLabel = 'Call completed';
    accent = colors.success;
  } else if (call.status === 'cancelled') {
    stateLabel = owner ? 'Call not answered' : 'Missed call';
    accent = colors.live;
  }

  const duration = durationLabel(call.started_at, call.ended_at);
  const openCall = () => router.push(`/calls/${call.id}` as any);

  return (
    <Pressable
      onPress={openCall}
      accessibilityRole="button"
      accessibilityLabel={active ? `${kindLabel}. ${stateLabel}` : `Open ${kindLabel.toLowerCase()} details`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: active ? colors.interactive : colors.borderSubtle,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: active ? colors.primarySoft : colors.bgSecondary }]}>
        <Icon name={icon} size={20} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{kindLabel}</Text>
        <Text style={[styles.state, { color: accent }]}>{stateLabel}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {[timeLabel(call.created_at), duration].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {active ? (
        <View style={[styles.join, { backgroundColor: colors.interactive }]}>
          <Text style={styles.joinText}>{owner ? 'Open' : 'Join'}</Text>
          <Icon name="chevron-forward" size={14} color="#FFFFFF" />
        </View>
      ) : (
        <Icon name="chevron-forward" size={17} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '88%',
    maxWidth: 420,
    alignSelf: 'center',
    minHeight: 76,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.86 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  state: { fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 1 },
  meta: { fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  join: { minHeight: 34, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 3 },
  joinText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
});

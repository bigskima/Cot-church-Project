import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import type { Event } from '@/types/content';
import { radius, spacing, shadows, typography } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { EventLiveCountdown } from './EventLiveCountdown';

export interface EventCardProps {
  event: Event;
  onPress: () => void;
  variant?: 'card' | 'row' | 'discovery';
  style?: StyleProp<ViewStyle>;
}

export function EventCard({ event, onPress, variant = 'card', style }: EventCardProps) {
  const { colors } = useTheme();
  const parsedStartDate = event.starts_at ? new Date(event.starts_at) : null;
  const startDate = parsedStartDate && !Number.isNaN(parsedStartDate.getTime()) ? parsedStartDate : null;
  const dateStr = startDate ? startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date to be announced';
  const shortMonth = startDate ? startDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : 'TBA';
  const day = startDate ? startDate.getDate().toString() : '—';
  const timeStr = startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time TBA';
  const isOnline = event.location?.is_online;
  const locationName = event.location?.name;

  if (variant === 'discovery') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${event.title}`}
        style={({ pressed }) => [styles.discoveryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed, style]}
      >
        <View style={styles.discoveryTop}>
          <View style={[styles.dateBlock, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
            <Text style={[styles.dateMonth, { color: colors.interactive }]}>{shortMonth}</Text>
            <Text style={[styles.dateDay, { color: colors.text }]}>{day}</Text>
          </View>
          <View style={styles.discoveryTitleCopy}>
            <Text style={[styles.discoveryKicker, { color: colors.interactive }]}>UPCOMING</Text>
            <Text numberOfLines={2} style={[styles.discoveryTitle, { color: colors.text }]}>{event.title}</Text>
          </View>
        </View>
        <EventLiveCountdown startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} compact />
        <View style={styles.discoveryMeta}>
          <View style={styles.metaRow}><Icon name="time-outline" size={13} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeStr}</Text></View>
          {locationName || isOnline ? <View style={styles.metaRow}><Icon name={isOnline && !locationName ? 'globe-outline' : 'location-outline'} size={13} color={isOnline ? colors.interactive : colors.textMuted} /><Text numberOfLines={1} style={[styles.metaText, { color: isOnline && !locationName ? colors.interactive : colors.textSecondary }]}>{locationName || 'Online gathering'}</Text></View> : null}
        </View>
        <View style={[styles.discoveryFooter, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.discoveryFooterText, { color: colors.textSecondary }]}>Open event details</Text>
          <View style={[styles.discoveryArrow, { backgroundColor: colors.bgSecondary }]}><Icon name="arrow-forward" size={14} color={colors.interactive} /></View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, variant === 'card' ? shadows.sm : null, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}`}
    >
      <View style={[styles.eventIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}><Icon name="calendar-outline" size={22} color={colors.interactive} /></View>
      <View style={styles.contentArea}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{event.title}</Text>
        <EventLiveCountdown startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} compact />
        <View style={styles.metaStack}>
          <View style={styles.metaRow}><Icon name="calendar-clear-outline" size={13} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{dateStr}</Text><Text style={[styles.dot, { color: colors.borderStrong }]}>·</Text><Icon name="time-outline" size={13} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeStr}</Text></View>
          {locationName || isOnline ? <View style={styles.metaRow}><Icon name={isOnline && !locationName ? 'globe-outline' : 'location-outline'} size={13} color={isOnline ? colors.interactive : colors.textMuted} /><Text numberOfLines={1} style={[styles.metaText, { color: isOnline && !locationName ? colors.interactive : colors.textSecondary }]}>{locationName || 'Online gathering'}</Text></View> : null}
        </View>
        {event.description ? <Text numberOfLines={variant === 'row' ? 1 : 2} style={[styles.description, { color: colors.textMuted }]}>{event.description}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, marginBottom: spacing.md, gap: spacing.md },
  eventIcon: { width: 48, height: 48, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, contentArea: { flex: 1, minWidth: 0, gap: 7 },
  title: { ...typography.h3, fontSize: 15, lineHeight: 20 }, metaStack: { gap: 4 }, metaRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }, metaText: { flexShrink: 1, fontSize: 11.5, lineHeight: 15, fontWeight: '600' }, dot: { marginHorizontal: 1, fontSize: 13 }, description: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  discoveryCard: { width: '100%', borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  discoveryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dateBlock: { width: 56, minHeight: 62, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }, dateMonth: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 }, dateDay: { fontSize: 23, lineHeight: 27, fontWeight: '900', letterSpacing: -0.6, marginTop: 1 },
  discoveryTitleCopy: { flex: 1, minWidth: 0, paddingTop: 2 }, discoveryKicker: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.85 }, discoveryTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3, marginTop: 3 },
  discoveryMeta: { gap: 5 }, discoveryFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, discoveryFooterText: { fontSize: 10.5, fontWeight: '700' }, discoveryArrow: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});

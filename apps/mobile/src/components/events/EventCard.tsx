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
  variant?: 'card' | 'row';
  style?: StyleProp<ViewStyle>;
}

export function EventCard({
  event,
  onPress,
  variant = 'card',
  style,
}: EventCardProps) {
  const { colors } = useTheme();

  const parsedStartDate = event.starts_at ? new Date(event.starts_at) : null;
  const startDate = parsedStartDate && !Number.isNaN(parsedStartDate.getTime()) ? parsedStartDate : null;
  const dateStr = startDate
    ? startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Date to be announced';
  const timeStr = startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time TBA';
  const isOnline = event.location?.is_online;
  const locationName = event.location?.name;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
        },
        shadows.md,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}`}
    >
      <View style={[styles.eventIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
        <Icon name="calendar-outline" size={22} color={colors.interactive} />
      </View>

      <View style={styles.contentArea}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {event.title}
        </Text>

        <EventLiveCountdown
          startsAt={event.starts_at}
          endsAt={event.ends_at}
          status={event.status}
          compact
        />

        <View style={styles.metaStack}>
          <View style={styles.metaRow}>
            <Icon name="calendar-clear-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{dateStr}</Text>
            <Text style={[styles.dot, { color: colors.borderStrong }]}>·</Text>
            <Icon name="time-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeStr}</Text>
          </View>

          {locationName || isOnline ? (
            <View style={styles.metaRow}>
              <Icon name={isOnline && !locationName ? 'globe-outline' : 'location-outline'} size={13} color={isOnline ? colors.interactive : colors.textMuted} />
              <Text numberOfLines={1} style={[styles.metaText, { color: isOnline && !locationName ? colors.interactive : colors.textSecondary }]}>
                {locationName || 'Online gathering'}
              </Text>
            </View>
          ) : null}
        </View>

        {event.description ? (
          <Text numberOfLines={variant === 'row' ? 1 : 2} style={[styles.description, { color: colors.textMuted }]}>
            {event.description}
          </Text>
        ) : null}
      </View>

      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    lineHeight: 20,
  },
  metaStack: { gap: 4 },
  metaRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 1,
    fontSize: 13,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import type { Event } from '@/types/content';
import { radius, spacing, shadows, typography } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

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

  const startDate = event.starts_at ? new Date(event.starts_at) : new Date();
  const monthStr = startDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const dayStr = startDate.getDate().toString();
  const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isOnline = event.location?.is_online;
  const locationName = event.location?.name;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        shadows.sm,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}`}
    >
      {/* Date Block */}
      <View style={[styles.dateBlock, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.monthText, { color: colors.interactive }]}>{monthStr}</Text>
        <Text style={[styles.dayText, { color: colors.text }]}>{dayStr}</Text>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {event.title}
        </Text>

        <View style={styles.metaRow}>
          <Icon name="time-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeStr}</Text>

          {locationName ? (
            <>
              <Text style={[styles.dot, { color: colors.borderStrong }]}>·</Text>
              <Icon name="location-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text numberOfLines={1} style={[styles.metaText, { color: colors.textSecondary }]}>
                {locationName}
              </Text>
            </>
          ) : isOnline ? (
            <>
              <Text style={[styles.dot, { color: colors.borderStrong }]}>·</Text>
              <Icon name="globe-outline" size={13} color={colors.interactive} style={{ marginRight: 4 }} />
              <Text style={[styles.metaText, { color: colors.interactive }]}>Online Gathering</Text>
            </>
          ) : null}
        </View>

        {event.description ? (
          <Text numberOfLines={2} style={[styles.description, { color: colors.textMuted }]}>
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
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  dateBlock: {
    width: 52,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dayText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  contentArea: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    marginHorizontal: 5,
    fontSize: 14,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Badge } from '../Badge';
import { Icon } from '../primitives/Icon';
import type { PrayerRequest } from '@/types/content';

export interface PrayerCardProps {
  prayer: PrayerRequest;
  onPray?: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function PrayerCard({ prayer, onPray, busy = false, style }: PrayerCardProps) {
  const { colors } = useTheme();

  const isConfidential = prayer.privacy === 'pastoral_only';
  const isAnswered = prayer.status === 'answered';
  const hasPrayed = prayer.viewer_has_prayed === true;
  const prayerCount = prayer.prayer_count ?? 0;
  const prayerLabel = hasPrayed
    ? prayerCount > 1 ? `Praying · ${prayerCount}` : 'Praying'
    : prayerCount > 0 ? `${prayerCount} Praying` : 'Pray';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
        },
        shadows.md,
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          {isConfidential ? (
            <Badge label="PASTORAL ONLY" variant="prayer" icon={<Icon name="lock-closed" size={10} color="#8B5CF6" />} />
          ) : prayer.privacy === 'prayer_team' ? (
            <Badge label="PRAYER TEAM" variant="primary" />
          ) : (
            <Badge label="PRAYER WALL" variant="neutral" />
          )}

          {isAnswered ? (
            <Badge label="PRAISE REPORT" variant="success" />
          ) : null}
        </View>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {new Date(prayer.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{prayer.title}</Text>
      {prayer.request || prayer.description ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {prayer.request || prayer.description}
        </Text>
      ) : null}

      <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
        <View style={styles.memberInfo}>
          <Icon
            name={isConfidential ? 'shield-checkmark-outline' : 'person-outline'}
            size={14}
            color={colors.textMuted}
          />
          <Text style={[styles.memberName, { color: colors.textMuted }]}>
            {isConfidential ? 'Confidential Request' : prayer.is_anonymous ? 'Anonymous' : 'Member Request'}
          </Text>
        </View>

        {onPray ? (
          <Pressable
            onPress={onPray}
            disabled={busy || hasPrayed}
            hitSlop={6}
            style={({ pressed }) => [
              styles.prayBtn,
              { backgroundColor: hasPrayed ? colors.prayerSoft : colors.primarySoft },
              pressed && !busy && !hasPrayed ? styles.prayBtnPressed : null,
              busy ? styles.prayBtnBusy : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || hasPrayed, busy }}
            accessibilityLabel={hasPrayed ? 'You are praying for this request' : 'Pray for this request'}
          >
            <Icon name={hasPrayed ? 'heart' : 'heart-outline'} size={14} color={hasPrayed ? colors.prayer : colors.interactive} />
            <Text style={[styles.prayBtnText, { color: hasPrayed ? colors.prayer : colors.interactive }]}>
              {busy ? 'Saving…' : prayerLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeText: {
    fontSize: 11,
  },
  title: {
    ...typography.h3,
    fontSize: 16,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberName: {
    fontSize: 12,
  },
  prayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  prayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  prayBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  prayBtnBusy: {
    opacity: 0.7,
  },
});

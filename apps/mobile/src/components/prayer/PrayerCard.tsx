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
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function PrayerCard({ prayer, onPray, style }: PrayerCardProps) {
  const { colors } = useTheme();

  const isConfidential = prayer.privacy === 'pastoral_only';
  const isAnswered = prayer.status === 'answered';

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
            hitSlop={6}
            style={[styles.prayBtn, { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel="Pray for this request"
          >
            <Icon name="heart-outline" size={14} color={colors.interactive} />
            <Text style={[styles.prayBtnText, { color: colors.interactive }]}>
              {prayer.prayer_count && prayer.prayer_count > 0 ? `${prayer.prayer_count} Praying` : 'Pray'}
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
});

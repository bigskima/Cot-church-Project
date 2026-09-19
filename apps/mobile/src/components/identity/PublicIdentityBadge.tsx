import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '@/components/primitives/Icon';

export type PublicIdentityBadge = {
  id?: string;
  code?: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  priority?: number;
  badgeVariant?: string;
  organizationName?: string | null;
};

function borderForVariant(variant?: string) {
  if (variant === 'gold') return '#F4D77A';
  if (variant === 'silver') return '#E2E8F0';
  if (variant === 'blue') return '#93C5FD';
  if (variant === 'teal') return '#99F6E4';
  return 'rgba(255,255,255,0.55)';
}

export function CompactIdentityBadge({ badge, size = 18 }: { badge: PublicIdentityBadge; size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={badge.label + ' ministry badge'}
      style={[
        styles.compact,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: badge.backgroundColor,
          borderColor: borderForVariant(badge.badgeVariant),
        },
      ]}
    >
      <Icon name="ribbon" size={Math.max(10, size - 7)} color={badge.textColor} />
    </View>
  );
}

export function FullIdentityBadge({ badge }: { badge: PublicIdentityBadge }) {
  return (
    <View
      style={[
        styles.full,
        {
          backgroundColor: badge.backgroundColor,
          borderColor: borderForVariant(badge.badgeVariant),
        },
      ]}
    >
      <Icon name="ribbon" size={12} color={badge.textColor} />
      <Text style={[styles.fullText, { color: badge.textColor }]} numberOfLines={1}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  full: {
    minHeight: 26,
    maxWidth: 220,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fullText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
});

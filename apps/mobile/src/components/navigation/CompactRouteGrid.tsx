import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import { Icon } from '@/components/primitives/Icon';

export type CompactRouteItem = {
  key: string;
  label: string;
  icon: string;
  selected?: boolean;
  accessibilityLabel?: string;
  badge?: string;
  onPress: () => void;
};

type Props = {
  items: CompactRouteItem[];
  minColumns?: number;
  maxColumns?: number;
  compact?: boolean;
};

export function CompactRouteGrid({ items, minColumns = 4, maxColumns = 8, compact = false }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const columns = Math.min(
    maxColumns,
    Math.max(minColumns, width >= 1180 ? 8 : width >= 820 ? 6 : width >= 560 ? 5 : 4),
  );
  const itemWidth = `${100 / columns}%` as const;

  return (
    <View style={[styles.grid, compact && styles.compactGrid]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(item.selected) }}
          accessibilityLabel={item.accessibilityLabel || item.label}
          style={({ pressed }) => [
            styles.item,
            { width: itemWidth },
            compact && styles.compactItem,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.icon,
              compact && styles.compactIcon,
              {
                backgroundColor: item.selected ? colors.primarySoft : colors.bgSecondary,
                borderColor: item.selected ? colors.interactive : colors.borderSubtle,
              },
            ]}
          >
            <Icon
              name={item.icon as any}
              size={compact ? 18 : 20}
              color={item.selected ? colors.interactive : colors.textSecondary}
            />
            {item.badge ? <View style={[styles.badgeDot, { backgroundColor: colors.interactive }]} /> : null}
          </View>
          <Text
            style={[
              styles.label,
              compact && styles.compactLabel,
              { color: item.selected ? colors.interactive : colors.text },
            ]}
            numberOfLines={2}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    rowGap: spacing.md,
  },
  compactGrid: { rowGap: spacing.sm },
  item: {
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingHorizontal: 4,
  },
  compactItem: {
    minHeight: 60,
    gap: 4,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compactIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  badgeDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    top: 4,
    right: 4,
  },
  label: {
    maxWidth: 96,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  compactLabel: {
    fontSize: 9.5,
    lineHeight: 12,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },
});

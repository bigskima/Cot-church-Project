import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  count?: number;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
  style,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.bgSecondary,
          borderColor: selected ? colors.interactive : colors.borderSubtle,
        },
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected ? <View style={[styles.selectionDot, { backgroundColor: colors.interactive }]} /> : null}
      {icon && <View style={styles.iconSlot}>{icon}</View>}
      <Text
        style={[
          styles.label,
          {
            color: selected ? colors.interactive : colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: selected ? colors.card : colors.card,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              {
                color: selected ? colors.interactive : colors.textMuted,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.08,
  },
  selectionDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    marginRight: 6,
  },
  selected: {
    ...shadows.sm,
  },
  iconSlot: {
    marginRight: 6,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';

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
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? isDark
              ? '#FFFFFF'
              : '#0D294B'
            : colors.bgSecondary,
          borderColor: selected
            ? isDark
              ? '#FFFFFF'
              : '#0D294B'
            : colors.border,
        },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon && <View style={styles.iconSlot}>{icon}</View>}
      <Text
        style={[
          styles.label,
          {
            color: selected
              ? isDark
                ? '#0D294B'
                : '#FFFFFF'
              : colors.textSecondary,
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
              backgroundColor: selected
                ? isDark
                  ? 'rgba(13, 41, 75, 0.15)'
                  : 'rgba(255, 255, 255, 0.25)'
                : colors.card,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              {
                color: selected
                  ? isDark
                    ? '#0D294B'
                    : '#FFFFFF'
                  : colors.textMuted,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
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
    opacity: 0.75,
  },
});

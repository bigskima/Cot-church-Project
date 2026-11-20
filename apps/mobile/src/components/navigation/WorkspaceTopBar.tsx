import React, { type PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

/**
 * Shared chrome for General COT and Expression workspaces.
 *
 * It owns only the compact bar surface and spacing. Each workspace injects its
 * own quick navigation/actions, so route behavior stays scoped while the visual
 * shell remains consistent.
 */
export function WorkspaceTopBar({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.glass, borderColor: colors.borderSubtle },
        shadows.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { radius } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export type BadgeVariant =
  | 'live'
  | 'primary'
  | 'active'
  | 'success'
  | 'warning'
  | 'info'
  | 'prayer'
  | 'neutral'
  | 'outline'
  | 'gold';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  pulse?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

export function Badge({
  label,
  variant = 'neutral',
  pulse = false,
  icon,
  style,
  size = 'sm',
}: BadgeProps) {
  const { colors } = useTheme();

  const getStyles = () => {
    switch (variant) {
      case 'live':
        return {
          container: { backgroundColor: colors.liveSoft, borderColor: colors.live },
          text: { color: colors.live },
          dot: colors.live,
        };
      case 'active':
      case 'success':
        return {
          container: { backgroundColor: colors.successSoft, borderColor: colors.success },
          text: { color: colors.success },
          dot: colors.success,
        };
      case 'warning':
        return {
          container: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
          text: { color: colors.warning },
          dot: colors.warning,
        };
      case 'prayer':
        return {
          container: { backgroundColor: colors.prayerSoft, borderColor: colors.prayer },
          text: { color: colors.prayer },
          dot: colors.prayer,
        };
      case 'outline':
        return {
          container: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
          text: { color: colors.textSecondary },
          dot: colors.textSecondary,
        };
      case 'gold':
      case 'primary':
      case 'info':
        return {
          container: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong },
          text: { color: colors.interactive },
          dot: colors.interactive,
        };
      case 'neutral':
      default:
        return {
          container: { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
          text: { color: colors.textSecondary },
          dot: colors.textMuted,
        };
    }
  };

  const v = getStyles();

  return (
    <View style={[styles.base, size === 'md' ? styles.sizeMd : styles.sizeSm, v.container, style]}>
      {pulse ? <View style={[styles.pulseDot, { backgroundColor: v.dot }]} /> : null}
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={[styles.text, size === 'md' ? styles.textMd : styles.textSm, v.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  sizeSm: { minHeight: 23, paddingHorizontal: 8, paddingVertical: 3 },
  sizeMd: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 5 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  iconContainer: { marginRight: 4 },
  text: { fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  textSm: { fontSize: 9, lineHeight: 12 },
  textMd: { fontSize: 10, lineHeight: 14 },
});

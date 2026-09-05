import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'live'
  | 'gold';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  badge?: string | number;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  style,
  textStyle,
  badge,
  fullWidth = false,
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle; indicatorColor: string } => {
    switch (variant) {
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.cardElevated,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            ...shadows.sm,
          },
          text: { color: colors.text },
          indicatorColor: colors.text,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: colors.borderStrong,
            borderWidth: 1,
          },
          text: { color: colors.text },
          indicatorColor: colors.text,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
          },
          text: { color: colors.textSecondary },
          indicatorColor: colors.textSecondary,
        };
      case 'destructive':
      case 'live':
        return {
          container: {
            backgroundColor: colors.live,
            borderColor: colors.live,
            borderWidth: 1,
            ...(variant === 'live' ? shadows.live : shadows.sm),
          },
          text: { color: '#FFFFFF' },
          indicatorColor: '#FFFFFF',
        };
      case 'gold':
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: colors.interactive,
            borderColor: colors.interactive,
            borderWidth: 1,
            ...shadows.sm,
          },
          text: { color: '#FFFFFF' },
          indicatorColor: '#FFFFFF',
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingVertical: 7,
            paddingHorizontal: spacing.md,
            minHeight: 36,
            borderRadius: radius.pill,
          },
          text: {
            ...typography.caption,
            fontWeight: '700',
          },
        };
      case 'lg':
        return {
          container: {
            paddingVertical: 14,
            paddingHorizontal: spacing.xxl,
            minHeight: 54,
            borderRadius: radius.lg,
          },
          text: {
            ...typography.h3,
            fontWeight: '700',
          },
        };
      case 'md':
      default:
        return {
          container: {
            paddingVertical: 11,
            paddingHorizontal: spacing.xl,
            minHeight: 46,
            borderRadius: radius.lg,
          },
          text: {
            ...typography.bodySmall,
            fontWeight: '700',
          },
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        vStyles.container,
        sStyles.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && !loading && {
          opacity: 0.9,
          transform: [{ scale: 0.985 }],
          backgroundColor: variant === 'primary' ? colors.interactiveHover : undefined,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.indicatorColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.baseText, sStyles.text, vStyles.text, textStyle]}>{label}</Text>
          {badge !== undefined && (
            <View style={[styles.badgeWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.22)' }]}>
              <Text style={[styles.badgeText, { color: vStyles.text.color }]}>{badge}</Text>
            </View>
          )}
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outline' | 'ghost' | 'accent';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}

export function IconButton({
  icon,
  onPress,
  size = 'md',
  variant = 'default',
  disabled = false,
  style,
  accessibilityLabel,
}: IconButtonProps) {
  const { colors } = useTheme();
  const dim = size === 'sm' ? 34 : size === 'lg' ? 50 : 42;

  const getBgStyle = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return { backgroundColor: colors.bgSecondary, borderWidth: 0 };
      case 'outline':
        return { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border };
      case 'ghost':
        return { backgroundColor: 'transparent', borderWidth: 0 };
      case 'accent':
        return { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoftStrong };
      case 'default':
      default:
        return { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSubtle, ...shadows.sm };
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        getBgStyle(),
        disabled && styles.disabled,
        pressed && { opacity: 0.82, transform: [{ scale: 0.95 }] },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    textAlign: 'center',
    letterSpacing: -0.15,
  },
  iconLeft: { marginRight: 7 },
  iconRight: { marginLeft: 7 },
  badgeWrapper: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  disabled: { opacity: 0.42 },
});

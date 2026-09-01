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
import { radius, spacing, typography } from '@/design-system/tokens';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'live'
  | 'gold'; // backwards compatibility mapping

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
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle; indicatorColor: string } => {
    switch (variant) {
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.border,
            borderWidth: 1,
          },
          text: {
            color: colors.text,
          },
          indicatorColor: colors.text,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: colors.borderStrong,
            borderWidth: 1,
          },
          text: {
            color: colors.interactive,
          },
          indicatorColor: colors.interactive,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
          },
          text: {
            color: colors.textSecondary,
          },
          indicatorColor: colors.textSecondary,
        };
      case 'destructive':
        return {
          container: {
            backgroundColor: '#E5484D',
            borderColor: '#E5484D',
            borderWidth: 1,
          },
          text: {
            color: '#FFFFFF',
          },
          indicatorColor: '#FFFFFF',
        };
      case 'live':
        return {
          container: {
            backgroundColor: '#E5484D',
            borderColor: '#E5484D',
            borderWidth: 1,
          },
          text: {
            color: '#FFFFFF',
          },
          indicatorColor: '#FFFFFF',
        };
      case 'gold':
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: isDark ? '#FFFFFF' : '#0D294B',
            borderColor: isDark ? '#FFFFFF' : '#0D294B',
            borderWidth: 1,
          },
          text: {
            color: isDark ? '#0D294B' : '#FFFFFF',
          },
          indicatorColor: isDark ? '#0D294B' : '#FFFFFF',
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            minHeight: 34,
            borderRadius: radius.md,
          },
          text: {
            fontSize: 13,
            fontWeight: '600',
          },
        };
      case 'lg':
        return {
          container: {
            paddingVertical: 14,
            paddingHorizontal: spacing.xxl,
            minHeight: 52,
            borderRadius: radius.lg,
          },
          text: {
            fontSize: 16,
            fontWeight: '600',
          },
        };
      case 'md':
      default:
        return {
          container: {
            paddingVertical: 10,
            paddingHorizontal: spacing.lg,
            minHeight: 44,
            borderRadius: radius.md,
          },
          text: {
            fontSize: 14,
            fontWeight: '600',
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
        disabled && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.indicatorColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.baseText, sStyles.text, vStyles.text, textStyle]}>
            {label}
          </Text>
          {badge !== undefined && (
            <View style={[styles.badgeWrapper, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>{badge}</Text>
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
  variant?: 'default' | 'filled' | 'outline' | 'ghost';
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

  const dim = size === 'sm' ? 32 : size === 'lg' ? 48 : 40;

  const getBgStyle = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return { backgroundColor: colors.bgSecondary, borderWidth: 0 };
      case 'outline':
        return { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border };
      case 'ghost':
        return { backgroundColor: 'transparent', borderWidth: 0 };
      case 'default':
      default:
        return { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border };
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
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  iconLeft: {
    marginRight: spacing.xs + 2,
  },
  iconRight: {
    marginLeft: spacing.xs + 2,
  },
  badgeWrapper: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

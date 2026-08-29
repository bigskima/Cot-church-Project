import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette, radius, shadows, spacing } from '../design-system/tokens';

export type ButtonVariant = 'gold' | 'primary' | 'secondary' | 'outline' | 'live' | 'glass' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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
  badge,
}: ButtonProps) {
  const getContainerStyle = () => {
    switch (variant) {
      case 'gold':
        return [styles.gold, shadows.glowGold];
      case 'live':
        return [styles.live, shadows.glowLive];
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'glass':
        return styles.glass;
      case 'ghost':
        return styles.ghost;
      case 'primary':
      default:
        return [styles.primary, shadows.md];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'gold':
        return styles.goldText;
      case 'live':
        return styles.liveText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'glass':
        return styles.glassText;
      case 'ghost':
        return styles.ghostText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      case 'md':
      default:
        return styles.sizeMd;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.textSizeSm;
      case 'lg':
        return styles.textSizeLg;
      case 'md':
      default:
        return styles.textSizeMd;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        getSizeStyle(),
        getContainerStyle(),
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'gold' || variant === 'ghost' ? palette.midnight : palette.white}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.textBase, getTextSizeStyle(), getTextStyle()]}>{label}</Text>
          {badge !== undefined && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  textBase: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  // Sizes
  sizeSm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  sizeMd: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  sizeLg: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  textSizeSm: {
    fontSize: 13,
  },
  textSizeMd: {
    fontSize: 15,
  },
  textSizeLg: {
    fontSize: 17,
  },
  // Variants
  primary: {
    backgroundColor: palette.navy,
  },
  primaryText: {
    color: palette.white,
  },
  gold: {
    backgroundColor: palette.gold,
  },
  goldText: {
    color: palette.midnight,
    fontWeight: '900',
  },
  live: {
    backgroundColor: palette.live,
  },
  liveText: {
    color: palette.white,
    fontWeight: '900',
  },
  secondary: {
    backgroundColor: palette.surfaceDarkElevated,
  },
  secondaryText: {
    color: palette.white,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  outlineText: {
    color: palette.ink,
  },
  glass: {
    backgroundColor: '#FFFFFF1F',
    borderWidth: 1,
    borderColor: palette.glassBorder,
  },
  glassText: {
    color: palette.white,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: palette.blue,
  },
  // Badge
  badgeContainer: {
    backgroundColor: '#00000026',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: spacing.xs + 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.white,
  },
});

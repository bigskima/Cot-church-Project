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
        return styles.textSm;
      case 'lg':
        return styles.textLg;
      case 'md':
      default:
        return styles.textMd;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        getContainerStyle(),
        getSizeStyle(),
        (disabled || loading) ? styles.disabled : null,
        (pressed && !disabled && !loading) ? styles.pressed : null,
        style,
      ] as any}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'gold' ? '#140C07' : '#FFFFFF'}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconSlotLeft}>{icon}</View>}
          <Text style={[styles.baseText, getTextStyle(), getTextSizeStyle()] as any}>
            {label}
          </Text>
          {badge !== undefined && (
            <View style={styles.badgeWrapper}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {iconRight && <View style={styles.iconSlotRight}>{iconRight}</View>}
        </View>
      )}
    </Pressable>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  sizeLg: {
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  textSm: {
    fontSize: 13,
  },
  textMd: {
    fontSize: 15,
  },
  textLg: {
    fontSize: 17,
  },
  gold: {
    backgroundColor: palette.yellow,
    borderColor: '#D97706',
  },
  goldText: {
    color: '#140C07',
  },
  primary: {
    backgroundColor: '#2E1C11',
    borderColor: '#452A1A',
  },
  primaryText: {
    color: '#FFFDF9',
  },
  secondary: {
    backgroundColor: '#F1E3D3',
    borderColor: '#E8D5C4',
  },
  secondaryText: {
    color: '#26140A',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: '#E8D5C4',
  },
  outlineText: {
    color: '#78350F',
  },
  live: {
    backgroundColor: palette.live,
    borderColor: '#B91C1C',
  },
  liveText: {
    color: '#FFFFFF',
  },
  glass: {
    backgroundColor: 'rgba(255, 253, 249, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  glassText: {
    color: '#FFFDF9',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: '#8C6549',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  iconSlotLeft: {
    marginRight: spacing.xs + 2,
  },
  iconSlotRight: {
    marginLeft: spacing.xs + 2,
  },
  badgeWrapper: {
    backgroundColor: 'rgba(20, 12, 7, 0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: 'inherit' as any,
  },
});

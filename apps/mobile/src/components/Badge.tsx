import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing } from '../design-system/tokens';

export type BadgeVariant = 'live' | 'gold' | 'success' | 'prayer' | 'giving' | 'neutral' | 'outline';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  pulse?: boolean;
  icon?: React.ReactNode;
}

export function Badge({ label, variant = 'neutral', pulse = false, icon }: BadgeProps) {
  const getContainerStyle = () => {
    switch (variant) {
      case 'live':
        return styles.live;
      case 'gold':
        return styles.gold;
      case 'success':
        return styles.success;
      case 'prayer':
        return styles.prayer;
      case 'giving':
        return styles.giving;
      case 'outline':
        return styles.outline;
      case 'neutral':
      default:
        return styles.neutral;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'live':
        return styles.liveText;
      case 'gold':
        return styles.goldText;
      case 'success':
        return styles.successText;
      case 'prayer':
        return styles.prayerText;
      case 'giving':
        return styles.givingText;
      case 'outline':
        return styles.outlineText;
      case 'neutral':
      default:
        return styles.neutralText;
    }
  };

  return (
    <View style={[styles.base, getContainerStyle()]}>
      {pulse && <View style={[styles.pulseDot, { backgroundColor: variant === 'live' ? palette.white : palette.gold }]} />}
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.text, getTextStyle()]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  live: {
    backgroundColor: palette.live,
  },
  liveText: {
    color: palette.white,
  },
  gold: {
    backgroundColor: '#FBF2DA',
    borderWidth: 1,
    borderColor: '#F3D27E',
  },
  goldText: {
    color: palette.goldDark,
  },
  success: {
    backgroundColor: '#E8F5EE',
  },
  successText: {
    color: palette.success,
  },
  prayer: {
    backgroundColor: '#F2EFFB',
  },
  prayerText: {
    color: palette.prayer,
  },
  giving: {
    backgroundColor: '#ECFDF5',
  },
  givingText: {
    color: palette.giving,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.glassBorderDark,
  },
  outlineText: {
    color: palette.mutedLight,
  },
  neutral: {
    backgroundColor: palette.surfaceSubtle,
  },
  neutralText: {
    color: palette.inkSecondary,
  },
});

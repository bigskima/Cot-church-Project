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
    <View style={[styles.base, getContainerStyle()] as any}>
      {pulse && (
        <View
          style={[
            styles.pulseDot,
            { backgroundColor: variant === 'live' ? '#FFFFFF' : '#F59E0B' },
          ]}
        />
      )}
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.text, getTextStyle()] as any}>{label}</Text>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  live: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  liveText: {
    color: '#EF4444',
  },
  gold: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  goldText: {
    color: '#B45309',
  },
  success: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  successText: {
    color: '#10B981',
  },
  prayer: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  prayerText: {
    color: '#8B5CF6',
  },
  giving: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  givingText: {
    color: '#92400E',
  },
  neutral: {
    backgroundColor: '#F1E3D3',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  neutralText: {
    color: '#5C3D28',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  outlineText: {
    color: '#78350F',
  },
});

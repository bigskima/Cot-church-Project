import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { radius, spacing } from '@/design-system/tokens';

export type BadgeVariant =
  | 'live'
  | 'primary'
  | 'success'
  | 'warning'
  | 'info'
  | 'prayer'
  | 'neutral'
  | 'outline'
  | 'gold'; // backwards compatibility

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
  const getStyles = () => {
    switch (variant) {
      case 'live':
        return {
          container: { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.35)', borderWidth: 1 },
          text: { color: '#E5484D' },
          dot: '#E5484D',
        };
      case 'success':
        return {
          container: { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)', borderWidth: 1 },
          text: { color: '#16A36A' },
          dot: '#16A36A',
        };
      case 'warning':
        return {
          container: { backgroundColor: 'rgba(233, 162, 59, 0.12)', borderColor: 'rgba(233, 162, 59, 0.3)', borderWidth: 1 },
          text: { color: '#E9A23B' },
          dot: '#E9A23B',
        };
      case 'prayer':
        return {
          container: { backgroundColor: 'rgba(139, 92, 246, 0.12)', borderColor: 'rgba(139, 92, 246, 0.3)', borderWidth: 1 },
          text: { color: '#8B5CF6' },
          dot: '#8B5CF6',
        };
      case 'outline':
        return {
          container: { backgroundColor: 'transparent', borderColor: '#CBD5E1', borderWidth: 1 },
          text: { color: '#475467' },
          dot: '#475467',
        };
      case 'gold':
      case 'primary':
      case 'info':
        return {
          container: { backgroundColor: '#EAF1FA', borderColor: '#CBDDF8', borderWidth: 1 },
          text: { color: '#18528B' },
          dot: '#2F6FED',
        };
      case 'neutral':
      default:
        return {
          container: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1 },
          text: { color: '#475467' },
          dot: '#64748B',
        };
    }
  };

  const v = getStyles();

  return (
    <View
      style={[
        styles.base,
        size === 'md' ? styles.sizeMd : styles.sizeSm,
        v.container,
        style,
      ]}
    >
      {pulse && <View style={[styles.pulseDot, { backgroundColor: v.dot }]} />}
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.text, size === 'md' ? styles.textMd : styles.textSm, v.text]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  sizeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sizeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textSm: {
    fontSize: 10,
    lineHeight: 13,
  },
  textMd: {
    fontSize: 11,
    lineHeight: 15,
  },
});

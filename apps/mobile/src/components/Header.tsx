import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { palette, radius, spacing } from '../design-system/tokens';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  dark = false,
  style,
}: ScreenHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.headerContainer, dark && styles.headerDark, style]}>
      <View style={styles.topRow}>
        {showBack && (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              dark ? styles.backButtonDark : styles.backButtonLight,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.backIcon, dark ? styles.textWhite : styles.textInk]}>‹</Text>
            <Text style={[styles.backLabel, dark ? styles.textWhite : styles.textInk]}>Back</Text>
          </Pressable>
        )}
        <View style={styles.spacer} />
        {rightAction && <View style={styles.rightActionContainer}>{rightAction}</View>}
      </View>
      <Text style={[styles.title, dark ? styles.textWhite : styles.textInk]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, dark ? styles.textMutedDark : styles.textMutedLight]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  actionLabel?: string;
  onAction?: () => void;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  actionLabel,
  onAction,
  dark = false,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.sectionContainer, style]}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, dark ? styles.textWhite : styles.textInk]}>
          {title}
        </Text>
        {badge !== undefined && (
          <View
            style={[
              styles.sectionBadge,
              { backgroundColor: dark ? '#2E1C11' : '#F1E3D3' },
            ]}
          >
            <Text
              style={[
                styles.sectionBadgeText,
                { color: dark ? '#FDE047' : '#78350F' },
              ]}
            >
              {badge}
            </Text>
          </View>
        )}
      </View>
      {subtitle && (
        <Text style={[styles.sectionSubtitle, dark ? styles.textMutedDark : styles.textMutedLight]}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null] as any}
        >
          <Text style={[styles.actionLabel, { color: dark ? '#FDE047' : '#B45309' }] as any}>
            {actionLabel} ➔
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  headerContainer: {
    paddingTop: 54,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerDark: {
    backgroundColor: '#140C07',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    minHeight: 36,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  backButtonLight: {
    backgroundColor: '#F1E3D3',
  },
  backButtonDark: {
    backgroundColor: '#2E1C11',
  },
  backIcon: {
    fontSize: 18,
    fontWeight: '900',
    marginRight: 4,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  spacer: {
    flex: 1,
  },
  rightActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  textWhite: {
    color: '#FFFDF9',
  },
  textInk: {
    color: '#26140A',
  },
  textMutedLight: {
    color: '#8C6549',
  },
  textMutedDark: {
    color: '#A68A75',
  },
  pressed: {
    opacity: 0.75,
  },
  sectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
});

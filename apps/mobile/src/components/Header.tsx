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
  actionLabel?: string;
  onAction?: () => void;
  badge?: string | number;
  dark?: boolean;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  badge,
  dark = false,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, dark ? styles.textWhite : styles.textInk]}>{title}</Text>
        {badge !== undefined && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {actionLabel && (
        <Pressable onPress={onAction} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[styles.actionLabel, { color: dark ? palette.gold : palette.blue }]}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: spacing.md,
  },
  headerDark: {
    backgroundColor: palette.midnight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  backButtonLight: {
    backgroundColor: '#0000000A',
  },
  backButtonDark: {
    backgroundColor: '#FFFFFF1A',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '700',
    marginRight: 4,
    marginTop: -2,
  },
  backLabel: {
    fontSize: 14,
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
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 22,
  },
  textWhite: {
    color: palette.white,
  },
  textInk: {
    color: palette.ink,
  },
  textMutedDark: {
    color: palette.mutedLight,
  },
  textMutedLight: {
    color: palette.muted,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.ink,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});

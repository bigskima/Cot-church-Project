import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Icon } from './primitives/Icon';
import { BrandMark } from './primitives/BrandMark';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  kicker?: string;
  compact?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  style,
  kicker,
  compact = false,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View
      style={[
        styles.headerContainer,
        compact && styles.headerCompact,
        {
          backgroundColor: colors.glass,
          borderColor: colors.borderSubtle,
        },
        shadows.sm,
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.headerGlow, { backgroundColor: colors.primarySoft }]} />

      <View style={styles.topRow}>
        <View style={styles.headerIdentity}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              hitSlop={8}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle },
                pressed && { backgroundColor: colors.pressed, transform: [{ scale: 0.96 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Icon name="chevron-back" size={21} color={colors.text} />
            </Pressable>
          ) : null}

          <View style={[styles.brandShell, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }]}>
            <BrandMark variant="header" size={30} />
          </View>

          <View style={styles.identityCopy}>
            <Text style={[styles.identityLabel, { color: colors.textMuted }]}>CITY OF TRANSFORMATION</Text>
            {kicker ? (
              <View style={[styles.kickerPill, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.kickerText, { color: colors.interactive }]}>{kicker}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {rightAction ? <View style={styles.rightActionContainer}>{rightAction}</View> : null}
      </View>

      <View style={styles.titleBlock}>
        <Text style={[compact ? styles.compactTitle : styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
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

export function SectionHeader({ title, subtitle, badge, actionLabel, onAction, style }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.sectionContainer, style]}>
      <View style={styles.sectionCopy}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          {badge !== undefined ? (
            <View style={[styles.sectionBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.sectionBadgeText, { color: colors.interactive }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.bgSecondary },
            pressed && { backgroundColor: colors.pressed },
          ]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionLabel, { color: colors.text }]}>{actionLabel}</Text>
          <Icon name="chevron-forward" size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.xxl,
  },
  headerCompact: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -58,
    top: -82,
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    minHeight: 42,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandShell: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: 4,
  },
  identityLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.85,
  },
  titleBlock: {
    gap: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  kickerPill: {
    minHeight: 24,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickerText: { ...typography.kicker },
  spacer: { flex: 1 },
  rightActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 2,
  },
  title: { ...typography.display, fontWeight: '900', letterSpacing: -1.1 },
  compactTitle: { ...typography.h1, fontWeight: '900' },
  subtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    maxWidth: 680,
  },
  sectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.h2, fontWeight: '900', letterSpacing: -0.5 },
  sectionBadge: {
    minWidth: 24,
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionSubtitle: {
    ...typography.caption,
    marginTop: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});

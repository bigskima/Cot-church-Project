import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheet, Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export type ExpressionManagementSection =
  | 'tools'
  | 'studio'
  | 'live'
  | 'sermons'
  | 'events'
  | 'announcements'
  | 'testimonies'
  | 'prayer'
  | 'leadership'
  | 'invites'
  | 'access'
  | 'giving'
  | 'finance'
  | 'books'
  | 'settings';

type Props = {
  expressionId: string;
  expressionName: string;
  active: ExpressionManagementSection;
  title: string;
  subtitle: string;
  icon: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
};

const destinations: Array<{ key: ExpressionManagementSection; label: string; description: string; icon: string }> = [
  { key: 'tools', label: 'Tools', description: 'Expression operations and shortcuts', icon: 'grid-outline' },
  { key: 'studio', label: 'Studio', description: 'Create and publish Expression content', icon: 'color-wand-outline' },
  { key: 'live', label: 'Live', description: 'Prepare and manage broadcasts', icon: 'radio-outline' },
  { key: 'sermons', label: 'Sermons', description: 'Create and manage teaching', icon: 'book-outline' },
  { key: 'events', label: 'Events', description: 'Plan Expression events', icon: 'calendar-outline' },
  { key: 'announcements', label: 'Updates', description: 'Publish announcements and notices', icon: 'megaphone-outline' },
  { key: 'testimonies', label: 'Testimony', description: 'Review testimony submissions', icon: 'document-text-outline' },
  { key: 'prayer', label: 'Prayer inbox', description: 'Review prayer requests', icon: 'heart-outline' },
  { key: 'leadership', label: 'Leaders', description: 'Manage Expression leadership', icon: 'people-circle-outline' },
  { key: 'invites', label: 'Invites', description: 'Manage Expression invite codes', icon: 'key-outline' },
  { key: 'access', label: 'Access', description: 'Ownership, roles and team access', icon: 'shield-checkmark-outline' },
  { key: 'giving', label: 'Giving', description: 'Configure Expression giving', icon: 'gift-outline' },
  { key: 'finance', label: 'Giving reports', description: 'Review giving activity and reports', icon: 'analytics-outline' },
  { key: 'books', label: 'Finance', description: 'Expression finance workspace', icon: 'wallet-outline' },
  { key: 'settings', label: 'Settings', description: 'Expression profile and preferences', icon: 'settings-outline' },
];

function sectionPath(expressionId: string, key: ExpressionManagementSection) {
  if (key === 'tools') return `/expressions/${expressionId}/manage`;
  if (key === 'studio') return `/expressions/${expressionId}/manage/studio`;
  if (key === 'live') return `/expressions/${expressionId}/manage/live`;
  if (key === 'sermons') return `/expressions/${expressionId}/manage/sermons`;
  if (key === 'events') return `/expressions/${expressionId}/manage/events`;
  if (key === 'announcements') return `/expressions/${expressionId}/manage/announcements`;
  if (key === 'testimonies') return `/expressions/${expressionId}/manage/testimonies`;
  if (key === 'prayer') return `/expressions/${expressionId}/manage/prayer`;
  if (key === 'leadership') return `/expressions/${expressionId}/manage/leadership`;
  if (key === 'invites') return `/expressions/${expressionId}/manage/invite-codes`;
  if (key === 'access') return `/expressions/${expressionId}/manage/access`;
  if (key === 'giving') return `/expressions/${expressionId}/manage/giving`;
  if (key === 'finance') return `/expressions/${expressionId}/manage/finance`;
  if (key === 'books') return `/expressions/${expressionId}/manage/books`;
  return `/expressions/${expressionId}/manage/settings`;
}

export function ExpressionManagementHeader({
  expressionId,
  expressionName,
  active,
  title,
  subtitle,
  icon,
  actionLabel,
  actionIcon = 'add-outline',
  onAction,
}: Props) {
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleDestinations = destinations.filter((item) => {
    if (item.key === 'tools') return access.canManageAny;
    if (item.key === 'studio') return access.canUseContentStudio;
    if (item.key === 'live') return access.canManageLive;
    if (item.key === 'sermons') return access.canManageSermons;
    if (item.key === 'events') return access.canManageEvents;
    if (item.key === 'announcements') return access.canManageAnnouncements;
    if (item.key === 'testimonies') return access.canReviewTestimonies;
    if (item.key === 'prayer') return access.canManagePrayer;
    if (item.key === 'leadership') return access.canManageLeadership;
    if (item.key === 'invites') return access.canManageInviteCodes;
    if (item.key === 'access') return access.canManageAccess;
    if (item.key === 'giving') return access.canManageGiving;
    if (item.key === 'finance') return access.canReadGivingFinance;
    if (item.key === 'books') return access.canReadExpressionFinance;
    return access.canManageSettings;
  });
  const activeDestination = visibleDestinations.find((item) => item.key === active);

  const openDestination = (key: ExpressionManagementSection) => {
    setMenuOpen(false);
    if (key === active) return;
    router.push(sectionPath(expressionId, key) as any);
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Icon name={icon as any} size={19} color={colors.interactive} />
          </View>
          <View style={styles.copy}>
            <View style={styles.eyebrowRow}>
              <Icon name="shield-checkmark-outline" size={10} color={colors.interactive} />
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION OPERATIONS</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
            <Text style={[styles.expression, { color: colors.textMuted }]} numberOfLines={1}>{expressionName}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push(`/expressions/${expressionId}` as any)}
              accessibilityRole="button"
              accessibilityLabel="Expression home"
              style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed ? styles.pressed : null]}
            >
              <Icon name="home-outline" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open Expression management menu"
              style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed ? styles.pressed : null]}
            >
              <Icon name="ellipsis-horizontal" size={19} color={colors.interactive} />
            </Pressable>
          </View>
        </View>

        <View style={styles.footerRow}>
          {onAction && actionLabel ? (
            <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} style={({ pressed }) => [styles.actionLink, pressed ? styles.pressed : null]}>
              <Icon name={actionIcon as any} size={12} color={colors.interactive} />
              <Text style={[styles.actionText, { color: colors.interactive }]}>{actionLabel}</Text>
            </Pressable>
          ) : <View />}
          {activeDestination ? (
            <Pressable onPress={() => setMenuOpen(true)} style={styles.currentRow} accessibilityRole="button" accessibilityLabel={`Current section ${activeDestination.label}. Open menu`}>
              <Text style={[styles.currentText, { color: colors.textMuted }]}>Management menu</Text>
              <Text style={[styles.currentDot, { color: colors.textMuted }]}>·</Text>
              <Text style={[styles.currentActive, { color: colors.interactive }]}>{activeDestination.label}</Text>
              <Icon name="chevron-down" size={13} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Expression management" subtitle={`${expressionName} · choose a management area`} maxHeightPercent={84}>
        <View style={styles.menuList}>
          {visibleDestinations.map((destination) => {
            const selected = destination.key === active;
            return (
              <Pressable
                key={destination.key}
                onPress={() => openDestination(destination.key)}
                style={({ pressed }) => [styles.menuItem, { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.interactive : colors.borderSubtle }, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[styles.menuIcon, { backgroundColor: selected ? colors.card : colors.bgSecondary }]}>
                  <Icon name={destination.icon as any} size={19} color={selected ? colors.interactive : colors.textSecondary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>{destination.label}</Text>
                  <Text style={[styles.menuDescription, { color: colors.textMuted }]} numberOfLines={1}>{destination.description}</Text>
                </View>
                {selected ? <Icon name="checkmark-circle" size={18} color={colors.interactive} /> : <Icon name="chevron-forward" size={16} color={colors.textMuted} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.xs, padding: spacing.sm, borderWidth: 1, borderRadius: radius.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.75 },
  title: { fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3, marginTop: 1 },
  subtitle: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  expression: { fontSize: 9, lineHeight: 12, marginTop: 2, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roundButton: { width: 35, height: 35, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footerRow: { minHeight: 27, paddingTop: 5, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  currentText: { fontSize: 8.5, fontWeight: '700' },
  currentDot: { fontSize: 9 },
  currentActive: { fontSize: 8.5, fontWeight: '900' },
  actionLink: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 8.5, lineHeight: 12, fontWeight: '900' },
  menuList: { gap: spacing.xs },
  menuItem: { minHeight: 62, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 13, fontWeight: '900' },
  menuDescription: { fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});

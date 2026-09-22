import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { CompactRouteGrid } from '@/components/navigation/CompactRouteGrid';
import { Icon } from '@/components/primitives/Icon';
import { radius, spacing } from '@/design-system/tokens';
import { COT_MINISTRY_GUIDE_URL } from '@/constants/guides';
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

const tabs: Array<{ key: ExpressionManagementSection; label: string; description: string; icon: string }> = [
  { key: 'tools', label: 'Tools', description: 'Expression operations and shortcuts', icon: 'grid-outline' },
  { key: 'studio', label: 'Studio', description: 'Create and publish Expression content', icon: 'color-wand-outline' },
  { key: 'live', label: 'Live', description: 'Prepare and manage broadcasts', icon: 'radio-outline' },
  { key: 'sermons', label: 'Sermons', description: 'Create and manage teaching', icon: 'book-outline' },
  { key: 'events', label: 'Events', description: 'Plan Expression events', icon: 'calendar-outline' },
  { key: 'announcements', label: 'Updates', description: 'Publish announcements and notices', icon: 'megaphone-outline' },
  { key: 'testimonies', label: 'Testimony', description: 'Review testimony submissions', icon: 'document-text-outline' },
  { key: 'prayer', label: 'Prayer', description: 'Review prayer requests', icon: 'heart-outline' },
  { key: 'leadership', label: 'Leaders', description: 'Manage Expression leadership', icon: 'people-circle-outline' },
  { key: 'invites', label: 'Invites', description: 'Manage Expression invite codes', icon: 'key-outline' },
  { key: 'access', label: 'Access', description: 'Ownership, roles and team access', icon: 'shield-checkmark-outline' },
  { key: 'giving', label: 'Giving', description: 'Configure Expression giving', icon: 'gift-outline' },
  { key: 'finance', label: 'Reports', description: 'Review giving activity and reports', icon: 'analytics-outline' },
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

  const visibleTabs = tabs.filter((item) => {
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

  const openDestination = (key: ExpressionManagementSection) => {
    setMenuOpen(false);
    if (key === active) return;
    router.push(sectionPath(expressionId, key) as any);
  };

  return (
    <>
      <View
        accessibilityRole="header"
        accessibilityLabel={`${title}. ${subtitle}. ${expressionName}`}
        style={[styles.bar, { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon as any} size={17} color={colors.interactive} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>

        {onAction && actionLabel ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
          >
            <Icon name={actionIcon as any} size={17} color={colors.interactive} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => void Linking.openURL(COT_MINISTRY_GUIDE_URL)}
          accessibilityRole="link"
          accessibilityLabel="Open the COT App Ministry Roles and Operations Guide"
          style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
        >
          <Icon name="book-outline" size={17} color={colors.interactive} />
        </Pressable>

        <Pressable
          onPress={() => router.push(`/expressions/${expressionId}` as any)}
          accessibilityRole="button"
          accessibilityLabel="Expression home"
          style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
        >
          <Icon name="home-outline" size={16} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Expression management routes"
          style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
        >
          <Icon name="ellipsis-horizontal" size={19} color={colors.interactive} />
        </Pressable>
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Manage" maxHeightPercent={76} compact>
        <CompactRouteGrid
          compact
          items={visibleTabs.map((destination) => ({
            key: destination.key,
            label: destination.label,
            icon: destination.icon,
            selected: destination.key === active,
            accessibilityLabel: `${destination.label}. ${destination.description}`,
            onPress: () => openDestination(destination.key),
          }))}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 50,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 19, fontWeight: '900', letterSpacing: -0.25 },
  roundButton: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});

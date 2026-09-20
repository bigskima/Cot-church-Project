import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, CompactRouteGrid, EmptyState, Icon, Skeleton } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { type GeneralMinistryArea, useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type Tool = {
  key: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  area: GeneralMinistryArea;
  badge: string;
  enabled: boolean;
  priority?: boolean;
};

type Filter = 'All' | GeneralMinistryArea;

export default function GeneralMinistryWorkspace() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { context, mode } = useSession();
  const access = useGeneralMinistryAccess();
  const [filter, setFilter] = useState<Filter>('All');
  const profile = context?.profile;
  const displayName = profile?.display_name?.trim() || 'Church Member';
  const workspaceReady = access.accessReady;
  const hasWorkspaceAccess = access.hasAnyMinistryAccess;

  const tools = useMemo<Tool[]>(() => [
    { key: 'studio', title: 'Creator Studio', description: 'Start public posts, voice, Reels, videos and other creation flows.', icon: 'add-circle-outline', route: '/general/studio', area: 'Create', badge: 'CREATE', enabled: access.canCreatePosts || access.canPublishMedia || access.canManagePolls, priority: true },
    { key: 'sermons', title: 'Sermons', description: 'Draft, review and publish church-wide sermons and message media.', icon: 'book-outline', route: '/general/leadership/sermons-manage', area: 'Content', badge: 'MESSAGES', enabled: access.canManageSermons, priority: true },
    { key: 'important-updates', title: 'Important updates', description: 'Edit the published updates that power the Important Updates strip on General COT Home.', icon: 'flash-outline', route: '/general/leadership/urgent-updates', area: 'Content', badge: 'HOME STRIP', enabled: access.canManageAnnouncements, priority: true },
    { key: 'announcements', title: 'Announcements', description: 'Draft, schedule and publish official General COT announcements.', icon: 'megaphone-outline', route: '/general/leadership/announcements-manage', area: 'Content', badge: 'UPDATES', enabled: access.canManageAnnouncements },
    { key: 'events', title: 'Events', description: 'Create and maintain church-wide gatherings and dates.', icon: 'calendar-outline', route: '/general/leadership/events-manage', area: 'Content', badge: 'SCHEDULE', enabled: access.canManageEvents },
    { key: 'care', title: 'Pastoral care', description: 'Review prayer, testimony follow-ups and pastoral care actions.', icon: 'heart-circle-outline', route: '/general/leadership/pastoral-triage', area: 'Care', badge: 'CARE', enabled: access.canManageCare, priority: true },
    { key: 'roles', title: 'Roles & access', description: 'Assign church-wide ministry roles without granting platform administration access.', icon: 'shield-checkmark-outline', route: '/general/leadership/roles-access', area: 'People', badge: 'ACCESS', enabled: access.canManageRoles, priority: true },
    { key: 'leaders', title: 'Leadership', description: 'Manage church-wide leaders and public leadership visibility.', icon: 'people-outline', route: '/general/leadership/church-leadership', area: 'People', badge: 'PEOPLE', enabled: access.canManageLeadership },
    { key: 'titles', title: 'Titles & badges', description: 'Create and assign church-wide presentation titles. Titles never grant permissions.', icon: 'ribbon-outline', route: '/general/leadership/titles-badges', area: 'People', badge: 'IDENTITY', enabled: access.canManageLeadership },
    { key: 'expressions', title: 'Expressions', description: 'Manage Expressions available to your creator authority.', icon: 'business-outline', route: '/general/leadership/expressions-manage', area: 'People', badge: 'EXPRESSIONS', enabled: access.canManageExpressions },
    { key: 'giving', title: 'Giving setup', description: 'Manage giving purposes and church-wide giving configuration.', icon: 'gift-outline', route: '/general/leadership/giving-manage', area: 'Finance', badge: 'GIVING', enabled: access.canManageGiving },
    { key: 'finance', title: 'Giving reports', description: 'Review giving totals, refunds and finance reports.', icon: 'analytics-outline', route: '/general/leadership/giving-finance', area: 'Finance', badge: 'REPORTS', enabled: access.canReadGivingFinance },
    { key: 'live', title: 'Live Studio', description: 'Prepare broadcasts, go live and monitor stream operations.', icon: 'radio-outline', route: '/general/leadership/media-studio', area: 'Media', badge: 'LIVE', enabled: access.canBroadcastLive, priority: true },
    { key: 'watch', title: 'Watch categories', description: 'Organize public video discovery categories without redeploying.', icon: 'pricetags-outline', route: '/general/leadership/watch-categories', area: 'Media', badge: 'DISCOVERY', enabled: access.canManageLeadership },
    { key: 'ranking', title: 'Feed controls', description: 'Tune church-wide discovery and feed ranking controls.', icon: 'options-outline', route: '/general/leadership/feed-ranking', area: 'Settings', badge: 'HOME', enabled: access.canManageSettings },
  ], [access]);

  const available = tools.filter((tool) => tool.enabled);
  const visible = filter === 'All' ? available : available.filter((tool) => tool.area === filter);
  const areas = (['Create', 'Content', 'Care', 'People', 'Finance', 'Media', 'Settings'] as GeneralMinistryArea[])
    .filter((area) => available.some((tool) => tool.area === area));

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: colors.bg }]}>
        <EmptyState title="Sign in for ministry tools" message="Ministry access is tied to your COT roles." iconName="shield-checkmark-outline" />
        <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/leadership' } } as any)} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }]}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.roundButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
          >
            <Icon name="arrow-back" size={19} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Ministry Tools</Text>
          {workspaceReady && hasWorkspaceAccess ? (
            <Text style={[styles.count, { color: colors.interactive }]}>{available.length}</Text>
          ) : null}
          <Pressable onPress={() => router.push('/general/profile')} accessibilityRole="button" accessibilityLabel="Open profile">
            <Avatar url={profile?.avatar_url} name={displayName} size="sm" />
          </Pressable>
        </View>

        {!workspaceReady ? (
          <View style={styles.loading}>
            <Skeleton height={54} borderRadius={radius.xl} />
            <CompactRouteSkeleton />
          </View>
        ) : !hasWorkspaceAccess ? (
          <View style={styles.noAccess}>
            <EmptyState title="No ministry tools assigned" message="Tools appear when your ministry role grants access." iconName="shield-outline" />
            <Button label="Back to You" variant="outline" onPress={() => router.replace('/general/profile')} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {(['All', ...areas] as Filter[]).map((item) => {
                const selected = item === filter;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setFilter(item)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: selected ? colors.text : colors.card,
                        borderColor: selected ? colors.text : colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.filterText, { color: selected ? colors.bg : colors.textSecondary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <CompactRouteGrid
              items={visible.map((tool) => ({
                key: tool.key,
                label: tool.title,
                icon: tool.icon,
                badge: tool.priority ? tool.badge : undefined,
                accessibilityLabel: `${tool.title}. ${tool.description}`,
                onPress: () => router.push(tool.route as any),
              }))}
            />

            <View style={styles.scopeLine}>
              <Icon name="shield-checkmark-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.scopeText, { color: colors.textMuted }]}>General COT ministry</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CompactRouteSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 8 }).map((_, index) => (
        <View key={index} style={styles.skeletonItem}>
          <Skeleton height={44} width={44} borderRadius={15} />
          <Skeleton height={10} width={56} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  content: { flexGrow: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  topRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roundButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.45 },
  count: { fontSize: 11, lineHeight: 16, fontWeight: '900' },
  loading: { gap: spacing.lg },
  noAccess: { gap: spacing.md },
  filters: { gap: 7, paddingRight: spacing.md },
  filterPill: { minHeight: 34, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 10.5, fontWeight: '800' },
  scopeLine: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: spacing.sm },
  scopeText: { fontSize: 9.5, fontWeight: '800' },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  skeletonItem: { width: '25%', alignItems: 'center', gap: 6 },
});

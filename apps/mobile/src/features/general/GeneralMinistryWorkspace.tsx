import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, EmptyState, Icon, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
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

function ToolCard({ tool }: { tool: Tool }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(tool.route as any)}
      style={({ pressed }) => [
        styles.toolCard,
        { backgroundColor: colors.card, borderColor: tool.priority ? colors.interactive : colors.borderSubtle },
        shadows.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.toolIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={tool.icon as any} size={21} color={colors.interactive} />
      </View>
      <View style={styles.flex}>
        <View style={styles.toolTitleRow}>
          <Text style={[styles.toolTitle, { color: colors.text }]}>{tool.title}</Text>
          <Badge label={tool.badge} variant={tool.priority ? 'primary' : 'neutral'} />
        </View>
        <Text style={[styles.toolDescription, { color: colors.textMuted }]}>{tool.description}</Text>
        <View style={styles.toolFooter}>
          <Text style={[styles.toolArea, { color: colors.interactive }]}>{tool.area.toUpperCase()}</Text>
          <Text style={[styles.openText, { color: colors.textSecondary }]}>Open</Text>
          <Icon name="arrow-forward" size={13} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function GeneralMinistryWorkspace() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { context, mode } = useSession();
  const access = useGeneralMinistryAccess();
  const [filter, setFilter] = useState<Filter>('All');
  const profile = context?.profile;
  const organization = context?.organization ?? context?.organizations?.[0] ?? context?.creatorOrganizations?.[0];
  const displayName = profile?.display_name?.trim() || 'Church Member';
  const workspaceReady = access.accessReady;
  const hasWorkspaceAccess = access.hasAnyMinistryAccess;

  const tools = useMemo<Tool[]>(() => [
    { key: 'studio', title: 'Creator Studio', description: 'Start public posts, voice, Reels, videos and other creation flows.', icon: 'add-circle-outline', route: '/general/studio', area: 'Create', badge: 'CREATE', enabled: access.canCreatePosts || access.canPublishMedia || access.canManagePolls, priority: true },
    { key: 'sermons', title: 'Sermons', description: 'Draft, review and publish church-wide sermons and message media.', icon: 'book-outline', route: '/general/leadership/sermons-manage', area: 'Content', badge: 'MESSAGES', enabled: access.canManageSermons, priority: true },
    { key: 'important-updates', title: 'Important updates strip', description: 'Edit the published updates that power the Important Updates strip on General COT Home.', icon: 'flash-outline', route: '/general/leadership/urgent-updates', area: 'Content', badge: 'HOME STRIP', enabled: access.canManageAnnouncements, priority: true },
    { key: 'announcements', title: 'Announcements', description: 'Draft, schedule and publish official General COT announcements.', icon: 'megaphone-outline', route: '/general/leadership/announcements-manage', area: 'Content', badge: 'UPDATES', enabled: access.canManageAnnouncements },
    { key: 'events', title: 'Events & gatherings', description: 'Create and maintain church-wide gatherings and dates.', icon: 'calendar-outline', route: '/general/leadership/events-manage', area: 'Content', badge: 'SCHEDULE', enabled: access.canManageEvents },
    { key: 'care', title: 'Pastoral care inbox', description: 'Review prayer, testimony follow-ups and pastoral care actions.', icon: 'heart-circle-outline', route: '/general/leadership/pastoral-triage', area: 'Care', badge: 'CARE', enabled: access.canManageCare, priority: true },
    { key: 'roles', title: 'Roles & access', description: 'Assign church-wide ministry roles without granting platform administration access.', icon: 'shield-checkmark-outline', route: '/general/leadership/roles-access', area: 'People', badge: 'ACCESS', enabled: access.canManageRoles, priority: true },
    { key: 'leaders', title: 'Church leadership', description: 'Manage church-wide leaders and public leadership visibility.', icon: 'people-outline', route: '/general/leadership/church-leadership', area: 'People', badge: 'PEOPLE', enabled: access.canManageLeadership },
    { key: 'titles', title: 'Titles & badges', description: 'Create and assign church-wide presentation titles. Titles never grant permissions.', icon: 'ribbon-outline', route: '/general/leadership/titles-badges', area: 'People', badge: 'IDENTITY', enabled: access.canManageLeadership },
    { key: 'expressions', title: 'Expressions', description: 'Manage Expressions available to your creator authority.', icon: 'business-outline', route: '/general/leadership/expressions-manage', area: 'People', badge: 'EXPRESSIONS', enabled: access.canManageExpressions },
    { key: 'giving', title: 'Giving setup', description: 'Manage giving purposes and church-wide giving configuration.', icon: 'gift-outline', route: '/general/leadership/giving-manage', area: 'Finance', badge: 'GIVING', enabled: access.canManageGiving },
    { key: 'finance', title: 'Giving reports', description: 'Review giving totals, refunds and finance reports.', icon: 'analytics-outline', route: '/general/leadership/giving-finance', area: 'Finance', badge: 'REPORTS', enabled: access.canReadGivingFinance },
    { key: 'live', title: 'Live Media Studio', description: 'Prepare broadcasts, go live and monitor stream operations.', icon: 'radio-outline', route: '/general/leadership/media-studio', area: 'Media', badge: 'LIVE', enabled: access.canBroadcastLive, priority: true },
    { key: 'watch', title: 'Watch categories', description: 'Organize public video discovery categories without redeploying.', icon: 'pricetags-outline', route: '/general/leadership/watch-categories', area: 'Media', badge: 'DISCOVERY', enabled: access.canManageLeadership },
    { key: 'ranking', title: 'Home feed controls', description: 'Tune church-wide discovery and feed ranking controls.', icon: 'options-outline', route: '/general/leadership/feed-ranking', area: 'Settings', badge: 'HOME', enabled: access.canManageSettings },
  ], [access]);

  const available = tools.filter((tool) => tool.enabled);
  const visible = filter === 'All' ? available : available.filter((tool) => tool.area === filter);
  const areas = (['Create', 'Content', 'Care', 'People', 'Finance', 'Media', 'Settings'] as GeneralMinistryArea[]).filter((area) => available.some((tool) => tool.area === area));
  const priority = available.filter((tool) => tool.priority).slice(0, 4);

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: colors.bg }]}>
        <EmptyState title="Sign in to open Ministry Workspace" message="Ministry access is tied to your COT roles and permissions." iconName="shield-checkmark-outline" />
        <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/leadership' } } as any)} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={[styles.roundButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Icon name="arrow-back" size={19} color={colors.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>GENERAL COT · MINISTRY</Text>
            <Text style={[styles.title, { color: colors.text }]}>Ministry Workspace</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Create, care, manage access and operate COT from one role-aware workspace.</Text>
          </View>
          <Pressable onPress={() => router.push('/general/profile')}>
            <Avatar url={profile?.avatar_url} name={displayName} size="sm" />
          </Pressable>
        </View>

        {!workspaceReady ? (
          <View style={styles.loading}><Skeleton height={142} borderRadius={radius.xxl} /><Skeleton height={100} count={4} /></View>
        ) : !hasWorkspaceAccess ? (
          <View style={[styles.noAccess, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <EmptyState title="No ministry tools assigned" message="Tools appear automatically when a General COT ministry role grants them." iconName="shield-outline" />
            <Button label="Back to You" variant="outline" onPress={() => router.replace('/general/profile')} />
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.heroGlow, { backgroundColor: colors.primarySoft }]} />
              <View style={styles.heroRow}>
                <Avatar url={profile?.avatar_url} name={displayName} size="md" />
                <View style={styles.flex}>
                  <Text style={[styles.heroKicker, { color: colors.interactive }]}>YOUR CURRENT ACCESS</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>{displayName}</Text>
                  <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>{organization?.name ? `${organization.name} · ` : ''}{available.length} {available.length === 1 ? 'tool' : 'tools'} available.</Text>
                </View>
                <Badge label="LIVE PERMISSIONS" variant="primary" />
              </View>
              <View style={styles.quickRow}>{priority.map((tool) => (
                <Pressable key={tool.key} onPress={() => router.push(tool.route as any)} style={[styles.quickAction, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                  <Icon name={tool.icon as any} size={15} color={colors.interactive} />
                  <Text style={[styles.quickText, { color: colors.text }]} numberOfLines={1}>{tool.title}</Text>
                </Pressable>
              ))}</View>
            </View>

            <View style={styles.filterBlock}>
              <View style={styles.filterHeading}>
                <View style={styles.flex}><Text style={[styles.filterTitle, { color: colors.text }]}>Your tools</Text><Text style={[styles.filterCopy, { color: colors.textMuted }]}>Choose an area or keep everything visible.</Text></View>
                <Text style={[styles.countText, { color: colors.interactive }]}>{visible.length} shown</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                {(['All', ...areas] as Filter[]).map((item) => {
                  const selected = item === filter;
                  const count = item === 'All' ? available.length : available.filter((tool) => tool.area === item).length;
                  return (
                    <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterPill, { backgroundColor: selected ? colors.text : colors.card, borderColor: selected ? colors.text : colors.borderSubtle }]}>
                      <Text style={[styles.filterText, { color: selected ? colors.bg : colors.textSecondary }]}>{item}</Text>
                      <View style={[styles.filterCount, { backgroundColor: selected ? colors.bg : colors.bgSecondary }]}><Text style={[styles.filterCountText, { color: selected ? colors.text : colors.textMuted }]}>{count}</Text></View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.toolGrid}>{visible.map((tool) => <ToolCard key={tool.key} tool={tool} />)}</View>

            <View style={[styles.helpCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <View style={[styles.helpIcon, { backgroundColor: colors.card }]}><Icon name="information-circle-outline" size={18} color={colors.interactive} /></View>
              <View style={styles.flex}><Text style={[styles.helpTitle, { color: colors.text }]}>Ministry access only</Text><Text style={[styles.helpCopy, { color: colors.textMuted }]}>This workspace follows General COT ministry permissions. Expression operations stay inside each Expression, while platform governance stays in the separate administration website.</Text></View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  content: { flexGrow: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.xl },
  flex: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roundButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.05 },
  title: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.75 },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  loading: { gap: spacing.md },
  noAccess: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.md },
  hero: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -90, top: -135, opacity: 0.75 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.95 },
  heroTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  heroCopy: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  quickAction: { minHeight: 36, maxWidth: 230, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickText: { fontSize: 10, fontWeight: '800', flexShrink: 1 },
  filterBlock: { gap: spacing.sm },
  filterHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  filterTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900' },
  filterCopy: { fontSize: 10.5, lineHeight: 15 },
  countText: { fontSize: 10.5, fontWeight: '900' },
  filters: { gap: 7, paddingRight: spacing.md },
  filterPill: { minHeight: 36, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { fontSize: 10.5, fontWeight: '800' },
  filterCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterCountText: { fontSize: 9, fontWeight: '900' },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolCard: { width: '48%', flexGrow: 1, minWidth: 280, minHeight: 130, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  toolIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  toolTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '900', flexShrink: 1 },
  toolDescription: { fontSize: 10.8, lineHeight: 16, marginTop: 4 },
  toolFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  toolArea: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75, marginRight: 'auto' },
  openText: { fontSize: 9.5, fontWeight: '800' },
  helpCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  helpIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  helpTitle: { fontSize: 12.5, fontWeight: '900' },
  helpCopy: { fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.995 }] },
});

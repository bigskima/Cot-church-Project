import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { EmptyState, LeadershipModuleCard, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';

export default function LeadershipHubScreen() {
  const insets = useSafeAreaInsets();
  const { hasCapability, hasOrganizationCapability, hasPublicCapability, context, api, mode, accessReady } = useSession();
  const { colors } = useTheme();

  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? context?.creatorOrganizations?.[0]?.id ?? '';
  const isAuthorizedExpressionCreator = Boolean(
    mode === 'authenticated' &&
    organizationId &&
    context?.creatorOrganizations?.some((item) => item.id === organizationId),
  );
  const ownershipState = useResource<{ isCurrentOwner?: boolean } | null>(
    `leadership:ownership:${context?.expression?.id ?? 'none'}`,
    (signal) => context?.expression?.id
      ? api.request<{ isCurrentOwner?: boolean }>('expression-ownership', { signal }).catch(() => null)
      : Promise.resolve(null),
  );
  const ownershipReady = !context?.expression?.id || !ownershipState.loading;
  const authorityReady = accessReady && ownershipReady;
  const isCurrentExpressionOwner = ownershipState.data?.isCurrentOwner === true;

  const hasExpression = Boolean(context?.expression?.id);
  const canManageMedia =
    hasPublicCapability('public.live_stream.create') ||
    (hasExpression && hasCapability('streams.broadcast'));
  const canModerateGeneralPrayer =
    hasOrganizationCapability('prayer.moderate') &&
    (hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive'));
  const canModerateExpressionPrayer =
    hasExpression &&
    hasCapability('prayer.moderate') &&
    (hasCapability('prayer.pastoral.receive') || hasCapability('prayer.team.receive'));
  const canReceiveGeneralPastoralFollowups = hasOrganizationCapability('pastoral.followups.receive');
  const canReceiveExpressionPastoralFollowups = hasExpression && hasCapability('pastoral.followups.receive');
  const canPastoralTriage =
    canModerateGeneralPrayer ||
    canModerateExpressionPrayer ||
    canReceiveGeneralPastoralFollowups ||
    canReceiveExpressionPastoralFollowups;
  const canManageSermons = hasCapability('sermons.create') || hasCapability('sermons.manage');
  const canManageEvents = hasCapability('events.create') || hasCapability('events.update');
  const canManageGiving = hasCapability('giving.campaigns.manage');
  const canReadGivingFinance = hasCapability('giving.finance.read');
  const canManageLeadership = hasExpression && hasCapability('expression.leadership.manage');
  const canManageChurchLeadership = hasOrganizationCapability('organization.leadership.manage');
  const canManageExpressionAccess =
    hasExpression &&
    (isCurrentExpressionOwner ||
      (hasCapability('members.invite') && hasCapability('roles.assign')));
  const canManageExpressions = isAuthorizedExpressionCreator;

  const tools = [
    { title: 'Live Media Studio', description: 'Create live broadcasts, retrieve ingest details, and monitor stream health.', iconName: 'radio-outline', badge: 'LIVE OPS', route: '/(tabs)/profile/leadership/media-studio', enabled: canManageMedia },
    { title: 'Pastoral Triage & Care Queue', description: 'Manage confidential prayer petitions, decisions, and assigned follow-ups.', iconName: 'heart-outline', badge: 'CARE', route: '/(tabs)/profile/leadership/pastoral-triage', enabled: canPastoralTriage },
    { title: 'Church Leadership Directory', description: 'Manage church-wide leaders and choose who appears in the public Church Story.', iconName: 'business-outline', badge: 'CHURCH', route: '/(tabs)/profile/leadership/church-leadership', enabled: canManageChurchLeadership },
    { title: 'Expression Leadership Directory', description: 'Manage pastoral and ministry leadership profiles for the selected Expression. Public featuring remains explicit.', iconName: 'people-outline', badge: 'DIRECTORY', route: '/(tabs)/profile/leadership/expression-leadership', enabled: canManageLeadership },
    { title: 'Expression Access & Ownership', description: 'Manage role invitations when authorized, and transfer accountable ownership when you are the current owner.', iconName: 'key-outline', badge: 'ACCESS', route: '/(tabs)/profile/leadership/expression-governance', enabled: canManageExpressionAccess },
    { title: 'Giving Configuration', description: 'Manage giving destinations, purposes and transfer accounts for the current church scope.', iconName: 'gift-outline', badge: 'GIVING', route: '/(tabs)/profile/leadership/giving-manage', enabled: canManageGiving },
    { title: 'Giving Finance', description: 'Review read-only giving totals, refunds and net amounts by currency.', iconName: 'analytics-outline', badge: 'FINANCE', route: '/(tabs)/profile/leadership/giving-finance', enabled: canReadGivingFinance },
    { title: 'Sermons & Media Publishing', description: 'Review recorded message drafts, assign scripture topics, and publish sermons to members.', iconName: 'book-outline', badge: 'MEDIA', route: '/(tabs)/profile/leadership/sermons-manage', enabled: canManageSermons },
    { title: 'Events & Gatherings', description: 'Schedule worship gatherings, configure attendance, and manage event schedules.', iconName: 'calendar-outline', badge: 'SCHEDULE', route: '/(tabs)/profile/leadership/events-manage', enabled: canManageEvents },
    { title: 'Expressions', description: 'View church Expressions and create a new one when your account has been approved to do so.', iconName: 'business-outline', badge: 'EXPRESSIONS', route: '/(tabs)/profile/leadership/expressions-manage', enabled: canManageExpressions },
  ];

  const availableTools = tools.filter((tool) => tool.enabled);
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }]}>
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader title="Leadership tools" kicker="MINISTRY" subtitle="Only operations assigned to your account appear here." showBack />
        </View>
        <View style={styles.body}>
          <SectionHeader title="Available tools" badge={authorityReady ? availableTools.length : undefined} subtitle={authorityReady ? (context?.expression?.name ? `Current space: ${context.expression.name}` : 'Church-level tools') : 'Resolving your assigned authority'} />
          {!authorityReady ? (
            <Skeleton height={104} count={3} />
          ) : availableTools.length ? availableTools.map((tool) => (
            <LeadershipModuleCard key={tool.title} title={tool.title} description={tool.description} iconName={tool.iconName} badge={tool.badge} onPress={() => router.push(tool.route as any)} />
          )) : <EmptyState title="No leadership tools assigned" message="Operational tools appear here when your account receives the required authority." iconName="lock-closed-outline" />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingTop: spacing.md },
});

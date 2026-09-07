import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { EmptyState, LeadershipModuleCard, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';

export default function LeadershipHubScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const generalWorkspace = pathname.startsWith('/general');
  const { hasCapability, hasOrganizationCapability, hasPublicCapability, context, api, mode, accessReady } = useSession();
  const { colors } = useTheme();

  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? context?.creatorOrganizations?.[0]?.id ?? '';
  const activeExpression = generalWorkspace ? undefined : context?.expression;
  const isAuthorizedExpressionCreator = Boolean(
    mode === 'authenticated' &&
    organizationId &&
    context?.creatorOrganizations?.some((item) => item.id === organizationId),
  );
  const ownershipState = useResource<{ isCurrentOwner?: boolean } | null>(
    `leadership:ownership:${activeExpression?.id ?? 'none'}`,
    (signal) => activeExpression?.id
      ? api.request<{ isCurrentOwner?: boolean }>('expression-ownership', { signal }).catch(() => null)
      : Promise.resolve(null),
  );
  const ownershipReady = !activeExpression?.id || !ownershipState.loading;
  const authorityReady = accessReady && ownershipReady;
  const isCurrentExpressionOwner = ownershipState.data?.isCurrentOwner === true;

  const hasExpression = Boolean(activeExpression?.id);
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
  const canManageSermons = generalWorkspace
    ? hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage')
    : hasCapability('sermons.create') || hasCapability('sermons.manage');
  const canManageEvents = generalWorkspace
    ? hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update')
    : hasCapability('events.create') || hasCapability('events.update');
  const canManageGiving = generalWorkspace
    ? hasOrganizationCapability('giving.campaigns.manage')
    : hasCapability('giving.campaigns.manage');
  const canReadGivingFinance = generalWorkspace
    ? hasOrganizationCapability('giving.finance.read')
    : hasCapability('giving.finance.read');
  const canManageLeadership = hasExpression && hasCapability('expression.leadership.manage');
  const canManageChurchLeadership = hasOrganizationCapability('organization.leadership.manage');
  const canManageExpressionAccess =
    hasExpression &&
    (isCurrentExpressionOwner ||
      (hasCapability('members.invite') && hasCapability('roles.assign')));
  const canManageExpressions = isAuthorizedExpressionCreator;

  if (hasExpression && activeExpression?.id) {
    return <Redirect href={`/expressions/${activeExpression!.id}/manage` as any} />;
  }

  const routeFor = (generalRoute: string, legacyRoute: string) =>
    generalWorkspace ? generalRoute : legacyRoute;

  const tools = [
    { title: 'Live Media Studio', description: 'Create live broadcasts, retrieve ingest details, and monitor stream health.', iconName: 'radio-outline', badge: 'LIVE OPS', route: routeFor('/general/leadership/media-studio', '/(tabs)/profile/leadership/media-studio'), enabled: canManageMedia },
    { title: 'Pastoral Triage & Care Queue', description: 'Manage confidential prayer petitions, decisions, and assigned follow-ups.', iconName: 'heart-outline', badge: 'CARE', route: routeFor('/general/leadership/pastoral-triage', '/(tabs)/profile/leadership/pastoral-triage'), enabled: canPastoralTriage },
    { title: 'Church Leadership Directory', description: 'Manage church-wide leaders and choose who appears in the public Church Story.', iconName: 'business-outline', badge: 'CHURCH', route: routeFor('/general/leadership/church-leadership', '/(tabs)/profile/leadership/church-leadership'), enabled: canManageChurchLeadership },
    { title: 'Expression Leadership Directory', description: 'Manage pastoral and ministry leadership profiles for the selected Expression. Public featuring remains explicit.', iconName: 'people-outline', badge: 'DIRECTORY', route: '/(tabs)/profile/leadership/expression-leadership', enabled: !generalWorkspace && canManageLeadership },
    { title: 'Expression Access & Ownership', description: 'Manage role invitations when authorized, and transfer accountable ownership when you are the current owner.', iconName: 'key-outline', badge: 'ACCESS', route: '/(tabs)/profile/leadership/expression-governance', enabled: !generalWorkspace && canManageExpressionAccess },
    { title: 'Giving Configuration', description: 'Manage church-wide giving destinations, purposes and transfer accounts.', iconName: 'gift-outline', badge: 'GIVING', route: routeFor('/general/leadership/giving-manage', '/(tabs)/profile/leadership/giving-manage'), enabled: canManageGiving },
    { title: 'Giving Finance', description: 'Review church-wide giving totals, refunds and net amounts by currency.', iconName: 'analytics-outline', badge: 'FINANCE', route: routeFor('/general/leadership/giving-finance', '/(tabs)/profile/leadership/giving-finance'), enabled: canReadGivingFinance },
    { title: 'Sermons & Media Publishing', description: 'Review church-wide message drafts, assign scripture topics, and publish sermons.', iconName: 'book-outline', badge: 'MEDIA', route: routeFor('/general/leadership/sermons-manage', '/(tabs)/profile/leadership/sermons-manage'), enabled: canManageSermons },
    { title: 'Events & Gatherings', description: 'Schedule church-wide worship gatherings and manage event schedules.', iconName: 'calendar-outline', badge: 'SCHEDULE', route: routeFor('/general/leadership/events-manage', '/(tabs)/profile/leadership/events-manage'), enabled: canManageEvents },
    { title: 'Expressions', description: 'View church Expressions and create a new one when your account has been approved to do so.', iconName: 'business-outline', badge: 'EXPRESSIONS', route: routeFor('/general/leadership/expressions-manage', '/(tabs)/profile/leadership/expressions-manage'), enabled: canManageExpressions },
  ];

  const availableTools = tools.filter((tool) => tool.enabled);
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: generalWorkspace ? spacing.md : insets.top + spacing.sm, paddingBottom: generalWorkspace ? insets.bottom + spacing.xl : insets.bottom + 120 }]}>
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader title="Leadership tools" kicker="MINISTRY" subtitle="Only operations assigned to your account appear here." showBack />
        </View>
        <View style={styles.body}>
          <SectionHeader title="Available tools" badge={authorityReady ? availableTools.length : undefined} subtitle={authorityReady ? (generalWorkspace ? 'Church-level tools' : activeExpression?.name ? `Current space: ${activeExpression!.name}` : 'Church-level tools') : 'Resolving your assigned authority'} />
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

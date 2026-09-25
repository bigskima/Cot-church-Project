import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CompactRouteGrid, EmptyState, SectionHeader, Skeleton } from '@/components';
import { ExpressionManagementHeader } from '@/components/expression/ExpressionManagementHeader';
import { spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useExpressionManagementAccess } from './useExpressionManagementAccess';

type Tool = {
  key: string;
  title: string;
  description: string;
  iconName: string;
  route: string;
  enabled: boolean;
};

type ToolSection = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  tools: Tool[];
};

export function ExpressionManagementHub() {
  const { context } = useSession();
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const expression = context?.expression;
  const expressionName = expression?.name ?? 'This Expression';
  const base = `/expressions/${access.expressionId}/manage`;

  const sections = useMemo<ToolSection[]>(() => {
    const content: Tool[] = [
      {
        key: 'studio',
        title: 'Content Studio',
        description: 'Posts, Reels, videos and teaching.',
        iconName: 'color-wand-outline',
        route: `${base}/studio`,
        enabled: access.canUseContentStudio,
      },
      {
        key: 'live',
        title: 'Live Studio',
        description: 'Create and manage broadcasts.',
        iconName: 'radio-outline',
        route: `${base}/live`,
        enabled: access.canManageLive,
      },
      {
        key: 'sermons',
        title: 'Pastor’s Messages',
        description: 'Create, publish and update pastoral audio and video messages.',
        iconName: 'book-outline',
        route: `${base}/sermons`,
        enabled: access.canManageSermons,
      },
      {
        key: 'events',
        title: 'Events',
        description: 'Schedule gatherings with optional flyers.',
        iconName: 'calendar-outline',
        route: `${base}/events`,
        enabled: access.canManageEvents,
      },
      {
        key: 'announcements',
        title: 'Announcements',
        description: 'Publish or schedule official updates and flyers.',
        iconName: 'megaphone-outline',
        route: `${base}/announcements`,
        enabled: access.canManageAnnouncements,
      },
      {
        key: 'ranking',
        title: 'Feed Ranking',
        description: 'Tune freshness, engagement and diversity weights for Home.',
        iconName: 'analytics-outline',
        route: `${base}/feed-ranking`,
        enabled: access.canManageFeedRanking,
      },
      {
        key: 'testimonies',
        title: 'Testimony review',
        description: 'Respond privately and coordinate physical sharing.',
        iconName: 'document-text-outline',
        route: `${base}/testimonies`,
        enabled: access.canReviewTestimonies,
      },
    ];

    const people: Tool[] = [
      {
        key: 'leadership',
        title: 'Leadership',
        description: 'Search members, add leaders and edit portraits.',
        iconName: 'people-circle-outline',
        route: `${base}/leadership`,
        enabled: access.canManageLeadership,
      },
      {
        key: 'badges',
        title: 'Titles & badges',
        description: 'Public ministry titles that do not grant permissions.',
        iconName: 'ribbon-outline',
        route: `${base}/badges`,
        enabled: access.canManageLeadership,
      },
      {
        key: 'invite-codes',
        title: 'Invite Codes',
        description: 'Create revocable joining codes.',
        iconName: 'key-outline',
        route: `${base}/invite-codes`,
        enabled: access.canManageInviteCodes,
      },
      {
        key: 'access',
        title: 'Team Access',
        description: 'Invite leaders and manage ownership.',
        iconName: 'shield-checkmark-outline',
        route: `${base}/access`,
        enabled: access.canManageAccess,
      },
      {
        key: 'settings',
        title: 'Settings',
        description: 'Identity, code and timezone.',
        iconName: 'settings-outline',
        route: `${base}/settings`,
        enabled: access.canManageSettings,
      },
    ];

    const finance: Tool[] = [
      {
        key: 'giving',
        title: 'Giving Setup',
        description: 'Giving options, purposes and transfer destination.',
        iconName: 'gift-outline',
        route: `${base}/giving`,
        enabled: access.canManageGiving,
      },
      {
        key: 'giving-reports',
        title: 'Giving Reports',
        description: 'Read provider-linked giving totals and refunds.',
        iconName: 'analytics-outline',
        route: `${base}/finance`,
        enabled: access.canReadGivingFinance,
      },
      {
        key: 'books',
        title: 'Financial Management',
        description: 'Manage giving accounts, received gifts, expenses and finance reports.',
        iconName: 'wallet-outline',
        route: `${base}/books`,
        enabled: access.canReadExpressionFinance,
      },
    ];

    return [
      {
        key: 'operations',
        title: 'Content & gatherings',
        subtitle: 'Create what members watch, read, receive and attend, and tune how Home orders eligible content.',
        icon: 'sparkles-outline',
        tools: content.filter((tool) => tool.enabled),
      },
      {
        key: 'people',
        title: 'People & access',
        subtitle: 'Manage leaders, invitations and Expression responsibility.',
        icon: 'people-outline',
        tools: people.filter((tool) => tool.enabled),
      },
      {
        key: 'finance',
        title: 'Giving & finance',
        subtitle: 'Configure giving, document manual activity and review balances.',
        icon: 'wallet-outline',
        tools: finance.filter((tool) => tool.enabled),
      },
    ].filter((section) => section.tools.length);
  }, [
    access.canManageAccess,
    access.canManageAnnouncements,
    access.canManageEvents,
    access.canManageFeedRanking,
    access.canManageGiving,
    access.canManageInviteCodes,
    access.canManageLeadership,
    access.canManageSettings,
    access.canManageLive,
    access.canManageSermons,
    access.canReadExpressionFinance,
    access.canReadGivingFinance,
    access.canReviewTestimonies,
    access.canUseContentStudio,
    base,
  ]);

  const toolCount = sections.reduce((total, section) => total + section.tools.length, 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionManagementHeader
        expressionId={access.expressionId}
        expressionName={expressionName}
        active="tools"
        title="Operations"
        subtitle="Expression ministry operations"
        icon="grid-outline"
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!access.ready ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View key={index} style={styles.skeletonItem}>
                <Skeleton height={44} width={44} borderRadius={15} />
                <Skeleton height={10} width={58} borderRadius={5} />
              </View>
            ))}
          </View>
        ) : toolCount ? (
          <>
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <SectionHeader title={section.title} badge={section.tools.length} compact />
                <CompactRouteGrid
                  compact
                  items={section.tools.map((tool) => ({
                    key: tool.key,
                    label: tool.title,
                    icon: tool.iconName,
                    accessibilityLabel: `${tool.title}. ${tool.description}`,
                    onPress: () => router.push(tool.route as any),
                  }))}
                />
              </View>
            ))}

          </>
        ) : (
          <EmptyState title="No ministry tools available" message="Tools appear when they are available to you." iconName="lock-closed-outline" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 940, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 90, gap: spacing.lg },
  section: { gap: spacing.sm },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  skeletonItem: { width: '25%', alignItems: 'center', gap: 6 },
});

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, Icon, LeadershipModuleCard, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useExpressionManagementAccess } from './useExpressionManagementAccess';

type Tool = {
  key: string;
  title: string;
  description: string;
  iconName: string;
  badge: string;
  route: string;
  enabled: boolean;
};

export function ExpressionManagementHub() {
  const { context } = useSession();
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const expression = context?.expression;
  const base = `/expressions/${access.expressionId}/manage`;

  const sections = useMemo(() => {
    const content: Tool[] = [
      {
        key: 'studio',
        title: 'Content Studio',
        description: 'Publish posts, Reels, Watch videos and sermons inside this Expression.',
        iconName: 'color-wand-outline',
        badge: 'CONTENT',
        route: `${base}/studio`,
        enabled: access.canUseContentStudio,
      },
      {
        key: 'sermons',
        title: 'Sermons',
        description: 'Create sermon drafts, manage media and publish teachings for this Expression.',
        iconName: 'book-outline',
        badge: 'SERMONS',
        route: `${base}/sermons`,
        enabled: access.canManageSermons,
      },
      {
        key: 'events',
        title: 'Events',
        description: 'Schedule and manage gatherings belonging to this Expression.',
        iconName: 'calendar-outline',
        badge: 'EVENTS',
        route: `${base}/events`,
        enabled: access.canManageEvents,
      },
      {
        key: 'live',
        title: 'Live Studio',
        description: 'Create and operate Expression broadcasts and inspect stream health.',
        iconName: 'radio-outline',
        badge: 'LIVE',
        route: `${base}/live`,
        enabled: access.canManageLive,
      },
    ];

    const people: Tool[] = [
      {
        key: 'leadership',
        title: 'Leadership Directory',
        description: 'Manage pastors and ministry leaders presented inside this Expression.',
        iconName: 'people-circle-outline',
        badge: 'LEADERS',
        route: `${base}/leadership`,
        enabled: access.canManageLeadership,
      },
      {
        key: 'invite-codes',
        title: 'Invite Codes',
        description: 'Generate revocable member invite codes for this Expression.',
        iconName: 'key-outline',
        badge: 'MEMBERS',
        route: `${base}/invite-codes`,
        enabled: access.canManageInviteCodes,
      },
      {
        key: 'access',
        title: 'Roles & Ownership',
        description: 'Invite ministry leaders, manage team access and hand over Expression responsibility when needed.',
        iconName: 'shield-checkmark-outline',
        badge: 'ACCESS',
        route: `${base}/access`,
        enabled: access.canManageAccess,
      },
      {
        key: 'settings',
        title: 'Expression Settings',
        description: 'Update the name, code and timezone used by this Expression.',
        iconName: 'settings-outline',
        badge: 'SETTINGS',
        route: `${base}/settings`,
        enabled: access.canManageSettings,
      },
    ];

    const finance: Tool[] = [
      {
        key: 'giving',
        title: 'Giving Configuration',
        description: 'Manage giving options, campaigns and bank details for this Expression.',
        iconName: 'gift-outline',
        badge: 'GIVING',
        route: `${base}/giving`,
        enabled: access.canManageGiving,
      },
      {
        key: 'finance',
        title: 'Giving Finance',
        description: 'Review Expression giving totals, refunds and net amounts by currency.',
        iconName: 'analytics-outline',
        badge: 'FINANCE',
        route: `${base}/finance`,
        enabled: access.canReadGivingFinance,
      },
    ];

    return [
      { key: 'operations', title: 'Ministry operations', tools: content.filter((tool) => tool.enabled) },
      { key: 'people', title: 'People & access', tools: people.filter((tool) => tool.enabled) },
      { key: 'finance', title: 'Finance', tools: finance.filter((tool) => tool.enabled) },
    ].filter((section) => section.tools.length);
  }, [
    access.canManageAccess,
    access.canManageEvents,
    access.canManageGiving,
    access.canManageInviteCodes,
    access.canManageLeadership,
    access.canManageSettings,
    access.canManageLive,
    access.canManageSermons,
    access.canReadGivingFinance,
    access.canUseContentStudio,
    base,
  ]);

  const toolCount = sections.reduce((total, section) => total + section.tools.length, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="settings-outline" size={24} color={colors.interactive} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION TOOLS</Text>
          <Text style={[styles.title, { color: colors.text }]}>Operate {expression?.name ?? 'this Expression'}</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>
            Only tools granted by your role in this exact Expression are shown here.
          </Text>
        </View>
      </View>

      {!access.ready ? (
        <View style={styles.stack}>
          <Skeleton height={108} count={4} />
        </View>
      ) : toolCount ? (
        sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <SectionHeader title={section.title} badge={section.tools.length} />
            <View style={styles.stack}>
              {section.tools.map((tool) => (
                <LeadershipModuleCard
                  key={tool.key}
                  title={tool.title}
                  description={tool.description}
                  iconName={tool.iconName}
                  badge={tool.badge}
                  onPress={() => router.push(tool.route as any)}
                />
              ))}
            </View>
          </View>
        ))
      ) : (
        <EmptyState
          title="No ministry tools available"
          message="You can still enjoy everything available to members here. Ministry tools will appear if you’re added to an Expression team."
          iconName="lock-closed-outline"
        />
      )}

      <View style={[styles.boundary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
        <Text style={[styles.boundaryText, { color: colors.textSecondary }]}>
          These controls are scoped to the Expression in the URL and active session. Church-wide administration remains separate.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 90,
    gap: spacing.lg,
  },
  hero: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800', marginTop: 2 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: { gap: spacing.sm },
  stack: { gap: spacing.sm },
  boundary: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  boundaryText: { flex: 1, fontSize: 11, lineHeight: 17 },
});

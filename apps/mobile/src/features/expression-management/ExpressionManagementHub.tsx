import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, Icon, SectionHeader, Skeleton } from '@/components';
import { ExpressionManagementHeader } from '@/components/expression/ExpressionManagementHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
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
        title: 'Sermons',
        description: 'Draft, publish and update messages.',
        iconName: 'book-outline',
        route: `${base}/sermons`,
        enabled: access.canManageSermons,
      },
      {
        key: 'events',
        title: 'Events',
        description: 'Schedule and update gatherings.',
        iconName: 'calendar-outline',
        route: `${base}/events`,
        enabled: access.canManageEvents,
      },
    ];

    const people: Tool[] = [
      {
        key: 'leadership',
        title: 'Leadership',
        description: 'Manage leaders shown to members.',
        iconName: 'people-circle-outline',
        route: `${base}/leadership`,
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
        description: 'Giving options, funds and destination.',
        iconName: 'gift-outline',
        route: `${base}/giving`,
        enabled: access.canManageGiving,
      },
      {
        key: 'finance',
        title: 'Giving Reports',
        description: 'Read totals, refunds and net giving.',
        iconName: 'analytics-outline',
        route: `${base}/finance`,
        enabled: access.canReadGivingFinance,
      },
    ];

    return [
      {
        key: 'operations',
        title: 'Content & gatherings',
        subtitle: 'Create what members watch, read and attend.',
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
        title: 'Giving',
        subtitle: 'Configure giving and review Expression-level reports.',
        icon: 'wallet-outline',
        tools: finance.filter((tool) => tool.enabled),
      },
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
  const contentCount = sections.find((section) => section.key === 'operations')?.tools.length ?? 0;
  const peopleCount = sections.find((section) => section.key === 'people')?.tools.length ?? 0;
  const financeCount = sections.find((section) => section.key === 'finance')?.tools.length ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionManagementHeader
        expressionId={access.expressionId}
        expressionName={expressionName}
        active="tools"
        title="Operations"
        subtitle="Run this Expression without mixing its private workspace with church-wide administration."
        icon="grid-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.accessNote, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
          <Icon name="shield-checkmark-outline" size={17} color={colors.interactive} />
          <Text style={[styles.accessNoteText, { color: colors.textSecondary }]}>
            Only the ministry tools available to you in this Expression are shown here.
          </Text>
        </View>

        {!access.ready ? (
          <View style={styles.stack}>
            <Skeleton height={82} count={4} />
          </View>
        ) : toolCount ? (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{toolCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Available tools</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{contentCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Content</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{peopleCount + financeCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>People & giving</Text>
              </View>
            </View>

            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <SectionHeader
                  title={section.title}
                  badge={section.tools.length}
                  subtitle={section.subtitle}
                />
                <View style={styles.toolGrid}>
                  {section.tools.map((tool) => (
                    <Pressable
                      key={tool.key}
                      onPress={() => router.push(tool.route as any)}
                      accessibilityRole="button"
                      accessibilityLabel={tool.title}
                      style={({ pressed }) => [
                        styles.toolCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.borderSubtle,
                        },
                        shadows.sm,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <View style={[styles.toolIcon, { backgroundColor: colors.primarySoft }]}>
                        <Icon name={tool.iconName as any} size={20} color={colors.interactive} />
                      </View>
                      <View style={styles.toolCopy}>
                        <Text style={[styles.toolTitle, { color: colors.text }]} numberOfLines={1}>{tool.title}</Text>
                        <Text style={[styles.toolDescription, { color: colors.textSecondary }]} numberOfLines={2}>{tool.description}</Text>
                      </View>
                      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
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
            These tools affect only this Expression. Church-wide ministry tools remain separate.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
    padding: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 90,
    gap: spacing.lg,
  },
  accessNote: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accessNoteText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.35 },
  summaryLabel: { fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 2 },
  section: { gap: spacing.sm },
  stack: { gap: spacing.sm },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolCard: {
    width: '48.5%',
    minWidth: 250,
    flexGrow: 1,
    minHeight: 86,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toolIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  toolCopy: { flex: 1, minWidth: 0 },
  toolTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900', letterSpacing: -0.18 },
  toolDescription: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  boundary: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  boundaryText: { flex: 1, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});

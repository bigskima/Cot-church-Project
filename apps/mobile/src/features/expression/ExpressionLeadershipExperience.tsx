import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, LeaderCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export function ExpressionLeadershipExperience({ embedded = false, expressionId }: { embedded?: boolean; expressionId?: string }) {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const branchId = expressionId ?? context?.expression?.id;

  const leadersResource = useResource<LeadershipProfile[]>(`expression:leadership:${branchId}`, (signal) =>
    branchId ? api.request(`church-story?view=leadership&expressionId=${branchId}`, { signal }) : Promise.resolve([])
  );

  const leaders = leadersResource.data ?? [];

  if (!branchId) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Expression Leadership" kicker="COMMUNITY" showBack />
        <View style={styles.body}><EmptyState title="Enter an Expression first" message="Internal leadership directories are available only inside an active Expression context." iconName="lock-closed-outline" /></View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: embedded ? spacing.md : insets.top + spacing.sm, paddingBottom: embedded ? insets.bottom + spacing.xl : insets.bottom + 120 },
        ]}
      >
        {embedded ? (
          <View style={styles.embeddedIntro}>
            <Text style={[styles.embeddedEyebrow, { color: colors.interactive }]}>EXPRESSION PEOPLE</Text>
            <Text style={[styles.embeddedTitle, { color: colors.text }]}>Leadership</Text>
            <Text style={[styles.embeddedCopy, { color: colors.textSecondary }]}>
              Pastors and ministry leaders serving {context?.expression?.name ?? 'this Expression'}.
            </Text>
          </View>
        ) : (
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <ScreenHeader
              title="Expression Leadership"
              kicker="COMMUNITY"
              subtitle={`Pastors and ministry leaders serving ${context?.expression?.name ?? 'this Expression'}.`}
              showBack
            />
          </View>
  
        )}

        <View style={styles.body}>
          {leadersResource.loading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={100} />
              <Skeleton height={100} />
            </View>
          ) : leadersResource.error && !leadersResource.data ? (
            <ResourceError
              message={leadersResource.error}
              retry={leadersResource.refresh}
            />
          ) : leaders.length > 0 ? (
            leaders.map((leader) => (
              <LeaderCard
                key={leader.id}
                leader={leader}
                variant="standard"
              />
            ))
          ) : (
            <EmptyState
              title="No Expression leaders listed"
              message="Expression leadership will appear here once assigned by church administration."
              iconName="people-outline"
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export default function ExpressionLeadershipRouteExperience() {
  return <ExpressionLeadershipExperience />;
}

const styles = StyleSheet.create({
  embeddedIntro: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  embeddedEyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  embeddedTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  embeddedCopy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
});

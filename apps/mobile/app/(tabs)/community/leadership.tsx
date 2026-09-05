import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, LeaderCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function ExpressionLeadershipScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const branchId = context?.expression?.id;

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
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Expression Leadership"
            kicker="COMMUNITY"
            subtitle={`Pastors and ministry leaders serving ${context?.expression?.name ?? 'this Expression'}.`}
            showBack
          />
        </View>

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

const styles = StyleSheet.create({
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

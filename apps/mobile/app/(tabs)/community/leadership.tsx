import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, LeaderCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function ExpressionLeadershipScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const branchId = context?.expression?.id;

  const leadersResource = useResource<LeadershipProfile[]>(`expression:leadership:${branchId}`, (signal) =>
    api.request(`church-story?view=leadership${branchId ? `&expressionId=${branchId}` : ''}`, { signal })
  );

  const leaders = leadersResource.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Campus Leadership"
          subtitle="Pastors, directors, and coordinators serving this local sanctuary expression."
          showBack
        />

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
              title="No Campus Leaders Listed"
              message="Campus leadership directory will appear here once assigned by church administration."
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
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
});

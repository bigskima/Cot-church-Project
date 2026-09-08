import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, Icon, LeaderCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export function ExpressionLeadershipExperience({ embedded = false, expressionId }: { embedded?: boolean; expressionId?: string }) {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const branchId = expressionId ?? context?.expression?.id;
  const expressionName = context?.expression?.name ?? 'this Expression';

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
      {embedded ? (
        <ExpressionPeopleHeader
          expressionId={branchId}
          expressionName={expressionName}
          active="leadership"
          title="Leadership"
          subtitle="Meet the pastors and ministry leaders serving this Expression."
          icon="ribbon-outline"
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: embedded ? spacing.sm : insets.top + spacing.sm, paddingBottom: embedded ? insets.bottom + spacing.xl : insets.bottom + 120 },
        ]}
      >
        {!embedded ? (
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <ScreenHeader
              title="Expression Leadership"
              kicker="COMMUNITY"
              subtitle={`Pastors and ministry leaders serving ${expressionName}.`}
              showBack
            />
          </View>
        ) : null}

        <View style={styles.body}>
          <View style={[styles.contextCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <View style={[styles.contextIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="ribbon-outline" size={18} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.contextTitle, { color: colors.text }]}>Serving this community</Text>
              <Text style={[styles.contextCopy, { color: colors.textSecondary }]}>Leadership shown here is scoped to {expressionName}, separate from the church-wide General COT leadership experience.</Text>
            </View>
          </View>

          {leadersResource.loading ? (
            <View style={styles.stack}>
              <Skeleton height={96} />
              <Skeleton height={96} />
              <Skeleton height={96} />
            </View>
          ) : leadersResource.error && !leadersResource.data ? (
            <ResourceError
              message={leadersResource.error}
              retry={leadersResource.refresh}
            />
          ) : leaders.length > 0 ? (
            <View style={styles.stack}>
              {leaders.map((leader) => (
                <LeaderCard
                  key={leader.id}
                  leader={leader}
                  variant="standard"
                />
              ))}
            </View>
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
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md },
  stack: { gap: spacing.sm },
  contextCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  contextIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  contextTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  contextCopy: { fontSize: 11, lineHeight: 17, marginTop: 2 },
});

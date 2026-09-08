import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState, ResourceError, SermonCard, Skeleton } from '@/components';
import { ExpressionMediaHeader } from '@/components/expression/ExpressionMediaHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';

type Payload = { sermons: Sermon[] };

export default function ExpressionSermonsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';
  const expressionName = context?.expression?.id === id ? context.expression.name : membership?.name ?? 'this Expression';

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (id) params.set('expressionId', id);
    return `home-feed?${params.toString()}`;
  }, [id, organizationId]);

  const resource = useResource<Payload>(
    `expression:sermons:${organizationId || 'none'}:${id || 'none'}:${mode}`,
    (signal) => api.request<Payload>(path, { signal }),
  );

  const sermons = resource.data?.sermons ?? [];
  const latest = sermons[0] ?? null;
  const earlier = sermons.slice(1);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionMediaHeader
        expressionId={id}
        expressionName={expressionName}
        active="sermons"
        title="Sermons"
        subtitle="Teachings and messages published specifically for this Expression."
        icon="mic-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        showsVerticalScrollIndicator={false}
      >
        {resource.loading && !resource.data ? (
          <View style={styles.stack}><Skeleton height={210} count={3} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : latest ? (
          <>
            <View style={styles.librarySummary}>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <Text style={[styles.metricNumber, { color: colors.text }]}>{sermons.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Published messages</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.metricNumber, { color: colors.interactive }]}>Private</Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Expression library</Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionCopy}>
                <Text style={[styles.eyebrow, { color: colors.interactive }]}>LATEST MESSAGE</Text>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Continue with the newest teaching</Text>
              </View>
              <View style={[styles.featuredShell, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm]}>
                <SermonCard
                  sermon={latest}
                  onPress={() => router.push(`/expressions/${id}/sermons/${latest.id}` as any)}
                />
              </View>
            </View>

            {earlier.length ? (
              <View style={styles.section}>
                <View style={styles.sectionCopy}>
                  <Text style={[styles.eyebrow, { color: colors.textMuted }]}>LIBRARY</Text>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>More messages</Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Earlier teaching published inside {expressionName}.</Text>
                </View>
                <View style={styles.stack}>
                  {earlier.map((sermon) => (
                    <SermonCard
                      key={sermon.id}
                      sermon={sermon}
                      onPress={() => router.push(`/expressions/${id}/sermons/${sermon.id}` as any)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState title="No sermons here yet" message="Sermons published specifically for this Expression will appear here." iconName="mic-outline" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.lg },
  librarySummary: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, minHeight: 66, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, justifyContent: 'center' },
  metricNumber: { fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3 },
  metricLabel: { fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 2 },
  section: { gap: spacing.sm },
  sectionCopy: { gap: 2 },
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.25 },
  sectionHint: { fontSize: 11, lineHeight: 16 },
  featuredShell: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  stack: { gap: spacing.sm },
});

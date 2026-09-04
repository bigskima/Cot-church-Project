import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ResourceError, ScreenHeader, SermonCard, Skeleton } from '@/components';
import { spacing, typography } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon, SermonSeries } from '@/types/content';

type SeriesPayload = { series: SermonSeries; sermons: Sermon[] };

export default function PublicSeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const resource = useResource<SeriesPayload>(`public:series:${organizationId || 'all'}:${id}`, (signal) =>
    api.request<SeriesPayload>(`public-content?type=series-detail&id=${encodeURIComponent(id)}${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ''}`, { signal, context: 'public' }));

  return <View style={[styles.screen, { backgroundColor: colors.bg }]}><ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
    <ScreenHeader title={resource.data?.series.title ?? 'Sermon Series'} showBack />
    {resource.loading && !resource.data ? <Skeleton height={90} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : resource.data ? <>
      {resource.data.series.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{resource.data.series.description}</Text> : null}
      <Text style={[styles.heading, { color: colors.text }]}>Messages</Text>
      {resource.data.sermons.length ? resource.data.sermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} onPress={() => router.push(`/sermon/${sermon.id}` as any)} />) : <EmptyState title="No published messages" message="Published sermons in this series will appear here." iconName="book-outline" />}
    </> : null}
  </ScrollView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { paddingHorizontal: spacing.lg, gap: spacing.md }, description: { ...typography.body, lineHeight: 22 }, heading: { ...typography.h3 } });

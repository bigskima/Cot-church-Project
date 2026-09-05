import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ResourceError, ScreenHeader, SectionHeader, SermonCard, Skeleton } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
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
  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';

  const resource = useResource<SeriesPayload>(`public:series:${organizationId || 'all'}:${id}`, (signal) =>
    api.request<SeriesPayload>(
      `public-content?type=series-detail&id=${encodeURIComponent(id)}${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ''}`,
      { signal, context: 'public' },
    ),
  );

  const series = resource.data?.series;
  const sermons = resource.data?.sermons ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title={series?.title ?? 'Sermon Series'}
            kicker="SERIES"
            subtitle={series?.description || `${sermons.length} published ${sermons.length === 1 ? 'message' : 'messages'}`}
            showBack
          />
        </View>

        <View style={styles.body}>
          {resource.loading && !resource.data ? (
            <Skeleton height={110} count={3} />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : resource.data ? (
            <>
              {series?.description ? (
                <View style={[styles.descriptionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>{series.description}</Text>
                </View>
              ) : null}

              <View style={styles.messages}>
                <SectionHeader title="Messages" badge={sermons.length} subtitle="Teachings published in this series" />
                {sermons.length ? (
                  sermons.map((sermon) => (
                    <SermonCard
                      key={sermon.id}
                      sermon={sermon}
                      onPress={() => router.push(`/sermon/${sermon.id}` as any)}
                    />
                  ))
                ) : (
                  <EmptyState title="No published messages" message="Published sermons in this series will appear here." iconName="book-outline" />
                )}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  heroCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
  descriptionCard: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  description: { ...typography.body, lineHeight: 22 },
  messages: { gap: spacing.sm },
});

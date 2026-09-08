import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip, EmptyState, ResourceError, Skeleton, VideoCard } from '@/components';
import { ExpressionMediaHeader } from '@/components/expression/ExpressionMediaHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Video } from '@/types/content';

type Payload = { videos: Video[] };

const categories = [
  { value: 'all', label: 'All' },
  { value: 'teaching', label: 'Teachings' },
  { value: 'worship', label: 'Worship' },
  { value: 'conference', label: 'Conferences' },
  { value: 'testimony', label: 'Testimonies' },
  { value: 'interview', label: 'Interviews' },
];

export default function ExpressionVideosScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');

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
    `expression:videos:${organizationId || 'none'}:${id || 'none'}:${mode}`,
    (signal) => api.request<Payload>(path, { signal }),
  );

  const videos = resource.data?.videos ?? [];
  const filtered = selectedCategory === 'all'
    ? videos
    : videos.filter((video) => video.category?.toLowerCase() === selectedCategory);
  const activeCategory = categories.find((item) => item.value === selectedCategory)?.label ?? 'All';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionMediaHeader
        expressionId={id}
        expressionName={expressionName}
        active="videos"
        title="Videos"
        subtitle="Long-form teaching, worship, testimonies and other media shared inside this Expression."
        icon="videocam-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.librarySummary}>
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <Text style={[styles.metricNumber, { color: colors.text }]}>{videos.length}</Text>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Videos in library</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.metricNumber, { color: colors.interactive }]} numberOfLines={1}>{activeCategory}</Text>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{filtered.length} showing</Text>
          </View>
        </View>

        <View style={[styles.filterCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.filterEyebrow, { color: colors.textMuted }]}>BROWSE BY TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {categories.map((category) => (
              <Chip
                key={category.value}
                label={category.label}
                selected={selectedCategory === category.value}
                onPress={() => setSelectedCategory(category.value)}
              />
            ))}
          </ScrollView>
        </View>

        {resource.loading && !resource.data ? (
          <View style={styles.stack}><Skeleton height={220} count={3} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : filtered.length ? (
          <View style={styles.section}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>{selectedCategory === 'all' ? 'VIDEO LIBRARY' : activeCategory.toUpperCase()}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{selectedCategory === 'all' ? 'Watch inside your Expression' : `${activeCategory} videos`}</Text>
            </View>
            <View style={styles.stack}>
              {filtered.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  expressionName={expressionName}
                  onPress={() => router.push(`/expressions/${id}/videos/${video.id}` as any)}
                />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState
            title={selectedCategory === 'all' ? 'No videos here yet' : `No ${activeCategory.toLowerCase()} videos yet`}
            message={selectedCategory === 'all' ? 'Videos published specifically for this Expression will appear here.' : 'Choose another category or check back when new media is published.'}
            iconName="videocam-outline"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.md },
  librarySummary: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, minHeight: 66, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, justifyContent: 'center' },
  metricNumber: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.25 },
  metricLabel: { fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 2 },
  filterCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  filterEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.8 },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  section: { gap: spacing.sm },
  sectionEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.25, marginTop: 2 },
  stack: { gap: spacing.sm },
});

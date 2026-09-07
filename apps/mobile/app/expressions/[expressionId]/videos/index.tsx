import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip, EmptyState, ResourceError, Skeleton, VideoCard } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
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

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION MEDIA</Text>
        <Text style={[styles.title, { color: colors.text }]}>Videos</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>Long-form media published inside {expressionName}.</Text>
      </View>

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

      {resource.loading && !resource.data ? (
        <Skeleton height={220} count={3} />
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : filtered.length ? (
        <View>
          {filtered.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              expressionName={expressionName}
              onPress={() => router.push(`/expressions/${id}/videos/${video.id}` as any)}
            />
          ))}
        </View>
      ) : (
        <EmptyState title="No videos here yet" message="Videos published specifically for this Expression will appear here." iconName="videocam-outline" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingBottom: 80 },
  heading: { marginBottom: spacing.md },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  chips: { gap: spacing.xs, paddingBottom: spacing.md },
});

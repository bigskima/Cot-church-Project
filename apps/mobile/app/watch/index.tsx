import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Chip,
  EmptyState,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  VideoCard,
} from '@/components';
import { spacing } from '@/design-system/tokens';
import type { Video, VideoCategory } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

const categories: Array<{ id: 'all' | VideoCategory; label: string }> = [
  { id: 'all', label: 'All Videos' },
  { id: 'worship', label: 'Worship Sessions' },
  { id: 'teaching', label: 'Expository Teachings' },
  { id: 'conference', label: 'Conferences' },
  { id: 'interview', label: 'Interviews' },
  { id: 'testimony', label: 'Testimonies' },
  { id: 'documentary', label: 'Documentaries' },
];

export default function WatchCatalogScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<'all' | VideoCategory>('all');

  const videosResource = useResource<Video[]>('watch:catalog', (signal) =>
    api.request<Video[]>(
      `public-content?type=videos${organization ? `&organizationId=${organization}` : ''}`,
      { signal }
    )
  );

  const videos = videosResource.data ?? [];
  const filteredVideos =
    selectedCategory === 'all'
      ? videos
      : videos.filter((v) => v.category === selectedCategory);

  const expressionName = context?.expression?.name || context?.organizations?.[0]?.name;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={videosResource.loading}
            onRefresh={videosResource.refresh}
            tintColor={colors.interactive}
          />
        }
      >
        <ScreenHeader
          title="Watch Catalog"
          subtitle="Documentaries, worship sessions, conferences, and pastoral teachings."
          showBack
        />

        {/* Category Horizontal Selector Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.label}
              selected={selectedCategory === cat.id}
              onPress={() => setSelectedCategory(cat.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.body}>
          {videosResource.loading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={200} />
              <Skeleton height={200} />
            </View>
          ) : videosResource.error && !videosResource.data ? (
            <ResourceError message={videosResource.error} retry={videosResource.refresh} />
          ) : filteredVideos.length > 0 ? (
            <View style={styles.list}>
              {filteredVideos.map((vid) => (
                <VideoCard
                  key={vid.id}
                  video={vid}
                  expressionName={expressionName}
                  onPress={() => router.push(`/watch/${vid.id}`)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No Videos in Category"
              message="No video publications match this category filter currently."
              iconName="videocam-outline"
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
  categoriesRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.xs,
  },
});

import React, { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  VideoCard,
  WatchSkeleton,
} from '@/components';
import { spacing } from '@/design-system/tokens';
import type { Video } from '@/types/content';

export default function WatchCatalogueScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const orgParam =
    mode === 'visitor'
      ? `?organizationId=${process.env.EXPO_PUBLIC_ORGANIZATION_ID || ''}`
      : context?.expression?.id
      ? `?expressionId=${context.expression.id}`
      : '';

  const resource = useResource<Video[]>('watch:catalogue', (signal) => {
    return api.request<Video[]>(`public-content?type=videos${orgParam ? `&${orgParam.slice(1)}` : ''}`, { signal });
  });

  const videos = resource.data ?? [];
  const filteredVideos =
    selectedCategory === 'all'
      ? videos
      : videos.filter((v) => v.category?.toLowerCase() === selectedCategory.toLowerCase());

  const categories = ['all', 'Sermons', 'Worship', 'Conferences', 'Devotionals', 'Documentary'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Watch Video Library"
        subtitle="Explore long-form teachings, worship sets, and full-length ministry broadcasts."
        showBack
      />

      {/* Category Chips Bar */}
      <View style={[styles.categoriesContainer, { borderBottomColor: colors.borderSubtle }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat === 'all' ? 'All Videos' : cat}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredVideos}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor={colors.interactive}
          />
        }
        ListEmptyComponent={
          resource.loading && !resource.data ? (
            <WatchSkeleton />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : (
            <EmptyState
              title="No Videos in this Category"
              message="New video teachings and broadcast recordings will appear here soon."
              iconName="videocam-outline"
            />
          )
        }
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            onPress={() => router.push(`/watch/${item.id}` as any)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  categoriesContainer: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  chipsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});

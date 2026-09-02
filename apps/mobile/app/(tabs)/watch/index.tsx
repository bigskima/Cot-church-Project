import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
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
  Icon,
  ResourceError,
  SermonCard,
  VideoCard,
  WatchSkeleton,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import type { Reel, Sermon, Video } from '@/types/content';

export default function WatchScreen() {
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

  const videosResource = useResource<Video[]>('watch:catalogue', (signal) => {
    return api.request<Video[]>(`public-content?type=videos${orgParam ? `&${orgParam.slice(1)}` : ''}`, { signal });
  });

  const reelsResource = useResource<Reel[]>('watch:reels', (signal) => {
    return api.request<Reel[]>(
      `public-content?type=reels${orgParam ? `&${orgParam.slice(1)}` : ''}`,
      { signal }
    );
  });

  const sermResource = useResource<Sermon[]>('watch:sermons', (signal) => {
    return api.request<Sermon[]>(
      mode === 'authenticated'
        ? 'sermons'
        : `public-content${orgParam ? `?type=sermons&${orgParam.slice(1)}` : '?type=sermons'}`,
      { signal }
    );
  });

  const videos = videosResource.data ?? [];
  const reels = reelsResource.data ?? [];
  const sermons = sermResource.data ?? [];

  const filteredVideos =
    selectedCategory === 'all'
      ? videos
      : videos.filter((v) => v.category?.toLowerCase() === selectedCategory.toLowerCase());

  const categories = ['all', 'Sermons', 'Worship', 'Conferences', 'Devotionals', 'Documentary'];

  const openReels = () => router.push('/reels');

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.bg,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Watch</Text>
      </View>

      {/* Entry point into full-screen Reels */}
      {reels.length > 0 ? (
        <Pressable
          onPress={openReels}
          accessibilityRole="button"
          accessibilityLabel="Open full-screen Shorts"
          style={[styles.reelsBanner, { backgroundColor: '#061426', borderColor: '#1A263D' }]}
        >
          <View style={styles.reelsBannerIconWrap}>
            <Icon name="play-circle" size={22} color="#EF4444" />
          </View>
          <View style={styles.reelsBannerCopy}>
            <Text style={styles.reelsBannerTitle}>Shorts & Story Clips</Text>
            <Text style={styles.reelsBannerSubtitle}>
              {reels.length} short clips · Full-screen viewing
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>
      ) : null}

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
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 48 }]}
        refreshControl={
          <RefreshControl
            refreshing={videosResource.loading}
            onRefresh={videosResource.refresh}
            tintColor={colors.interactive}
          />
        }
        ListHeaderComponent={
          filteredVideos.length > 0 ? (
            <Text style={[styles.featuredTitle, { color: colors.text }]}>Long-form Teachings</Text>
          ) : null
        }
        ListEmptyComponent={
          videosResource.loading && !videosResource.data ? (
            <WatchSkeleton />
          ) : videosResource.error && !videosResource.data ? (
            <ResourceError message={videosResource.error} retry={videosResource.refresh} />
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
        ListFooterComponent={
          sermons.length > 0 ? (
            <View style={styles.sermonsSection}>
              <Text style={[styles.featuredTitle, { color: colors.text, marginBottom: spacing.md }]}>
                Sermon Series
              </Text>
              {sermons.slice(0, 3).map((sermon) => (
                <SermonCard
                  key={sermon.id}
                  sermon={sermon}
                  variant="row"
                  onPress={() => router.push(`/(tabs)/discover/sermon/${sermon.id}` as any)}
                />
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  reelsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  reelsBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelsBannerCopy: {
    flex: 1,
    gap: 2,
  },
  reelsBannerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  reelsBannerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
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
  featuredTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sermonsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
});

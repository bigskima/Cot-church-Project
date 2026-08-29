import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, ResourceError, ScreenHeader, SectionHeader, Skeleton, VideoCard } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Video, VideoCategory } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

const categories: Array<{ id: 'all' | VideoCategory; label: string; icon: string }> = [
  { id: 'all', label: 'All Watch', icon: '🎬' },
  { id: 'worship', label: 'Worship Sessions', icon: '🕊️' },
  { id: 'teaching', label: 'Expository Teachings', icon: '📖' },
  { id: 'conference', label: 'Conferences', icon: '🏛️' },
  { id: 'interview', label: 'Interviews', icon: '🎙️' },
  { id: 'testimony', label: 'Testimonies', icon: '✨' },
  { id: 'documentary', label: 'Documentaries', icon: '🎥' },
];

export default function WatchCatalogScreen() {
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();
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

  const featured = filteredVideos[0];
  const list = filteredVideos.slice(1);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }] as any}>
      {/* Top Navbar Header */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ] as any}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn as any}>
          <Text style={[styles.backText, { color: colors.text }] as any}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }] as any} numberOfLines={1}>
          Watch Catalog
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content as any}
        refreshControl={
          <RefreshControl
            refreshing={videosResource.loading}
            onRefresh={videosResource.refresh}
            tintColor={palette.gold}
          />
        }
      >
        {/* Category Horizontal Selector Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow as any}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected
                      ? palette.gold
                      : isDark
                      ? '#1C1008'
                      : '#FFFDF9',
                    borderColor: isSelected
                      ? palette.gold
                      : isDark
                      ? '#3D2415'
                      : palette.line,
                  },
                ] as any}
              >
                <Text style={{ fontSize: 13 } as any}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: isSelected
                        ? '#140C07'
                        : isDark
                        ? '#FFFDF9'
                        : colors.text,
                    },
                  ] as any}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {videosResource.loading ? (
          <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
            <Skeleton height={200} dark={isDark} />
            <Skeleton height={120} dark={isDark} />
            <Skeleton height={120} dark={isDark} />
          </View>
        ) : videosResource.error && !videos.length ? (
          <View style={styles.centerWrapper as any}>
            <ResourceError
              offline={videosResource.offline}
              message={videosResource.error}
              retry={videosResource.refresh}
              dark={isDark}
            />
          </View>
        ) : filteredVideos.length === 0 ? (
          <View style={styles.centerWrapper as any}>
            <EmptyState
              title="No Watch Videos Available"
              message="New documentaries, conference sessions, and worship broadcasts will be published here soon."
              icon="🎬"
              dark={isDark}
            />
          </View>
        ) : (
          <View style={styles.listContainer as any}>
            {/* Featured Showcase Video */}
            {featured && (
              <View style={styles.featuredWrapper as any}>
                <SectionHeader
                  title="FEATURED BROADCAST"
                  subtitle="Editor's spotlight from our sanctuary archive"
                  dark={isDark}
                />
                <VideoCard
                  video={featured}
                  expressionName="Main Sanctuary Campus"
                  onPress={() => router.push(`/watch/${featured.id}` as any)}
                  dark={isDark}
                />
              </View>
            )}

            {/* Remaining Video List */}
            {list.length > 0 && (
              <View style={{ gap: spacing.md }}>
                <SectionHeader
                  title="LATEST RELEASES"
                  subtitle="Explore all teachings, documentaries, and worship"
                  dark={isDark}
                />
                {list.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    expressionName="Sanctuary Expression"
                    onPress={() => router.push(`/watch/${video.id}` as any)}
                    dark={isDark}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '800',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  content: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
    paddingBottom: 100,
  },
  categoriesRow: {
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  featuredWrapper: {
    gap: spacing.sm,
  },
  centerWrapper: {
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

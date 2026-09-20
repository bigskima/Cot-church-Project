import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip, EmptyState, InputField, ResourceError, Skeleton, VideoCard } from '@/components';
import { ExpressionMediaHeader } from '@/components/expression/ExpressionMediaHeader';
import { spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Video } from '@/types/content';

type Payload = { videos: Video[] };
type CategoryOption = { category: string; label: string; aliases?: string[] };

export default function ExpressionVideosScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, auth, context, mode } = useSession();
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categorySearch, setCategorySearch] = useState('');

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';
  const expressionName = context?.expression?.id === id ? context.expression.name : membership?.name ?? 'this Expression';
  const accessToken = auth?.session.accessToken ?? null;

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

  const categoryResource = useResource<CategoryOption[]>(
    `expression:video-category-options:${organizationId || 'none'}`,
    async () => {
      if (!organizationId) return [];
      try {
        const supabase = await getRuntimeSupabase(accessToken);
        const { data, error } = await supabase.rpc('get_video_category_options', { target_organization_id: organizationId });
        if (error) throw error;
        return Array.isArray(data) ? data as CategoryOption[] : [];
      } catch {
        return [];
      }
    },
  );

  const videos = resource.data?.videos ?? [];
  const fallbackCategories = useMemo<CategoryOption[]>(() => {
    const unique = [...new Set(videos.map((video) => String(video.category ?? '').trim()).filter(Boolean))];
    return unique.map((category) => ({
      category,
      label: category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      aliases: [],
    }));
  }, [videos]);
  const categoryOptions = categoryResource.data?.length ? categoryResource.data : fallbackCategories;
  const categories = useMemo(() => [{ category: 'all', label: 'All', aliases: [] as string[] }, ...categoryOptions], [categoryOptions]);
  const visibleCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((item) => item.category === 'all' || [item.category, item.label, ...(item.aliases ?? [])].some((value) => value.toLowerCase().includes(query)));
  }, [categories, categorySearch]);

  const filtered = selectedCategory === 'all'
    ? videos
    : videos.filter((video) => video.category?.toLowerCase() === selectedCategory.toLowerCase());
  const activeCategory = categories.find((item) => item.category === selectedCategory)?.label ?? 'All';

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
        {categoryOptions.length ? (
          <View style={styles.filters}>
            {categoryOptions.length > 6 ? (
              <InputField
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search categories"
                autoCapitalize="none"
              />
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {visibleCategories.map((category) => (
                <Chip
                  key={category.category}
                  label={category.label}
                  selected={selectedCategory === category.category}
                  onPress={() => setSelectedCategory(category.category)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {resource.loading && !resource.data ? (
          <View style={styles.stack}><Skeleton height={220} count={3} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : filtered.length ? (
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
  filters: { gap: spacing.xs },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  stack: { gap: spacing.sm },
});

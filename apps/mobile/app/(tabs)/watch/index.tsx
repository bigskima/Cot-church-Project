import React, { useMemo, useState } from 'react';
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
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import {
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  SermonCard,
  VideoCard,
  WatchSkeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Reel, Sermon, Video } from '@/types/content';

type CategoryOption = { category: string; label: string; aliases?: string[] };

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const { api, auth, mode, context } = useSession();
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categorySearch, setCategorySearch] = useState('');

  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  type WatchPayload = { videos: Video[]; reels: Reel[]; sermons: Sermon[] };
  const catalogue = useResource<WatchPayload>(
    `watch:catalogue:public:${organizationId || 'auto'}:${mode}`,
    async (signal) => {
      const suffix = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : '';
      const [videos, reels, sermons] = await Promise.all([
        api.request<Video[]>(`public-content?type=videos${suffix}`, { signal, context: 'public' }),
        api.request<Reel[]>(`public-content?type=reels${suffix}`, { signal, context: 'public' }),
        api.request<Sermon[]>(`public-content?type=sermons${suffix}`, { signal, context: 'public' }),
      ]);
      return { videos, reels, sermons };
    },
  );

  const categoryResource = useResource<CategoryOption[]>(
    `watch:category-options:${organizationId || 'none'}`,
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

  const videos = catalogue.data?.videos ?? [];
  const reels = catalogue.data?.reels ?? [];
  const sermons = catalogue.data?.sermons ?? [];
  const fallbackCategories = useMemo<CategoryOption[]>(() => {
    const unique = [...new Set(videos.map((video) => String(video.category ?? '').trim()).filter(Boolean))];
    return unique.map((category) => ({ category, label: category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) }));
  }, [videos]);
  const categoryOptions = categoryResource.data?.length ? categoryResource.data : fallbackCategories;
  const categories = useMemo(() => [{ category: 'all', label: 'All', aliases: [] as string[] }, ...categoryOptions], [categoryOptions]);
  const visibleCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((item) => item.category === 'all' || [item.category, item.label, ...(item.aliases ?? [])].some((value) => value.toLowerCase().includes(query)));
  }, [categories, categorySearch]);

  const filteredVideos = selectedCategory === 'all' ? videos : videos.filter((video) => video.category?.toLowerCase() === selectedCategory.toLowerCase());
  const featuredVideo = filteredVideos[0];
  const remainingVideos = featuredVideo ? filteredVideos.slice(1) : [];
  const selectedLabel = categories.find((item) => item.category === selectedCategory)?.label ?? 'Videos';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.xs, backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerKicker, { color: colors.interactive }]}>GENERAL COT · WATCH</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Watch</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Long-form videos, teachings and replayable moments.</Text>
        </View>
        {mode === 'authenticated' ? (
          <Pressable onPress={() => router.push('/general/studio/video' as any)} style={({ pressed }) => [styles.headerCreate, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Create public video">
            <Icon name="add-outline" size={17} color={colors.interactive} /><Text style={[styles.headerCreateText, { color: colors.interactive }]}>Create</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.overviewRow}>
        <View style={[styles.overviewItem, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.overviewValue, { color: colors.text }]}>{videos.length}</Text><Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Videos</Text></View>
        <Pressable onPress={() => router.push('/general/reels')} style={({ pressed }) => [styles.overviewItem, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><Text style={[styles.overviewValue, { color: colors.live }]}>{reels.length}</Text><Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Reels</Text></Pressable>
        <View style={[styles.overviewItem, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.overviewValue, { color: colors.text }]}>{sermons.length}</Text><Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Messages</Text></View>
      </View>

      {reels.length > 0 ? (
        <Pressable onPress={() => router.push('/general/reels')} accessibilityRole="button" accessibilityLabel="Open public Reels" style={({ pressed }) => [styles.reelsBanner, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}>
          <View style={[styles.reelsBannerIconWrap, { backgroundColor: colors.liveSoft }]}><Icon name="flash" size={21} color={colors.live} /></View>
          <View style={styles.reelsBannerCopy}><Text style={[styles.reelsBannerTitle, { color: colors.text }]}>Open Reels</Text><Text style={[styles.reelsBannerSubtitle, { color: colors.textMuted }]}>Swipe through {reels.length} public vertical {reels.length === 1 ? 'clip' : 'clips'}</Text></View>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={[styles.categoriesContainer, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.categorySearch}><InputField label="Find a category" value={categorySearch} onChangeText={setCategorySearch} placeholder="Search Watch categories…" autoCapitalize="none" /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {visibleCategories.map((category) => <Chip key={category.category} label={category.label} selected={selectedCategory === category.category} onPress={() => setSelectedCategory(category.category)} />)}
        </ScrollView>
        {!visibleCategories.length ? <Text style={[styles.categoryHelper, { color: colors.textMuted }]}>No enabled category matches that search.</Text> : null}
      </View>

      <FlatList
        data={remainingVideos}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 130 }]}
        refreshControl={<RefreshControl refreshing={catalogue.refreshing} onRefresh={catalogue.refresh} tintColor={colors.interactive} />}
        ListHeaderComponent={
          catalogue.loading && !catalogue.data ? <WatchSkeleton /> : catalogue.error && !catalogue.data ? <ResourceError message={catalogue.error} retry={catalogue.refresh} /> : featuredVideo ? (
            <View style={styles.featuredSection}>
              <View style={styles.sectionHeading}><Text style={[styles.sectionKicker, { color: colors.interactive }]}>FEATURED</Text><Text style={[styles.sectionTitle, { color: colors.text }]}>{selectedCategory === 'all' ? 'Start watching' : selectedLabel}</Text></View>
              <VideoCard video={featuredVideo} onPress={() => router.push(`/general/watch/${featuredVideo.id}` as any)} />
              {remainingVideos.length ? <Text style={[styles.moreTitle, { color: colors.textSecondary }]}>More to watch</Text> : null}
            </View>
          ) : <EmptyState title="Nothing here yet" message="New public videos in this category will appear here." iconName="videocam-outline" />
        }
        renderItem={({ item }) => <VideoCard video={item} onPress={() => router.push(`/general/watch/${item.id}` as any)} />}
        ListFooterComponent={sermons.length > 0 ? (
          <View style={styles.sermonsSection}><View style={styles.sectionHeading}><Text style={[styles.sectionKicker, { color: colors.interactive }]}>MESSAGES</Text><Text style={[styles.sectionTitle, { color: colors.text }]}>Recent sermons</Text></View>{sermons.slice(0, 3).map((sermon) => <SermonCard key={sermon.id} sermon={sermon} variant="row" onPress={() => router.push(`/general/sermon/${sermon.id}` as any)} />)}</View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderWidth: 1, borderRadius: radius.xxl, gap: spacing.md },
  headerCopy: { flex: 1, minWidth: 0 },
  headerKicker: { ...typography.kicker, marginBottom: 2 },
  headerTitle: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.8 },
  headerSubtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  headerCreate: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  headerCreateText: { fontSize: 11, fontWeight: '800' },
  overviewRow: { flexDirection: 'row', gap: spacing.xs, marginHorizontal: spacing.md, marginTop: spacing.sm },
  overviewItem: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  overviewValue: { fontSize: 18, lineHeight: 22, fontWeight: '900' },
  overviewLabel: { fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  reelsBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md },
  reelsBannerIconWrap: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  reelsBannerCopy: { flex: 1, gap: 2 },
  reelsBannerTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  reelsBannerSubtitle: { fontSize: 11.5, lineHeight: 16 },
  categoriesContainer: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: spacing.xs, gap: spacing.xs },
  categorySearch: { paddingHorizontal: spacing.md },
  chipsRow: { paddingHorizontal: spacing.md, gap: spacing.xs },
  categoryHelper: { paddingHorizontal: spacing.md, fontSize: 10.5, lineHeight: 15 },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  featuredSection: { gap: spacing.md },
  sectionHeading: { gap: 2 },
  sectionKicker: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.8 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.4 },
  moreTitle: { fontSize: 13, fontWeight: '800', marginTop: spacing.xs },
  sermonsSection: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(127,127,127,0.18)', gap: spacing.sm },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});

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
import {
  Avatar,
  Badge,
  ChurchPickerModal,
  EmptyState,
  HeroLiveCard,
  Icon,
  PostCard,
  ReelCard,
  ResourceError,
  SermonCard,
  Skeleton,
  StoriesTray,
  VideoCard,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import type { Event, LiveStream, Reel, Sermon, SocialPost, Video } from '@/types/content';

interface HomePayload {
  streams: LiveStream[];
  reels: Reel[];
  sermons: Sermon[];
  videos: Video[];
  events: Event[];
  posts: SocialPost[];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode, hasCapability } = useSession();
  const { colors, isDark } = useTheme();

  const [churchPickerVisible, setChurchPickerVisible] = useState(false);

  const hasAnyLeadershipCapability =
    hasCapability('content.create') ||
    hasCapability('streams.broadcast') ||
    hasCapability('sermons.create') ||
    hasCapability('*');

  const organization = context?.organization ?? context?.organizations?.[0];
  const expression = context?.expression;

  const orgParam =
    mode === 'visitor'
      ? `?organizationId=${process.env.EXPO_PUBLIC_ORGANIZATION_ID || ''}`
      : expression?.id
      ? `?expressionId=${expression.id}`
      : '';

  const publicQuery = (type: string) =>
    `public-content?type=${encodeURIComponent(type)}${orgParam ? `&${orgParam.slice(1)}` : ''}`;

  const resource = useResource<HomePayload>('mobile:home:consumer', async (signal) => {
    if (mode === 'visitor') {
      const [streams, sermons, events, posts, reels, videos] = await Promise.all([
        api.request<LiveStream[]>(publicQuery('streams'), { signal }).catch(() => []),
        api.request<Sermon[]>(publicQuery('sermons'), { signal }).catch(() => []),
        api.request<Event[]>(publicQuery('events'), { signal }).catch(() => []),
        api.request<SocialPost[]>(publicQuery('posts'), { signal }).catch(() => []),
        api.request<Reel[]>(publicQuery('reels'), { signal }).catch(() => []),
        api.request<Video[]>(publicQuery('videos'), { signal }).catch(() => []),
      ]);
      return { streams, sermons, events, posts, reels, videos };
    }

    const [streams, reels, sermons, videos, events, posts] = await Promise.all([
      api.request<LiveStream[]>(`live-streams${orgParam}`, { signal }).catch(() => []),
      api.request<Reel[]>(`reels${orgParam}`, { signal }).catch(() => []),
      api.request<Sermon[]>(`sermons${orgParam}`, { signal }).catch(() => []),
      api.request<Video[]>(`videos${orgParam}`, { signal }).catch(() => []),
      api.request<Event[]>(`events${orgParam}`, { signal }).catch(() => []),
      api.request<SocialPost[]>(`social-feed${orgParam}`, { signal }).catch(() => []),
    ]);

    return { streams, reels, sermons, videos, events, posts };
  });

  const activeStream = useMemo(
    () => resource.data?.streams?.find((s) => s.status === 'live') ?? resource.data?.streams?.[0],
    [resource.data?.streams]
  );

  const reels = resource.data?.reels ?? [];
  const videos = resource.data?.videos ?? [];
  const sermons = resource.data?.sermons ?? [];
  const posts = resource.data?.posts ?? [];
  const events = resource.data?.events ?? [];

  const stories = useMemo(() => {
    const list = [];
    if (activeStream) {
      list.push({
        id: 'live_story',
        title: activeStream.status === 'live' ? 'LIVE NOW' : 'Broadcast',
        imageUrl: undefined,
        isLive: activeStream.status === 'live',
        hasUnseen: true,
        onPress: () => router.push(`/(tabs)/live/${activeStream.id}` as any),
      });
    }
    reels.slice(0, 5).forEach((r, idx) => {
      list.push({
        id: `reel_story_${r.id}`,
        title: r.caption ? r.caption.slice(0, 10) : `Reel ${idx + 1}`,
        imageUrl: undefined,
        isLive: false,
        hasUnseen: idx < 2,
        onPress: () => router.push('/reels'),
      });
    });
    return list;
  }, [activeStream, reels]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.bg,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.topBarLeft}>
          <Text style={[styles.brandWordmark, { color: colors.text }]}>
            {organization?.name ?? 'Church'}
          </Text>
          {expression?.name ? (
            <Pressable
              onPress={() => setChurchPickerVisible(true)}
              style={[styles.campusPill, { backgroundColor: colors.bgSecondary }]}
            >
              <Text style={[styles.campusPillText, { color: colors.interactive }]} numberOfLines={1}>
                {expression.name}
              </Text>
              <Icon name="chevron-down" size={12} color={colors.interactive} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.topBarRight}>
          <Pressable
            onPress={() => router.push('/assistant')}
            hitSlop={8}
            style={[styles.iconButton, { backgroundColor: colors.bgSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Spiritual AI Assistant"
          >
            <Icon name="sparkles" size={18} color={colors.interactive} />
          </Pressable>

          {hasAnyLeadershipCapability ? (
            <Pressable
              onPress={() => router.push('/studio')}
              hitSlop={8}
              style={[styles.iconButton, { backgroundColor: colors.bgSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Ministry Studio"
            >
              <Icon name="grid-outline" size={18} color={colors.interactive} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.push('/(tabs)/live' as any)}
            hitSlop={8}
            style={[styles.iconButton, { backgroundColor: colors.bgSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Live Broadcasts"
          >
            <Icon name="radio" size={18} color={activeStream?.status === 'live' ? '#EF4444' : colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor={colors.interactive}
          />
        }
      >
        {stories.length > 0 ? <StoriesTray stories={stories} /> : null}

        {activeStream ? (
          <View style={styles.heroSection}>
            <HeroLiveCard
              stream={activeStream}
              onPress={() => router.push(`/(tabs)/live/${activeStream.id}` as any)}
            />
          </View>
        ) : null}

        {videos.length > 0 || sermons.length > 0 ? (
          <View style={styles.feedSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Teachings</Text>
              <Pressable onPress={() => router.push('/watch' as any)}>
                <Text style={[styles.seeAllText, { color: colors.interactive }]}>Explore all</Text>
              </Pressable>
            </View>

            {videos.slice(0, 2).map((vid) => (
              <VideoCard
                key={vid.id}
                video={vid}
                expressionName={expression?.name}
                onPress={() => router.push(`/watch/${vid.id}` as any)}
              />
            ))}

            {sermons.slice(0, 2).map((sermon) => (
              <SermonCard
                key={sermon.id}
                sermon={sermon}
                variant="row"
                onPress={() => router.push(`/(tabs)/discover/sermon/${sermon.id}` as any)}
              />
            ))}
          </View>
        ) : null}

        {reels.length > 0 ? (
          <View style={styles.reelsSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.shortsHeader}>
                <Icon name="flash" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Reels & Shorts</Text>
              </View>
              <Pressable onPress={() => router.push('/reels')}>
                <Text style={[styles.seeAllText, { color: colors.interactive }]}>View all</Text>
              </Pressable>
            </View>

            <FlatList
              horizontal
              data={reels.slice(0, 6)}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reelsList}
              renderItem={({ item }) => <ReelCard reel={item} onPress={() => router.push('/reels')} />}
            />
          </View>
        ) : null}

        {posts.length > 0 ? (
          <View style={styles.communitySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Community Fellowship</Text>
              <Pressable onPress={() => router.push('/(tabs)/community')}>
                <Text style={[styles.seeAllText, { color: colors.interactive }]}>See timeline</Text>
              </Pressable>
            </View>

            {posts.slice(0, 4).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                expressionName={expression?.name}
                onReply={() => router.push('/(tabs)/community')}
                onShare={() => {}}
              />
            ))}
          </View>
        ) : null}

        {resource.loading && !resource.data ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={200} borderRadius={radius.lg} />
            <Skeleton height={80} count={3} />
          </View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : null}
      </ScrollView>

      <ChurchPickerModal
        visible={churchPickerVisible}
        onClose={() => setChurchPickerVisible(false)}
        churches={(context?.organizations as any) ?? []}
        selectedChurchId={organization?.id}
        onSelectChurch={(_church) => setChurchPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  brandWordmark: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  campusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    maxWidth: 160,
  },
  campusPillText: { fontSize: 12, fontWeight: '600' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconButton: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1 },
  heroSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  feedSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  shortsHeader: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { fontSize: 13, fontWeight: '700' },
  reelsSection: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  reelsList: { gap: spacing.sm, paddingRight: spacing.lg },
  communitySection: { paddingTop: spacing.lg },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
});

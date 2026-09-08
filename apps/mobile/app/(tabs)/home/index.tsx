import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  BrandMark,
  EmptyState,
  EventCard,
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
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Event, LiveStream, Reel, Sermon, SocialPost, Video } from '@/types/content';

interface HomePayload {
  organization: { id: string; name: string; slug?: string };
  expression?: { id: string; name: string } | null;
  mode: 'general' | 'expression';
  streams: LiveStream[];
  posts: CommunityPost[];
  reels: Reel[];
  sermons: Sermon[];
  videos: Video[];
  events: Event[];
  degradedSections?: string[];
  rankingMode?: 'personalized' | 'recent' | 'expression';
}

type PublicBadge = { id?: string; code?: string; label: string; backgroundColor: string; textColor: string; priority?: number };
type CommunityPost = SocialPost & {
  author?: { id: string; displayName?: string; username?: string; avatarUrl?: string | null; bio?: string | null; badges?: PublicBadge[] } | null;
  expression?: { id: string; name: string; code?: string } | null;
  likes_count?: number;
  comments_count?: number;
  viewer_reaction?: string | null;
  viewer_bookmarked?: boolean;
};
type Ranked = { feed_rank?: number; feed_reason?: 'following' | 'continue' | 'popular' | 'recent' };
type HomeFeedUnit =
  | { key: string; kind: 'post'; timestamp: number; rank: number; post: CommunityPost & Ranked }
  | { key: string; kind: 'reel'; timestamp: number; rank: number; reel: Reel & Ranked }
  | { key: string; kind: 'video'; timestamp: number; rank: number; video: Video & Ranked }
  | { key: string; kind: 'sermon'; timestamp: number; rank: number; sermon: Sermon & Ranked }
  | { key: string; kind: 'event'; timestamp: number; rank: number; event: Event & Ranked };

function timeValue(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();

  const contextOrganization = context?.organization ?? context?.organizations?.[0];
  const organizationId = contextOrganization?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  // General Home is always church-wide. Private Expression ranking and content
  // are owned by /expressions/[expressionId], never by this route.
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    const suffix = params.toString();
    return `home-feed${suffix ? `?${suffix}` : ''}`;
  }, [organizationId]);

  const resourceKey = `mobile:home-feed:${organizationId || 'auto'}:general:${mode}`;
  const resource = useResource<HomePayload>(resourceKey, (signal) => api.request<HomePayload>(query, { signal }));

  const organization = resource.data?.organization ?? contextOrganization;
  const streams = resource.data?.streams ?? [];
  const posts = resource.data?.posts ?? [];
  const reels = resource.data?.reels ?? [];
  const videos = resource.data?.videos ?? [];
  const sermons = resource.data?.sermons ?? [];
  const events = resource.data?.events ?? [];
  const degradedSections = resource.data?.degradedSections ?? [];
  const rankingMode = resource.data?.rankingMode === 'personalized' ? 'personalized' : 'recent';

  const activeStream = useMemo(
    () => streams.find((stream) => stream.status === 'live') ?? streams.find((stream) => stream.status === 'scheduled'),
    [streams],
  );

  const feed = useMemo<HomeFeedUnit[]>(() => {
    const units: HomeFeedUnit[] = [
      ...posts.map((post) => ({
        key: `post:${post.id}`,
        kind: 'post' as const,
        timestamp: timeValue(post.published_at || (post as any).created_at),
        rank: (post as CommunityPost & Ranked).feed_rank ?? 0,
        post,
      })),
      ...reels.map((reel) => ({
        key: `reel:${reel.id}`,
        kind: 'reel' as const,
        timestamp: timeValue((reel.content_items as any)?.published_at || reel.created_at),
        rank: (reel as Reel & Ranked).feed_rank ?? 0,
        reel,
      })),
      ...videos.map((video) => ({
        key: `video:${video.id}`,
        kind: 'video' as const,
        timestamp: timeValue((video.content_items as any)?.published_at || video.created_at),
        rank: (video as Video & Ranked).feed_rank ?? 0,
        video,
      })),
      ...sermons.map((sermon) => ({
        key: `sermon:${sermon.id}`,
        kind: 'sermon' as const,
        timestamp: timeValue(sermon.published_at || sermon.sermon_date),
        rank: (sermon as Sermon & Ranked).feed_rank ?? 0,
        sermon,
      })),
      ...events.map((event) => ({
        key: `event:${event.id}`,
        kind: 'event' as const,
        timestamp: timeValue((event as any).created_at || event.starts_at),
        rank: (event as Event & Ranked).feed_rank ?? 0,
        event,
      })),
    ];
    return units.sort((a, b) => b.rank - a.rank || b.timestamp - a.timestamp);
  }, [posts, reels, videos, sermons, events]);

  const canEngage = mode === 'authenticated';
  const postScope = 'general' as const;
  const postRequestContext = 'public' as const;

  const openGeneralComposer = (compose: 'post' | 'audio') => {
    router.push({
      pathname: '/general/community',
      params: { compose, intentId: String(Date.now()) },
    } as any);
  };

  const openPost = (postId: string, focusComments = false) => {
    router.push({
      pathname: '/general/post/[id]',
      params: {
        id: postId,
        scope: postScope,
        ...(focusComments ? { focus: 'comments' } : {}),
      },
    } as any);
  };

  const reactToPost = async (postId: string, reaction: string | null) => {
    if (!canEngage) {
      openPost(postId, true);
      return false;
    }
    try {
      await api.request('engagement', {
        method: 'POST',
        context: postRequestContext,
        body: JSON.stringify(
          reaction
            ? { action: 'react', contentId: postId, reaction }
            : { action: 'unreact', contentId: postId },
        ),
      });
      resource.refresh();
      return true;
    } catch {
      return false;
    }
  };

  const bookmarkPost = async (postId: string, currentlySaved: boolean) => {
    if (!canEngage) {
      openPost(postId);
      return false;
    }
    try {
      const result = await api.request<{ bookmarked: boolean }>('engagement', {
        method: 'POST',
        context: postRequestContext,
        body: JSON.stringify({ action: 'bookmark', contentId: postId }),
      });
      resource.refresh();
      return result.bookmarked === !currentlySaved;
    } catch {
      return false;
    }
  };

  const stories = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      imageUrl?: string;
      isLive: boolean;
      hasUnseen: boolean;
      onPress: () => void;
    }> = [];

    if (activeStream) {
      list.push({
        id: `stream:${activeStream.id}`,
        title: activeStream.status === 'live' ? 'LIVE NOW' : 'Upcoming',
        imageUrl: activeStream.thumbnail_url,
        isLive: activeStream.status === 'live',
        hasUnseen: false,
        onPress: () => router.push(`/general/live/${activeStream.id}` as any),
      });
    }

    reels.slice(0, 6).forEach((reel) => {
      list.push({
        id: `reel:${reel.id}`,
        title: reel.caption ? reel.caption.slice(0, 12) : 'Reel',
        imageUrl: reel.media_assets?.thumbnailUrl,
        isLive: false,
        hasUnseen: false,
        onPress: () => router.push({
          pathname: '/general/reels',
          params: { reelId: reel.id },
        } as any),
      });
    });
    return list;
  }, [activeStream, reels]);

  const reelWidth = Math.max(260, Math.min(width - spacing.lg * 2, 460));

  const listHeader = (
    <>
      {mode === 'authenticated' ? (
        <View style={[styles.createDeck, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.createDeckHeader}>
            <View>
              <Text style={[styles.createDeckKicker, { color: colors.interactive }]}>CREATE IN GENERAL COT</Text>
              <Text style={[styles.createDeckTitle, { color: colors.text }]}>Share something with everyone</Text>
            </View>
            <Pressable
              onPress={() => router.push('/general/studio')}
              hitSlop={8}
              style={({ pressed }) => [styles.createDeckMore, { backgroundColor: colors.bgSecondary }, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel="Open all creation tools"
            >
              <Icon name="grid-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.createDeckActions}>
            <Pressable onPress={() => openGeneralComposer('post')} style={({ pressed }) => [styles.createDeckAction, { backgroundColor: colors.primarySoft }, pressed && styles.iconPressed]}>
              <Icon name="create-outline" size={19} color={colors.interactive} />
              <Text style={[styles.createDeckActionText, { color: colors.text }]}>Post</Text>
            </Pressable>
            <Pressable onPress={() => openGeneralComposer('audio')} style={({ pressed }) => [styles.createDeckAction, { backgroundColor: colors.bgSecondary }, pressed && styles.iconPressed]}>
              <Icon name="mic-outline" size={19} color={colors.interactive} />
              <Text style={[styles.createDeckActionText, { color: colors.text }]}>Voice</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/general/studio/reel')} style={({ pressed }) => [styles.createDeckAction, { backgroundColor: colors.bgSecondary }, pressed && styles.iconPressed]}>
              <Icon name="flash-outline" size={19} color={colors.live} />
              <Text style={[styles.createDeckActionText, { color: colors.text }]}>Reel</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/general/studio/video')} style={({ pressed }) => [styles.createDeckAction, { backgroundColor: colors.bgSecondary }, pressed && styles.iconPressed]}>
              <Icon name="videocam-outline" size={19} color={colors.interactive} />
              <Text style={[styles.createDeckActionText, { color: colors.text }]}>Video</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {degradedSections.length ? (
        <Pressable
          onPress={resource.refresh}
          accessibilityRole="button"
          accessibilityLabel="Retry loading Home"
          style={[styles.degradedBanner, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
        >
          <Icon name="alert-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.degradedText, { color: colors.textSecondary }]}>Some items couldn’t load. Tap to retry.</Text>
          <Icon name="refresh-outline" size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {stories.length ? <StoriesTray stories={stories} /> : null}

      {activeStream ? (
        <View style={styles.heroSection}>
          <HeroLiveCard stream={activeStream} onPress={() => router.push(`/general/live/${activeStream.id}` as any)} />
        </View>
      ) : null}

      {feed.length ? (
        <View style={styles.timelineHeading}>
          <Text style={[styles.timelineTitle, { color: colors.text }]}>
            {rankingMode === 'personalized' ? 'For you' : 'Latest from COT'}
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs, backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View pointerEvents="none" style={[styles.headerGlow, { backgroundColor: colors.primarySoft }]} />
        <View style={styles.topBarLeft}>
          <View style={[styles.topBarBrandShell, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }]}>
            <BrandMark variant="header" size={29} />
          </View>
          <View style={styles.topBarBrandCopy}>
            <Text style={[styles.brandWordmark, { color: colors.text }]} numberOfLines={1}>{organization?.name ?? 'COT'}</Text>
            <Pressable
              onPress={() => mode === 'authenticated' && router.push('/expressions')}
              disabled={mode !== 'authenticated'}
              accessibilityRole="button"
              accessibilityLabel="General COT. Open My Expressions"
              style={({ pressed }) => [styles.scopeControl, pressed && mode === 'authenticated' ? styles.iconPressed : null]}
            >
              <Icon name="globe-outline" size={12} color={colors.interactive} />
              <Text style={[styles.scopeControlText, { color: colors.textSecondary }]} numberOfLines={1}>General COT</Text>
              {mode === 'authenticated' ? <Icon name="chevron-down" size={12} color={colors.textMuted} /> : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <Pressable onPress={() => router.push('/general/assistant')} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]} accessibilityRole="button" accessibilityLabel="COT Assistant">
            <Icon name="sparkles" size={18} color={colors.interactive} />
          </Pressable>
          {mode === 'authenticated' ? (
            <Pressable onPress={() => router.push('/general/studio')} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]} accessibilityRole="button" accessibilityLabel="Create">
              <Icon name="add-outline" size={20} color={colors.interactive} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/general/live' as any)} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]} accessibilityRole="button" accessibilityLabel="Live">
            <Icon name="radio" size={18} color={activeStream?.status === 'live' ? '#EF4444' : colors.text} />
          </Pressable>
        </View>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.loadingContainer}>
          <Skeleton height={190} borderRadius={radius.lg} />
          <Skeleton height={120} count={4} />
        </View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyHome}>
              <EmptyState
                title="Your Home feed is ready"
                message="Published sermons, Reels, videos, live broadcasts and events will appear here."
                iconName="home-outline"
              />
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
          refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item }) => {
            if (item.kind === 'post') {
              return (
                <View style={styles.feedCardWrap}>
                  <PostCard
                    post={item.post}
                    expressionName={item.post.expression?.name}
                    canEngage={canEngage}
                    allowExternalShare={item.post.visibility === 'public'}
                    onPress={() => openPost(item.post.id)}
                    onReply={() => openPost(item.post.id, true)}
                    onReact={canEngage ? (reaction) => reactToPost(item.post.id, reaction) : undefined}
                    onBookmark={canEngage ? (currentlySaved) => bookmarkPost(item.post.id, currentlySaved) : undefined}
                    style={styles.homePostCard}
                  />
                </View>
              );
            }
            if (item.kind === 'reel') {
              return (
                <View style={styles.feedCardWrap}>
                  <View style={styles.itemLabelRow}><Icon name="flash" size={16} color="#EF4444" /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>REEL</Text></View>
                  <ReelCard
                    reel={item.reel}
                    width={reelWidth}
                    onPress={() => router.push({
                      pathname: '/general/reels',
                      params: { reelId: item.reel.id },
                    } as any)}
                  />
                </View>
              );
            }
            if (item.kind === 'video') {
              return (
                <View style={styles.feedCardWrap}>
                  <View style={styles.itemLabelRow}><Icon name="play-circle-outline" size={16} color={colors.interactive} /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>WATCH</Text></View>
                  <VideoCard video={item.video} onPress={() => router.push(`/general/watch/${item.video.id}` as any)} />
                </View>
              );
            }
            if (item.kind === 'sermon') {
              const hasAudio = Boolean(item.sermon.audio_asset_id || item.sermon.audio_url);
              const hasVideo = Boolean(item.sermon.video_asset_id || item.sermon.video_url);
              return (
                <View style={styles.feedCardWrap}>
                  <View style={styles.itemLabelRow}><Icon name={hasAudio && !hasVideo ? 'headset-outline' : 'book-outline'} size={16} color={colors.interactive} /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>{hasAudio && !hasVideo ? 'AUDIO TEACHING' : 'SERMON / TEACHING'}</Text></View>
                  <SermonCard sermon={item.sermon} onPress={() => router.push(`/general/sermon/${item.sermon.id}` as any)} />
                </View>
              );
            }
            return (
              <View style={styles.feedCardWrap}>
                <View style={styles.itemLabelRow}><Icon name="calendar-outline" size={16} color={colors.interactive} /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>UPCOMING</Text></View>
                <EventCard event={item.event} onPress={() => router.push(`/general/event/${item.event.id}` as any)} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xxl,
    minHeight: 66,
  },
  headerGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -44, top: -74, opacity: 0.7 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  topBarBrandShell: { width: 42, height: 42, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topBarBrandCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  brandWordmark: { fontSize: 16, lineHeight: 20, fontWeight: '800', letterSpacing: -0.45, flexShrink: 1 },
  scopeControl: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, minHeight: 22, borderRadius: radius.pill, paddingRight: 4 },
  scopeControlText: { fontSize: 11, lineHeight: 15, fontWeight: '600', maxWidth: 150 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 2 },
  iconButton: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  createDeck: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  createDeckHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  createDeckKicker: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.8 },
  createDeckTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.35, marginTop: 2 },
  createDeckMore: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  createDeckActions: { flexDirection: 'row', gap: spacing.xs },
  createDeckAction: { flex: 1, minHeight: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.xs },
  createDeckActionText: { fontSize: 10.5, fontWeight: '800' },
  degradedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: 42, borderWidth: 1, borderRadius: radius.lg },
  degradedText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  heroSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  timelineHeading: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  timelineTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  feedCardWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  homePostCard: { marginHorizontal: 0, marginVertical: 0 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  itemLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  emptyHome: { paddingVertical: 56, paddingHorizontal: spacing.lg },
});

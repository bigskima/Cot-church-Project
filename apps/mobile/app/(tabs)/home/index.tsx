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
  Avatar,
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
type PlaybackBatchEntry = {
  contentId: string;
  available: boolean;
  renditions?: Array<{ kind?: string; playbackUrl?: string; storagePath?: string }>;
  thumbnails?: Array<{ isPrimary?: boolean; playbackUrl?: string; storagePath?: string }>;
};
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
  const resource = useResource<HomePayload>(resourceKey, async (signal) => {
    const payload = await api.request<HomePayload>(query, { signal, context: 'public' });
    const mediaItems = [...(payload.reels ?? []), ...(payload.videos ?? [])];
    const contentIds = [...new Set(mediaItems.map((item) => item.content_items?.id).filter(Boolean) as string[])];
    if (!contentIds.length) return payload;

    const chunks: string[][] = [];
    for (let index = 0; index < contentIds.length; index += 30) chunks.push(contentIds.slice(index, index + 30));
    const settled = await Promise.allSettled(chunks.map((chunk) =>
      api.request<PlaybackBatchEntry[]>(
        `content-media?action=playback_batch&contentIds=${encodeURIComponent(chunk.join(','))}`,
        { signal, context: 'public' },
      ),
    ));
    const playback = new Map<string, PlaybackBatchEntry>();
    settled.forEach((result) => {
      if (result.status === 'fulfilled') result.value.forEach((item) => playback.set(item.contentId, item));
    });

    const hydrate = <T extends Reel | Video>(item: T): T => {
      const contentId = item.content_items?.id;
      const prepared = contentId ? playback.get(contentId) : undefined;
      const stream = prepared?.renditions?.find((rendition) => rendition.kind === 'video_stream');
      const thumbnail = prepared?.thumbnails?.find((candidate) => candidate.isPrimary)
        ?? prepared?.thumbnails?.[0];
      if (!stream?.playbackUrl && !thumbnail?.playbackUrl) return item;
      return {
        ...item,
        media_assets: {
          ...(item.media_assets ?? {}),
          ...(stream?.playbackUrl ? { url: stream.playbackUrl } : {}),
          ...(thumbnail?.playbackUrl ? { thumbnailUrl: thumbnail.playbackUrl } : {}),
          renditions: (item.media_assets?.renditions ?? []).map((rendition) =>
            rendition.rendition_kind === 'video_stream' && stream?.playbackUrl
              ? { ...rendition, playbackUrl: stream.playbackUrl }
              : rendition
          ),
        },
      };
    };

    return {
      ...payload,
      reels: (payload.reels ?? []).map(hydrate),
      videos: (payload.videos ?? []).map(hydrate),
    };
  });

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

  const reelWidth = Math.max(280, Math.min(width - spacing.md * 2, 520));

  const listHeader = (
    <>
      {mode === 'authenticated' ? (
        <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.composerMainRow}>
            <Avatar
              url={context?.profile?.avatar_url}
              name={context?.profile?.display_name ?? 'COT member'}
              size="sm"
            />
            <Pressable
              onPress={() => openGeneralComposer('post')}
              style={({ pressed }) => [
                styles.composerPrompt,
                { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                pressed && styles.iconPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Create a post in General COT"
            >
              <Text style={[styles.composerPromptText, { color: colors.textMuted }]}>Share with General COT…</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/general/studio')}
              hitSlop={8}
              style={({ pressed }) => [styles.composerMore, { backgroundColor: colors.primarySoft }, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel="Create"
            >
              <Icon name="add" size={21} color={colors.interactive} />
            </Pressable>
          </View>

          <View style={styles.composerActions}>
            <Pressable onPress={() => openGeneralComposer('post')} style={({ pressed }) => [styles.composerAction, pressed && styles.iconPressed]}>
              <Icon name="create-outline" size={16} color={colors.interactive} />
              <Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Post</Text>
            </Pressable>
            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />
            <Pressable onPress={() => openGeneralComposer('audio')} style={({ pressed }) => [styles.composerAction, pressed && styles.iconPressed]}>
              <Icon name="mic-outline" size={16} color={colors.interactive} />
              <Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Voice</Text>
            </Pressable>
            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />
            <Pressable onPress={() => router.push('/general/studio/reel')} style={({ pressed }) => [styles.composerAction, pressed && styles.iconPressed]}>
              <Icon name="flash-outline" size={16} color={colors.live} />
              <Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Reel</Text>
            </Pressable>
            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />
            <Pressable onPress={() => router.push('/general/studio/video')} style={({ pressed }) => [styles.composerAction, pressed && styles.iconPressed]}>
              <Icon name="videocam-outline" size={16} color={colors.interactive} />
              <Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Video</Text>
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

      {activeStream ? (
        <View style={styles.heroSection}>
          <HeroLiveCard stream={activeStream} onPress={() => router.push(`/general/live/${activeStream.id}` as any)} />
        </View>
      ) : null}

      {feed.length ? (
        <View style={styles.timelineHeading}>
          <View>
            <Text style={[styles.timelineEyebrow, { color: colors.interactive }]}>GENERAL FEED</Text>
            <Text style={[styles.timelineTitle, { color: colors.text }]}>
              {rankingMode === 'personalized' ? 'For you' : 'Latest from COT'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/general/explore')}
            style={({ pressed }) => [styles.exploreLink, pressed && styles.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel="Explore General COT"
          >
            <Text style={[styles.exploreLinkText, { color: colors.interactive }]}>Explore</Text>
            <Icon name="arrow-forward" size={14} color={colors.interactive} />
          </Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.homeHeader,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.card,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.homeHeaderIdentity}>
          <View style={[styles.brandBadge, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }]}>
            <BrandMark variant="header" size={28} />
          </View>
          <View style={styles.homeHeaderCopy}>
            <Pressable
              onPress={() => mode === 'authenticated' && router.push('/expressions')}
              disabled={mode !== 'authenticated'}
              accessibilityRole="button"
              accessibilityLabel="General COT. Open My Expressions"
              style={({ pressed }) => [styles.scopeTitleRow, pressed && mode === 'authenticated' ? styles.iconPressed : null]}
            >
              <Text style={[styles.scopeTitle, { color: colors.text }]} numberOfLines={1}>General COT</Text>
              {mode === 'authenticated' ? <Icon name="chevron-down" size={14} color={colors.textMuted} /> : null}
            </Pressable>
            <View style={styles.scopeMetaRow}>
              <Icon name="globe-outline" size={11} color={colors.interactive} />
              <Text style={[styles.scopeMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {organization?.name ?? 'City of Transformation'} · Public space
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.homeHeaderActions}>
          {mode === 'authenticated' ? (
            <Pressable
              onPress={() => router.push('/general/notifications')}
              hitSlop={8}
              style={({ pressed }) => [styles.headerAction, { backgroundColor: colors.bgSecondary }, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Icon name="notifications-outline" size={19} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push('/general/tools')}
            hitSlop={8}
            style={({ pressed }) => [styles.headerAction, { backgroundColor: colors.primarySoft }, pressed && styles.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel="General COT tools and settings"
          >
            <Icon name="grid-outline" size={18} color={colors.interactive} />
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
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 130 }}
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
                    onPressAuthor={item.post.author?.username ? () => router.push({
                      pathname: '/general/member/[username]',
                      params: { username: item.post.author!.username! },
                    } as any) : undefined}
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
                  <ReelCard
                    reel={item.reel}
                    width={reelWidth}
                    commentContext="public"
                    onPress={() => router.push({
                      pathname: '/general/reels',
                      params: { reelId: item.reel.id },
                    } as any)}
                    onOpenComments={item.reel.content_items?.id ? () => router.push({
                      pathname: '/general/comments/[contentId]',
                      params: { contentId: item.reel.content_items!.id },
                    } as any) : undefined}
                  />
                </View>
              );
            }
            if (item.kind === 'video') {
              return (
                <View style={styles.feedCardWrap}>
                  <VideoCard
                    video={item.video}
                    commentContext="public"
                    onPress={() => router.push(`/general/watch/${item.video.id}` as any)}
                    onPressCreator={item.video.content_items?.author?.username ? () => router.push({
                      pathname: '/general/member/[username]',
                      params: { username: item.video.content_items!.author!.username! },
                    } as any) : undefined}
                    onOpenComments={item.video.content_items?.id ? () => router.push({
                      pathname: '/general/comments/[contentId]',
                      params: { contentId: item.video.content_items!.id },
                    } as any) : undefined}
                  />
                </View>
              );
            }
            if (item.kind === 'sermon') {
              return (
                <View style={styles.feedCardWrap}>
                  <SermonCard sermon={item.sermon} onPress={() => router.push(`/general/sermon/${item.sermon.id}` as any)} />
                </View>
              );
            }
            return (
              <View style={styles.feedCardWrap}>
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
  homeHeader: {
    width: '100%',
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  homeHeaderIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandBadge: { width: 40, height: 40, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  homeHeaderCopy: { flex: 1, minWidth: 0 },
  scopeTitleRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 23 },
  scopeTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.45 },
  scopeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  scopeMeta: { fontSize: 10.5, lineHeight: 14, fontWeight: '600', flexShrink: 1 },
  homeHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerAction: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  composerCard: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  composerMainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  composerPrompt: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: 'center' },
  composerPromptText: { fontSize: 13, fontWeight: '600' },
  composerMore: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  composerActions: { flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingHorizontal: 2 },
  composerAction: { flex: 1, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  composerActionText: { fontSize: 10.5, fontWeight: '800' },
  composerDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  degradedBanner: { width: '100%', maxWidth: 680, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: 42, borderWidth: 1, borderRadius: radius.lg },
  degradedText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  heroSection: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: spacing.md },
  timelineHeading: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  timelineEyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 2 },
  timelineTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.5 },
  exploreLink: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  exploreLinkText: { fontSize: 12, fontWeight: '800' },
  feedCardWrap: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingVertical: 6 },
  homePostCard: { marginHorizontal: 0, marginVertical: 0 },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  emptyHome: { paddingVertical: 56, paddingHorizontal: spacing.lg },
});

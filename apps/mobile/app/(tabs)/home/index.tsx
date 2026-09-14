import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { getRuntimeSupabase } from '@/services/runtime-supabase';
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

type Announcement = {
  id: string;
  title: string;
  body: string;
  published_at?: string | null;
  created_at?: string | null;
};

type FeedPlanRow = {
  position: number | string;
  unit_kind: 'stream' | 'section';
  content_kind: 'post' | 'reel' | 'video' | 'sermon' | 'event' | 'announcement';
  content_ids: string[];
  newest_at?: string | null;
  score?: number | string | null;
};

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

type StreamUnit =
  | { key: string; kind: 'post'; post: CommunityPost & Ranked; timestamp: number; rank: number }
  | { key: string; kind: 'reel'; reel: Reel & Ranked; timestamp: number; rank: number }
  | { key: string; kind: 'video'; video: Video & Ranked; timestamp: number; rank: number };

type SectionUnit = {
  key: string;
  kind: 'section';
  contentKind: 'sermon' | 'event' | 'announcement';
  ids: string[];
};

type HomeFeedUnit = StreamUnit | SectionUnit;

type HomeResource = {
  payload: HomePayload;
  plan: FeedPlanRow[];
  announcements: Announcement[];
};

function timeValue(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { api, auth, context, mode } = useSession();
  const { colors } = useTheme();

  const contextOrganization = context?.organization ?? context?.organizations?.[0];
  const organizationId = contextOrganization?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const accessToken = auth?.session.accessToken ?? null;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    const suffix = params.toString();
    return `home-feed${suffix ? `?${suffix}` : ''}`;
  }, [organizationId]);

  const resourceKey = `mobile:home-feed:${organizationId || 'auto'}:general:${mode}`;
  const resource = useResource<HomeResource>(resourceKey, async (signal) => {
    let payload = await api.request<HomePayload>(query, { signal, context: 'public' });
    const mediaItems = [...(payload.reels ?? []), ...(payload.videos ?? [])];
    const contentIds = [...new Set(mediaItems.map((item) => item.content_items?.id).filter(Boolean) as string[])];

    if (contentIds.length) {
      const playbackChunks = chunks(contentIds, 30);
      const settled = await Promise.allSettled(playbackChunks.map((chunk) =>
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
        const thumbnail = prepared?.thumbnails?.find((candidate) => candidate.isPrimary) ?? prepared?.thumbnails?.[0];
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

      payload = {
        ...payload,
        reels: (payload.reels ?? []).map(hydrate),
        videos: (payload.videos ?? []).map(hydrate),
      };
    }

    let plan: FeedPlanRow[] = [];
    let announcements: Announcement[] = [];
    if (organizationId) {
      try {
        const supabase = await getRuntimeSupabase(accessToken);
        const [planResult, announcementResult] = await Promise.all([
          supabase.rpc('home_feed_layer_plan', {
            target_organization_id: organizationId,
            target_expression_id: null,
            stream_limit: 48,
            section_batch_size: 6,
            stream_items_between_sections: 4,
          }),
          mode === 'authenticated'
            ? supabase
                .from('announcements')
                .select('id,title,body,published_at,created_at')
                .eq('organization_id', organizationId)
                .is('branch_id', null)
                .eq('status', 'published')
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(36)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (!planResult.error && Array.isArray(planResult.data)) plan = planResult.data as FeedPlanRow[];
        if (!announcementResult.error && Array.isArray(announcementResult.data)) announcements = announcementResult.data as Announcement[];
      } catch {
        // Draft previews may run before the migration is promoted. Home must remain usable;
        // once the database function exists, it becomes the authoritative layout plan.
      }
    }

    return { payload, plan, announcements };
  });

  const payload = resource.data?.payload;
  const organization = payload?.organization ?? contextOrganization;
  const streams = payload?.streams ?? [];
  const posts = payload?.posts ?? [];
  const reels = payload?.reels ?? [];
  const videos = payload?.videos ?? [];
  const sermons = payload?.sermons ?? [];
  const events = payload?.events ?? [];
  const announcements = resource.data?.announcements ?? [];
  const degradedSections = payload?.degradedSections ?? [];
  const rankingMode = payload?.rankingMode === 'personalized' ? 'personalized' : 'recent';

  const activeStream = useMemo(
    () => streams.find((stream) => stream.status === 'live') ?? streams.find((stream) => stream.status === 'scheduled'),
    [streams],
  );

  const feed = useMemo<HomeFeedUnit[]>(() => {
    const postMap = new Map(posts.map((item) => [item.id, item]));
    const reelMap = new Map(reels.map((item) => [item.id, item]));
    const videoMap = new Map(videos.map((item) => [item.id, item]));

    const makeStream = (kind: 'post' | 'reel' | 'video', id: string): StreamUnit | null => {
      if (kind === 'post') {
        const post = postMap.get(id); if (!post) return null;
        return { key: `post:${id}`, kind, post, timestamp: timeValue(post.published_at || (post as any).created_at), rank: (post as CommunityPost & Ranked).feed_rank ?? 0 };
      }
      if (kind === 'reel') {
        const reel = reelMap.get(id); if (!reel) return null;
        return { key: `reel:${id}`, kind, reel, timestamp: timeValue((reel.content_items as any)?.published_at || reel.created_at), rank: (reel as Reel & Ranked).feed_rank ?? 0 };
      }
      const video = videoMap.get(id); if (!video) return null;
      return { key: `video:${id}`, kind, video, timestamp: timeValue((video.content_items as any)?.published_at || video.created_at), rank: (video as Video & Ranked).feed_rank ?? 0 };
    };

    const databasePlan = resource.data?.plan ?? [];
    if (databasePlan.length) {
      return databasePlan.flatMap<HomeFeedUnit>((row, index) => {
        if (row.unit_kind === 'stream' && ['post', 'reel', 'video'].includes(row.content_kind)) {
          const stream = makeStream(row.content_kind as 'post' | 'reel' | 'video', row.content_ids?.[0]);
          return stream ? [stream] : [];
        }
        if (row.unit_kind === 'section' && ['sermon', 'event', 'announcement'].includes(row.content_kind)) {
          return [{ key: `section:${row.content_kind}:${index}:${row.content_ids.join(':')}`, kind: 'section', contentKind: row.content_kind as SectionUnit['contentKind'], ids: row.content_ids }];
        }
        return [];
      });
    }

    // Safe preview fallback before the DB migration is promoted. It mirrors the database
    // cadence but is intentionally secondary; production ordering comes from Postgres.
    const stream = [
      ...posts.map((post) => makeStream('post', post.id)),
      ...reels.map((reel) => makeStream('reel', reel.id)),
      ...videos.map((video) => makeStream('video', video.id)),
    ].filter(Boolean) as StreamUnit[];
    stream.sort((a, b) => b.rank - a.rank || b.timestamp - a.timestamp);

    const sectionBatches: SectionUnit[] = [];
    const grouped = {
      announcement: chunks(announcements.map((item) => item.id), 6),
      event: chunks(events.map((item) => item.id), 6),
      sermon: chunks(sermons.map((item) => item.id), 6),
    };
    const depth = Math.max(grouped.announcement.length, grouped.event.length, grouped.sermon.length);
    for (let chunkIndex = 0; chunkIndex < depth; chunkIndex += 1) {
      (['announcement', 'event', 'sermon'] as const).forEach((contentKind) => {
        const ids = grouped[contentKind][chunkIndex];
        if (ids?.length) sectionBatches.push({ key: `fallback:${contentKind}:${chunkIndex}`, kind: 'section', contentKind, ids });
      });
    }

    const result: HomeFeedUnit[] = [];
    let sectionIndex = 0;
    stream.forEach((item, index) => {
      result.push(item);
      if ((index + 1) % 4 === 0 && sectionBatches[sectionIndex]) result.push(sectionBatches[sectionIndex++]);
    });
    while (sectionBatches[sectionIndex]) result.push(sectionBatches[sectionIndex++]);
    return result;
  }, [announcements, events, posts, reels, resource.data?.plan, sermons, videos]);

  const canEngage = mode === 'authenticated';
  const postRequestContext = 'public' as const;
  const reelWidth = Math.max(280, Math.min(width - spacing.md * 2, 520));

  const openGeneralComposer = (compose: 'post' | 'audio') => router.push({ pathname: '/general/community', params: { compose, intentId: String(Date.now()) } } as any);
  const openPost = (postId: string, focusComments = false) => router.push({ pathname: '/general/post/[id]', params: { id: postId, scope: 'general', ...(focusComments ? { focus: 'comments' } : {}) } } as any);

  const reactToPost = async (postId: string, reaction: string | null) => {
    if (!canEngage) { openPost(postId, true); return false; }
    try {
      await api.request('engagement', { method: 'POST', context: postRequestContext, body: JSON.stringify(reaction ? { action: 'react', contentId: postId, reaction } : { action: 'unreact', contentId: postId }) });
      resource.refresh(); return true;
    } catch { return false; }
  };

  const bookmarkPost = async (postId: string, currentlySaved: boolean) => {
    if (!canEngage) { openPost(postId); return false; }
    try {
      const result = await api.request<{ bookmarked: boolean }>('engagement', { method: 'POST', context: postRequestContext, body: JSON.stringify({ action: 'bookmark', contentId: postId }) });
      resource.refresh(); return result.bookmarked === !currentlySaved;
    } catch { return false; }
  };

  const renderSection = (unit: SectionUnit) => {
    const title = unit.contentKind === 'sermon' ? 'Sermons' : unit.contentKind === 'event' ? 'Events' : 'Announcements';
    const icon = unit.contentKind === 'sermon' ? 'book-outline' : unit.contentKind === 'event' ? 'calendar-outline' : 'megaphone-outline';
    const sermonMap = new Map(sermons.map((item) => [item.id, item]));
    const eventMap = new Map(events.map((item) => [item.id, item]));
    const announcementMap = new Map(announcements.map((item) => [item.id, item]));

    return (
      <View style={[styles.sectionShelf, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <View style={styles.sectionShelfHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon as any} size={17} color={colors.interactive} /></View>
            <View>
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>DISCOVER</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push((unit.contentKind === 'sermon' ? '/general/sermons' : unit.contentKind === 'event' ? '/general/events' : '/general/announcements') as any)}>
            <Text style={[styles.seeAll, { color: colors.interactive }]}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalContent}>
          {unit.ids.map((id) => {
            if (unit.contentKind === 'sermon') {
              const sermon = sermonMap.get(id); if (!sermon) return null;
              return <View key={id} style={styles.horizontalCard}><SermonCard sermon={sermon} onPress={() => router.push(`/general/sermon/${id}` as any)} /></View>;
            }
            if (unit.contentKind === 'event') {
              const event = eventMap.get(id); if (!event) return null;
              return <View key={id} style={styles.horizontalCard}><EventCard event={event} onPress={() => router.push(`/general/event/${id}` as any)} /></View>;
            }
            const announcement = announcementMap.get(id); if (!announcement) return null;
            return (
              <Pressable key={id} onPress={() => router.push('/general/announcements' as any)} style={[styles.announcementCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={[styles.announcementIcon, { backgroundColor: colors.primarySoft }]}><Icon name="megaphone-outline" size={18} color={colors.interactive} /></View>
                <Text style={[styles.announcementTitle, { color: colors.text }]} numberOfLines={2}>{announcement.title}</Text>
                <Text style={[styles.announcementBody, { color: colors.textSecondary }]} numberOfLines={4}>{announcement.body}</Text>
                {announcement.published_at ? <Text style={[styles.announcementDate, { color: colors.textMuted }]}>{new Date(announcement.published_at).toLocaleDateString()}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const listHeader = (
    <>
      {mode === 'authenticated' ? (
        <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.composerMainRow}>
            <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name ?? 'COT member'} size="sm" />
            <Pressable onPress={() => openGeneralComposer('post')} style={({ pressed }) => [styles.composerPrompt, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]}>
              <Text style={[styles.composerPromptText, { color: colors.textMuted }]}>Share with General COT…</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/general/studio')} style={({ pressed }) => [styles.composerMore, { backgroundColor: colors.primarySoft }, pressed && styles.iconPressed]}>
              <Icon name="add" size={21} color={colors.interactive} />
            </Pressable>
          </View>
          <View style={styles.composerActions}>
            <Pressable onPress={() => openGeneralComposer('post')} style={styles.composerAction}><Icon name="create-outline" size={16} color={colors.interactive} /><Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Post</Text></Pressable>
            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />
            <Pressable onPress={() => openGeneralComposer('audio')} style={styles.composerAction}><Icon name="mic-outline" size={16} color={colors.interactive} /><Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Voice</Text></Pressable>
            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />
            <Pressable onPress={() => router.push('/general/studio/reel')} style={styles.composerAction}><Icon name="flash-outline" size={16} color={colors.live} /><Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Reel</Text></Pressable>
            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />
            <Pressable onPress={() => router.push('/general/studio/video')} style={styles.composerAction}><Icon name="videocam-outline" size={16} color={colors.interactive} /><Text style={[styles.composerActionText, { color: colors.textSecondary }]}>Video</Text></Pressable>
          </View>
        </View>
      ) : null}
      {degradedSections.length ? (
        <Pressable onPress={resource.refresh} style={[styles.degradedBanner, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="alert-circle-outline" size={16} color={colors.textSecondary} /><Text style={[styles.degradedText, { color: colors.textSecondary }]}>Some items couldn’t load. Tap to retry.</Text><Icon name="refresh-outline" size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {activeStream ? <View style={styles.heroSection}><HeroLiveCard stream={activeStream} onPress={() => router.push(`/general/live/${activeStream.id}` as any)} /></View> : null}
      {feed.length ? (
        <View style={styles.timelineHeading}>
          <View><Text style={[styles.timelineEyebrow, { color: colors.interactive }]}>GENERAL HOME</Text><Text style={[styles.timelineTitle, { color: colors.text }]}>{rankingMode === 'personalized' ? 'For you' : 'Latest from COT'}</Text></View>
          <Pressable onPress={() => router.push('/general/explore')} style={styles.exploreLink}><Text style={[styles.exploreLinkText, { color: colors.interactive }]}>Explore</Text><Icon name="arrow-forward" size={14} color={colors.interactive} /></Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.homeHeader, { paddingTop: insets.top + spacing.xs, backgroundColor: colors.card, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.homeHeaderIdentity}>
          <View style={[styles.brandBadge, { backgroundColor: colors.cardElevated, borderColor: colors.borderSubtle }]}><BrandMark variant="header" size={28} /></View>
          <View style={styles.homeHeaderCopy}>
            <Pressable onPress={() => mode === 'authenticated' && router.push('/expressions')} disabled={mode !== 'authenticated'} style={styles.scopeTitleRow}>
              <Text style={[styles.scopeTitle, { color: colors.text }]} numberOfLines={1}>General COT</Text>{mode === 'authenticated' ? <Icon name="chevron-down" size={14} color={colors.textMuted} /> : null}
            </Pressable>
            <View style={styles.scopeMetaRow}><Icon name="globe-outline" size={11} color={colors.interactive} /><Text style={[styles.scopeMeta, { color: colors.textMuted }]} numberOfLines={1}>{organization?.name ?? 'City of Transformation'} · Public space</Text></View>
          </View>
        </View>
        <View style={styles.homeHeaderActions}>
          {mode === 'authenticated' ? <Pressable onPress={() => router.push('/general/notifications')} style={[styles.headerAction, { backgroundColor: colors.bgSecondary }]}><Icon name="notifications-outline" size={19} color={colors.text} /></Pressable> : null}
          <Pressable onPress={() => router.push('/general/tools')} style={[styles.headerAction, { backgroundColor: colors.primarySoft }]}><Icon name="grid-outline" size={18} color={colors.interactive} /></Pressable>
        </View>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.loadingContainer}><Skeleton height={190} borderRadius={radius.lg} /><Skeleton height={120} count={4} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<View style={styles.emptyHome}><EmptyState title="Your Home feed is ready" message="Published sermons, Reels, videos, live broadcasts and events will appear here." iconName="home-outline" /></View>}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 130 }}
          refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item }) => {
            if (item.kind === 'section') return renderSection(item);
            if (item.kind === 'post') return <View style={styles.feedCardWrap}><PostCard post={item.post} expressionName={item.post.expression?.name} canEngage={canEngage} allowExternalShare={item.post.visibility === 'public'} onPressAuthor={item.post.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.post.author!.username! } } as any) : undefined} onPress={() => openPost(item.post.id)} onReply={() => openPost(item.post.id, true)} onReact={canEngage ? (reaction) => reactToPost(item.post.id, reaction) : undefined} onBookmark={canEngage ? (currentlySaved) => bookmarkPost(item.post.id, currentlySaved) : undefined} style={styles.homePostCard} /></View>;
            if (item.kind === 'reel') return <View style={styles.feedCardWrap}><ReelCard reel={item.reel} width={reelWidth} commentContext="public" onPress={() => router.push({ pathname: '/general/reels', params: { reelId: item.reel.id } } as any)} onOpenComments={item.reel.content_items?.id ? () => router.push({ pathname: '/general/comments/[contentId]', params: { contentId: item.reel.content_items!.id } } as any) : undefined} /></View>;
            return <View style={styles.feedCardWrap}><VideoCard video={item.video} commentContext="public" onPress={() => router.push(`/general/watch/${item.video.id}` as any)} onPressCreator={item.video.content_items?.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.video.content_items!.author!.username! } } as any) : undefined} onOpenComments={item.video.content_items?.id ? () => router.push({ pathname: '/general/comments/[contentId]', params: { contentId: item.video.content_items!.id } } as any) : undefined} /></View>;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  homeHeader: { width: '100%', minHeight: 68, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
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
  composerCard: { width: '100%', maxWidth: 680, alignSelf: 'center', marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, gap: spacing.xs },
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
  sectionShelf: { width: '100%', maxWidth: 680, alignSelf: 'center', marginVertical: spacing.sm, borderWidth: 1, borderRadius: radius.xxl, paddingVertical: spacing.md },
  sectionShelfHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sectionEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900' },
  seeAll: { fontSize: 12, fontWeight: '800' },
  horizontalContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  horizontalCard: { width: 300, maxWidth: 300 },
  announcementCard: { width: 280, minHeight: 170, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  announcementIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  announcementTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  announcementBody: { fontSize: 12, lineHeight: 18 },
  announcementDate: { fontSize: 10.5, fontWeight: '600', marginTop: 'auto' },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  emptyHome: { paddingVertical: 56, paddingHorizontal: spacing.lg },
});

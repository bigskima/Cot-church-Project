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
import {
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
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Event, LiveStream, Reel, Sermon, SocialPost, Video } from '@/types/content';

type Announcement = { id: string; title: string; body: string; published_at?: string | null; created_at?: string | null };
type FeedPlanRow = {
  position: number | string;
  unit_kind: 'stream' | 'section';
  content_kind: 'post' | 'reel' | 'video' | 'sermon' | 'event' | 'announcement';
  content_ids: string[];
};
type CommunityPost = SocialPost & {
  likes_count?: number;
  comments_count?: number;
  viewer_reaction?: string | null;
  viewer_bookmarked?: boolean;
};
type PlaybackBatchEntry = {
  contentId: string;
  available: boolean;
  renditions?: Array<{ kind?: string; playbackUrl?: string; storagePath?: string }>;
  thumbnails?: Array<{ isPrimary?: boolean; playbackUrl?: string; storagePath?: string }>;
};
type ExpressionHomePayload = {
  organization: { id: string; name: string; slug?: string };
  expression?: { id: string; name: string; avatar_url?: string | null; banner_url?: string | null } | null;
  mode: 'general' | 'expression';
  streams: LiveStream[];
  posts: CommunityPost[];
  reels?: Reel[];
  sermons: Sermon[];
  videos?: Video[];
  events: Event[];
  degradedSections?: string[];
};
type StreamUnit =
  | { key: string; kind: 'post'; post: CommunityPost }
  | { key: string; kind: 'reel'; reel: Reel }
  | { key: string; kind: 'video'; video: Video };
type SectionUnit = { key: string; kind: 'section'; contentKind: 'sermon' | 'event' | 'announcement'; ids: string[] };
type HomeUnit = StreamUnit | SectionUnit;
type HomeResource = { payload: ExpressionHomePayload; plan: FeedPlanRow[]; announcements: Announcement[] };

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function QuickLink({ label, hint, icon, onPress }: { label: string; hint: string; icon: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
        <Icon name={icon as any} size={18} color={colors.interactive} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function ExpressionLayeredHomeExperience({ expressionId }: { expressionId: string }) {
  const { width } = useWindowDimensions();
  const { api, auth, context, mode } = useSession();
  const { colors } = useTheme();
  const membership = context?.expressions?.find((item) => item.id === expressionId && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const reelWidth = Math.max(300, Math.min(width - spacing.sm * 2, 680));

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (expressionId) params.set('expressionId', expressionId);
    return `home-feed?${params.toString()}`;
  }, [expressionId, organizationId]);

  const resource = useResource<HomeResource>(
    `expression:layered-home:${organizationId || 'none'}:${expressionId || 'none'}:${mode}`,
    async (signal) => {
      let payload = await api.request<ExpressionHomePayload>(query, { signal });
      const mediaItems = [...(payload.reels ?? []), ...(payload.videos ?? [])];
      const contentIds = [...new Set(mediaItems.map((item) => item.content_items?.id).filter(Boolean) as string[])];
      if (contentIds.length) {
        const settled = await Promise.allSettled(chunks(contentIds, 30).map((chunk) =>
          api.request<PlaybackBatchEntry[]>(`content-media?action=playback_batch&contentIds=${encodeURIComponent(chunk.join(','))}`, { signal }),
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
            },
          };
        };
        payload = { ...payload, reels: (payload.reels ?? []).map(hydrate), videos: (payload.videos ?? []).map(hydrate) };
      }

      let plan: FeedPlanRow[] = [];
      let announcements: Announcement[] = [];
      if (organizationId && expressionId) {
        try {
          const supabase = await getRuntimeSupabase(accessToken);
          const [planResult, announcementResult] = await Promise.all([
            supabase.rpc('home_feed_layer_plan', {
              target_organization_id: organizationId,
              target_expression_id: expressionId,
              stream_limit: 48,
              section_batch_size: 6,
              stream_items_between_sections: 4,
            }),
            supabase.from('announcements').select('id,title,body,published_at,created_at').eq('organization_id', organizationId).eq('branch_id', expressionId).eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false }).limit(36),
          ]);
          if (!planResult.error && Array.isArray(planResult.data)) plan = planResult.data as FeedPlanRow[];
          if (!announcementResult.error && Array.isArray(announcementResult.data)) announcements = announcementResult.data as Announcement[];
        } catch {
          // Draft preview fallback preserves the layered experience before migration promotion.
        }
      }
      return { payload, plan, announcements };
    },
  );

  const payload = resource.data?.payload;
  const expression = payload?.expression ?? (context?.expression?.id === expressionId ? context.expression : undefined) ?? membership;
  const streams = payload?.streams ?? [];
  const posts = payload?.posts ?? [];
  const reels = payload?.reels ?? [];
  const videos = payload?.videos ?? [];
  const sermons = payload?.sermons ?? [];
  const events = payload?.events ?? [];
  const announcements = resource.data?.announcements ?? [];
  const activeStream = streams.find((item) => item.status === 'live') ?? streams.find((item) => item.status === 'scheduled');

  const feed = useMemo<HomeUnit[]>(() => {
    const postMap = new Map(posts.map((item) => [item.id, item]));
    const reelMap = new Map(reels.map((item) => [item.id, item]));
    const videoMap = new Map(videos.map((item) => [item.id, item]));
    const plan = resource.data?.plan ?? [];
    if (plan.length) {
      return plan.flatMap<HomeUnit>((row, index) => {
        const id = row.content_ids?.[0];
        if (row.unit_kind === 'stream' && row.content_kind === 'post' && postMap.has(id)) return [{ key: `post:${id}`, kind: 'post', post: postMap.get(id)! }];
        if (row.unit_kind === 'stream' && row.content_kind === 'reel' && reelMap.has(id)) return [{ key: `reel:${id}`, kind: 'reel', reel: reelMap.get(id)! }];
        if (row.unit_kind === 'stream' && row.content_kind === 'video' && videoMap.has(id)) return [{ key: `video:${id}`, kind: 'video', video: videoMap.get(id)! }];
        if (row.unit_kind === 'section' && ['sermon', 'event', 'announcement'].includes(row.content_kind)) return [{ key: `section:${row.content_kind}:${index}:${row.content_ids.join(':')}`, kind: 'section', contentKind: row.content_kind as SectionUnit['contentKind'], ids: row.content_ids }];
        return [];
      });
    }

    const stream: StreamUnit[] = [
      ...posts.map((post) => ({ key: `post:${post.id}`, kind: 'post' as const, post })),
      ...reels.map((reel) => ({ key: `reel:${reel.id}`, kind: 'reel' as const, reel })),
      ...videos.map((video) => ({ key: `video:${video.id}`, kind: 'video' as const, video })),
    ];
    const sectionBatches: SectionUnit[] = [];
    const grouped = {
      announcement: chunks(announcements.map((item) => item.id), 6),
      event: chunks(events.map((item) => item.id), 6),
      sermon: chunks(sermons.map((item) => item.id), 6),
    };
    const depth = Math.max(grouped.announcement.length, grouped.event.length, grouped.sermon.length);
    for (let batch = 0; batch < depth; batch += 1) {
      (['announcement', 'event', 'sermon'] as const).forEach((contentKind) => {
        const ids = grouped[contentKind][batch];
        if (ids?.length) sectionBatches.push({ key: `fallback:${contentKind}:${batch}`, kind: 'section', contentKind, ids });
      });
    }
    const result: HomeUnit[] = [];
    let sectionIndex = 0;
    stream.forEach((item, index) => {
      result.push(item);
      if ((index + 1) % 4 === 0 && sectionBatches[sectionIndex]) result.push(sectionBatches[sectionIndex++]);
    });
    while (sectionBatches[sectionIndex]) result.push(sectionBatches[sectionIndex++]);
    return result;
  }, [announcements, events, posts, reels, resource.data?.plan, sermons, videos]);

  const renderSection = (unit: SectionUnit) => {
    const sermonMap = new Map(sermons.map((item) => [item.id, item]));
    const eventMap = new Map(events.map((item) => [item.id, item]));
    const announcementMap = new Map(announcements.map((item) => [item.id, item]));
    const title = unit.contentKind === 'sermon' ? 'Sermons' : unit.contentKind === 'event' ? 'Events' : 'Announcements';
    const icon = unit.contentKind === 'sermon' ? 'book-outline' : unit.contentKind === 'event' ? 'calendar-outline' : 'megaphone-outline';
    const destination = unit.contentKind === 'sermon' ? `/expressions/${expressionId}/sermons` : unit.contentKind === 'event' ? `/expressions/${expressionId}/events` : `/expressions/${expressionId}/announcements`;

    return (
      <View style={[styles.shelf, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <View style={styles.shelfHeader}>
          <View style={styles.shelfTitleRow}><View style={[styles.shelfIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon as any} size={17} color={colors.interactive} /></View><View><Text style={[styles.shelfEyebrow, { color: colors.interactive }]}>IN THIS EXPRESSION</Text><Text style={[styles.shelfTitle, { color: colors.text }]}>{title}</Text></View></View>
          <Pressable onPress={() => router.push(destination as any)}><Text style={[styles.seeAll, { color: colors.interactive }]}>See all</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalContent}>
          {unit.ids.map((id) => {
            if (unit.contentKind === 'sermon') {
              const sermon = sermonMap.get(id); if (!sermon) return null;
              return <View key={id} style={styles.horizontalCard}><SermonCard sermon={sermon} onPress={() => router.push(`/expressions/${expressionId}/sermons/${id}` as any)} /></View>;
            }
            if (unit.contentKind === 'event') {
              const event = eventMap.get(id); if (!event) return null;
              return <View key={id} style={styles.horizontalCard}><EventCard event={event} onPress={() => router.push(`/expressions/${expressionId}/event/${id}` as any)} /></View>;
            }
            const announcement = announcementMap.get(id); if (!announcement) return null;
            return <Pressable key={id} onPress={() => router.push(`/expressions/${expressionId}/announcements` as any)} style={[styles.announcementCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><View style={[styles.announcementIcon, { backgroundColor: colors.primarySoft }]}><Icon name="megaphone-outline" size={18} color={colors.interactive} /></View><Text style={[styles.announcementTitle, { color: colors.text }]} numberOfLines={2}>{announcement.title}</Text><Text style={[styles.announcementBody, { color: colors.textSecondary }]} numberOfLines={4}>{announcement.body}</Text></Pressable>;
          })}
        </ScrollView>
      </View>
    );
  };

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.quickSection}>
        <View style={styles.quickHeading}>
          <Text style={[styles.quickHeadingTitle, { color: colors.text }]}>Explore</Text>
        </View>
        <View style={styles.quickGrid}>
          <QuickLink label="Updates" hint="Important updates" icon="megaphone-outline" onPress={() => router.push(`/expressions/${expressionId}/announcements` as any)} />
          <QuickLink label="Prayer" hint="Pray together" icon="heart-outline" onPress={() => router.push(`/expressions/${expressionId}/prayer` as any)} />
          <QuickLink label="Events" hint="Gatherings" icon="calendar-outline" onPress={() => router.push(`/expressions/${expressionId}/events` as any)} />
          <QuickLink label="Join in" hint="Polls & giveaways" icon="chatbubbles-outline" onPress={() => router.push(`/expressions/${expressionId}/participate` as any)} />
          <QuickLink label="Groups" hint="Smaller circles" icon="people-circle-outline" onPress={() => router.push(`/expressions/${expressionId}/groups` as any)} />
          <QuickLink label="Chat" hint="Direct messages" icon="chatbubble-ellipses-outline" onPress={() => router.push(`/expressions/${expressionId}/chat` as any)} />
        </View>
      </View>

      {payload?.degradedSections?.length ? <Pressable onPress={resource.refresh} style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="alert-circle-outline" size={17} color={colors.textSecondary} /><Text style={[styles.noticeText, { color: colors.textSecondary }]}>Some Expression sections are still loading. Tap to retry.</Text><Icon name="refresh-outline" size={15} color={colors.textMuted} /></Pressable> : null}
      {activeStream ? <View style={styles.liveWrap}><HeroLiveCard stream={activeStream} onPress={() => router.push(`/expressions/${expressionId}/live/${activeStream.id}` as any)} /></View> : null}

      {feed.length ? <View style={styles.feedHeading}><Text style={[styles.feedTitle, { color: colors.text }]}>Latest</Text><Pressable onPress={() => router.push(`/expressions/${expressionId}/feed` as any)}><Text style={[styles.seeAll, { color: colors.interactive }]}>Full feed</Text></Pressable></View> : null}
    </View>
  );

  if (resource.loading && !resource.data) return <View style={[styles.stateWrap, { backgroundColor: colors.bg }]}><Skeleton height={180} borderRadius={radius.xl} /><Skeleton height={100} count={4} /></View>;
  if (resource.error && !resource.data) return <View style={[styles.stateWrap, { backgroundColor: colors.bg }]}><ResourceError message={resource.error} retry={resource.refresh} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={feed}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="This Expression Home is ready" message="Posts, Reels, videos, sermons, events, announcements, polls and giveaways will form focused layers as they are published." iconName="home-outline" />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        renderItem={({ item }) => {
          if (item.kind === 'section') return renderSection(item);
          if (item.kind === 'post') return <View style={styles.feedCard}><PostCard post={item.post} expressionName={expression?.name} canEngage={mode === 'authenticated'} allowExternalShare={false} onPress={() => router.push({ pathname: `/expressions/${expressionId}/post/[id]`, params: { id: item.post.id } } as any)} onReply={() => router.push({ pathname: `/expressions/${expressionId}/post/[id]`, params: { id: item.post.id, focus: 'comments' } } as any)} variant="feed" showContext={false} style={styles.homePostCard} /></View>;
          if (item.kind === 'reel') return <View style={styles.feedCard}><ReelCard reel={item.reel} width={reelWidth} variant="feed" commentContext="current" onPressCreator={item.reel.content_items?.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.reel.content_items!.author!.username! } } as any) : undefined} onPress={() => router.push({ pathname: `/expressions/${expressionId}/reels`, params: { reelId: item.reel.id } } as any)} onOpenComments={item.reel.content_items?.id ? () => router.push({ pathname: `/expressions/${expressionId}/comments/[contentId]`, params: { contentId: item.reel.content_items!.id } } as any) : undefined} /></View>;
          return <View style={styles.feedCard}><VideoCard video={item.video} variant="feed" commentContext="current" onPressCreator={item.video.content_items?.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.video.content_items!.author!.username! } } as any) : undefined} onPress={() => router.push(`/expressions/${expressionId}/videos/${item.video.id}` as any)} onOpenComments={item.video.content_items?.id ? () => router.push({ pathname: `/expressions/${expressionId}/comments/[contentId]`, params: { contentId: item.video.content_items!.id } } as any) : undefined} /></View>;
        }}
        />
      {mode === 'authenticated' ? (
        <Pressable
          onPress={() => router.push({ pathname: `/expressions/${expressionId}/feed`, params: { compose: 'post', intentId: String(Date.now()) } } as any)}
          accessibilityRole="button"
          accessibilityLabel="Create"
          style={({ pressed }) => [styles.createFab, { backgroundColor: colors.interactive }, pressed && styles.createFabPressed]}
        >
          <Icon name="add" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 1060, alignSelf: 'center', paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.sm },
  stateWrap: { flex: 1, padding: spacing.lg, gap: spacing.md },
  headerWrap: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  quickSection: { gap: 6 },
  quickHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 },
  quickHeadingTitle: { fontSize: 12.5, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, paddingHorizontal: 2, paddingBottom: 2 },
  quickLink: { width: '25%', minHeight: 64, alignItems: 'center', gap: 5, paddingHorizontal: 3 },
  quickIcon: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 9.5, fontWeight: '800' },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  liveWrap: { marginTop: spacing.xs },
  feedHeading: { marginTop: spacing.md, marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  feedTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  feedCard: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingVertical: spacing.xs },
  homePostCard: { marginHorizontal: 0, marginVertical: 0, borderRadius: 0 },
  createFab: { position: 'absolute', right: 18, bottom: 24, zIndex: 30, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', ...shadows.floating },
  createFabPressed: { opacity: 0.82, transform: [{ scale: 0.95 }] },
  shelf: { borderWidth: 1, borderRadius: radius.xl, paddingVertical: spacing.md, marginVertical: 7 },
  shelfHeader: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  shelfTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shelfIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shelfEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  shelfTitle: { fontSize: 16, fontWeight: '900', marginTop: 1 },
  seeAll: { fontSize: 11, fontWeight: '800' },
  horizontalContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  horizontalCard: { width: 285 },
  announcementCard: { width: 260, minHeight: 168, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  announcementIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  announcementTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  announcementBody: { fontSize: 11.5, lineHeight: 17 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});

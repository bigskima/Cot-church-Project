import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { GeneralTopBar } from './GeneralTopBar';
import { GeneralHomeActionDeck } from './GeneralHomeActionDeck';
import { GeneralHomeSpotlightCarousel } from './GeneralHomeSpotlightCarousel';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Event, LiveStream, Reel, Sermon, SocialPost, Video } from '@/types/content';
import { useFeatureControls } from '@/features/availability/useFeatureControls';

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

type Announcement = { id: string; title: string; body: string; published_at?: string | null; created_at?: string | null };
type FeedPlanRow = { position: number | string; unit_kind: 'stream' | 'section'; content_kind: 'post' | 'reel' | 'video' | 'sermon' | 'event' | 'announcement'; content_ids: string[]; newest_at?: string | null; score?: number | string | null };
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
type PlaybackBatchEntry = { contentId: string; available: boolean; renditions?: Array<{ kind?: string; playbackUrl?: string; storagePath?: string }>; thumbnails?: Array<{ isPrimary?: boolean; playbackUrl?: string; storagePath?: string }> };
type StreamUnit =
  | { key: string; kind: 'post'; post: CommunityPost & Ranked; timestamp: number; rank: number }
  | { key: string; kind: 'reel'; reel: Reel & Ranked; timestamp: number; rank: number }
  | { key: string; kind: 'video'; video: Video & Ranked; timestamp: number; rank: number };
type SectionUnit = { key: string; kind: 'section'; contentKind: 'sermon' | 'event' | 'announcement'; ids: string[] };
type HomeFeedUnit = StreamUnit | SectionUnit;
type HomeResource = { payload: HomePayload; plan: FeedPlanRow[]; announcements: Announcement[] };

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

function FeedSectionHeading({ eyebrow, title, subtitle, actionLabel, onAction }: { eyebrow: string; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.feedHeading}>
      <View style={styles.flex}>
        <Text style={[styles.feedEyebrow, { color: colors.interactive }]}>{eyebrow}</Text>
        <Text style={[styles.feedTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.feedSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? <Pressable onPress={onAction} style={({ pressed }) => [styles.headingAction, pressed && styles.pressed]}><Text style={[styles.headingActionText, { color: colors.interactive }]}>{actionLabel}</Text><Icon name="arrow-forward" size={14} color={colors.interactive} /></Pressable> : null}
    </View>
  );
}

export default function GeneralHomeExperience() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { api, auth, context, mode, hasOrganizationCapability, hasPublicCapability } = useSession();
  const { colors } = useTheme();
  const contextOrganization = context?.organization ?? context?.organizations?.[0];
  const organizationId = contextOrganization?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const controls = useFeatureControls({ organizationId });
  const accessToken = auth?.session.accessToken ?? null;
  const authenticated = mode === 'authenticated';
  const wide = width >= 820;
  const contentWidth = Math.min(Math.max(width - spacing.sm * 2, 300), 1120);
  const reelWidth = Math.max(300, Math.min(wide ? 720 : contentWidth, 720));

  const canManageAny = authenticated && (
    hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage') ||
    hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update') ||
    hasOrganizationCapability('announcements.manage') || hasOrganizationCapability('polls.manage') ||
    hasOrganizationCapability('giving.campaigns.manage') || hasOrganizationCapability('giving.finance.read') ||
    hasOrganizationCapability('organization.leadership.manage') || hasOrganizationCapability('prayer.moderate') ||
    hasOrganizationCapability('pastoral.followups.receive') || hasPublicCapability('public.live_stream.create')
  );

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    const suffix = params.toString();
    return `home-feed${suffix ? `?${suffix}` : ''}`;
  }, [organizationId]);

  const resource = useResource<HomeResource>(`mobile:general-home-v2:${organizationId || 'auto'}:${mode}`, async (signal) => {
    const freshQuery = `${query}${query.includes('?') ? '&' : '?'}fresh=${Date.now()}`;
    let payload = await api.request<HomePayload>(freshQuery, { signal, context: 'public' });
    const mediaItems = [...(payload.reels ?? []), ...(payload.videos ?? [])];
    const contentIds = [...new Set(mediaItems.map((item) => item.content_items?.id).filter(Boolean) as string[])];

    if (contentIds.length) {
      const settled = await Promise.allSettled(chunks(contentIds, 30).map((chunk) => api.request<PlaybackBatchEntry[]>(`content-media?action=playback_batch&contentIds=${encodeURIComponent(chunk.join(','))}`, { signal, context: 'public' })));
      const playback = new Map<string, PlaybackBatchEntry>();
      settled.forEach((result) => { if (result.status === 'fulfilled') result.value.forEach((item) => playback.set(item.contentId, item)); });
      const hydrate = <T extends Reel | Video>(item: T): T => {
        const prepared = item.content_items?.id ? playback.get(item.content_items.id) : undefined;
        const stream = prepared?.renditions?.find((rendition) => rendition.kind === 'video_stream');
        const thumbnail = prepared?.thumbnails?.find((candidate) => candidate.isPrimary) ?? prepared?.thumbnails?.[0];
        if (!stream?.playbackUrl && !thumbnail?.playbackUrl) return item;
        return {
          ...item,
          media_assets: {
            ...(item.media_assets ?? {}),
            ...(stream?.playbackUrl ? { url: stream.playbackUrl } : {}),
            ...(thumbnail?.playbackUrl ? { thumbnailUrl: thumbnail.playbackUrl } : {}),
            renditions: (item.media_assets?.renditions ?? []).map((rendition) => rendition.rendition_kind === 'video_stream' && stream?.playbackUrl ? { ...rendition, playbackUrl: stream.playbackUrl } : rendition),
          },
        };
      };
      payload = { ...payload, reels: (payload.reels ?? []).map(hydrate), videos: (payload.videos ?? []).map(hydrate) };
    }

    let plan: FeedPlanRow[] = [];
    let announcements: Announcement[] = [];
    if (organizationId) {
      try {
        const supabase = await getRuntimeSupabase(accessToken);
        const [planResult, announcementResult] = await Promise.all([
          supabase.rpc('home_feed_layer_plan', { target_organization_id: organizationId, target_expression_id: null, stream_limit: 48, section_batch_size: 6, stream_items_between_sections: 4 }),
          authenticated
            ? supabase.from('announcements').select('id,title,body,published_at,created_at').eq('organization_id', organizationId).is('branch_id', null).eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false }).limit(36)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (!planResult.error && Array.isArray(planResult.data)) plan = planResult.data as FeedPlanRow[];
        if (!announcementResult.error && Array.isArray(announcementResult.data)) announcements = announcementResult.data as Announcement[];
      } catch {
        // Edge data remains the fallback when a preview does not expose direct database reads.
      }
    }
    return { payload, plan, announcements };
  });

  const lastForegroundRefresh = useRef(0);

  const refreshHome = useCallback(() => {
    // Refresh Home itself and invalidate the independently loaded shelves/strip so
    // a pull-to-refresh represents the entire visible Home, not only the main feed.
    invalidate('general-home-context-drawer:');
    invalidate('general-home-notice');
    invalidate('participation:home:general');
    resource.refresh();
  }, [resource.refresh]);

  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastForegroundRefresh.current > 12_000) {
      lastForegroundRefresh.current = now;
      refreshHome();
    }
  }, [refreshHome]));

  useEffect(() => {
    if (!organizationId) return;
    let disposed = false;
    let channel: ReturnType<Awaited<ReturnType<typeof getRuntimeSupabase>>['channel']> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleFreshRead = () => {
      if (disposed) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!disposed) refreshHome();
      }, 350);
    };

    void getRuntimeSupabase(accessToken).then((supabase) => {
      if (disposed) return;
      channel = supabase.channel(`general-home-live:${organizationId}`);
      const realtimeTables = ['social_posts', 'content_items', 'reels', 'videos', 'live_streams', 'events', 'sermons'] as const;
      realtimeTables.forEach((table) => {
        channel?.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` },
          scheduleFreshRead,
        );
      });
      channel.subscribe();
    }).catch(() => {
      // Pull-to-refresh/focus refresh remain the fallback when Realtime is unavailable.
    });

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel) void channel.unsubscribe();
    };
  }, [accessToken, organizationId, refreshHome]);

  const payload = resource.data?.payload;
  const organization = payload?.organization ?? contextOrganization;
  const communityAvailable = controls.isEnabled('social_community_feed');
  const streams = controls.isEnabled('live_streaming') && controls.isEnabled('general_live') ? (payload?.streams ?? []) : [];
  const posts = communityAvailable ? (payload?.posts ?? []) : [];
  const reels = communityAvailable && controls.isEnabled('reels') ? (payload?.reels ?? []) : [];
  const videos = communityAvailable && controls.isEnabled('long_form_video') ? (payload?.videos ?? []) : [];
  const sermons = controls.isEnabled('sermons') ? (payload?.sermons ?? []) : [];
  const events = controls.isEnabled('events_gatherings') ? (payload?.events ?? []) : [];
  const announcements = controls.isEnabled('announcements') ? (resource.data?.announcements ?? []) : [];
  const degradedSections = payload?.degradedSections ?? [];
  const rankingMode = (resource.data?.plan?.length ?? 0) > 0 || payload?.rankingMode === 'personalized' ? 'personalized' : 'recent';
  const activeStream = useMemo(
    () => streams.find((stream) => stream.status === 'live') ?? streams.find((stream) => stream.status === 'scheduled'),
    [streams],
  );

  const feed = useMemo<HomeFeedUnit[]>(() => {
    const postMap = new Map(posts.map((item) => [item.id, item]));
    const reelMap = new Map(reels.map((item) => [item.id, item]));
    const videoMap = new Map(videos.map((item) => [item.id, item]));
    const makeStream = (kind: 'post' | 'reel' | 'video', id: string): StreamUnit | null => {
      if (kind === 'post') { const post = postMap.get(id); return post ? { key: `post:${id}`, kind, post, timestamp: timeValue(post.published_at || (post as any).created_at), rank: (post as CommunityPost & Ranked).feed_rank ?? 0 } : null; }
      if (kind === 'reel') { const reel = reelMap.get(id); return reel ? { key: `reel:${id}`, kind, reel, timestamp: timeValue((reel.content_items as any)?.published_at || reel.created_at), rank: (reel as Reel & Ranked).feed_rank ?? 0 } : null; }
      const video = videoMap.get(id); return video ? { key: `video:${id}`, kind, video, timestamp: timeValue((video.content_items as any)?.published_at || video.created_at), rank: (video as Video & Ranked).feed_rank ?? 0 } : null;
    };

    const databasePlan = resource.data?.plan ?? [];
    if (databasePlan.length) {
      return databasePlan.flatMap<HomeFeedUnit>((row, index) => {
        if (row.unit_kind === 'stream' && ['post', 'reel', 'video'].includes(row.content_kind)) {
          const stream = makeStream(row.content_kind as 'post' | 'reel' | 'video', row.content_ids?.[0]);
          return stream ? [stream] : [];
        }
        if (row.unit_kind === 'section' && ['sermon', 'event', 'announcement'].includes(row.content_kind)) return [{ key: `section:${row.content_kind}:${index}:${row.content_ids.join(':')}`, kind: 'section', contentKind: row.content_kind as SectionUnit['contentKind'], ids: row.content_ids }];
        return [];
      });
    }

    const stream = [...posts.map((post) => makeStream('post', post.id)), ...reels.map((reel) => makeStream('reel', reel.id)), ...videos.map((video) => makeStream('video', video.id))].filter(Boolean) as StreamUnit[];
    stream.sort((a, b) => b.rank - a.rank || b.timestamp - a.timestamp);
    const sectionBatches: SectionUnit[] = [];
    const grouped = { announcement: chunks(announcements.map((item) => item.id), 6), event: chunks(events.map((item) => item.id), 6), sermon: chunks(sermons.map((item) => item.id), 6) };
    const depth = Math.max(grouped.announcement.length, grouped.event.length, grouped.sermon.length);
    for (let chunkIndex = 0; chunkIndex < depth; chunkIndex += 1) {
      (['announcement', 'event', 'sermon'] as const).forEach((contentKind) => { const ids = grouped[contentKind][chunkIndex]; if (ids?.length) sectionBatches.push({ key: `fallback:${contentKind}:${chunkIndex}`, kind: 'section', contentKind, ids }); });
    }
    const result: HomeFeedUnit[] = [];
    let sectionIndex = 0;
    stream.forEach((item, index) => { result.push(item); if ((index + 1) % 4 === 0 && sectionBatches[sectionIndex]) result.push(sectionBatches[sectionIndex++]); });
    while (sectionBatches[sectionIndex]) result.push(sectionBatches[sectionIndex++]);
    return result;
  }, [announcements, events, posts, reels, resource.data?.plan, sermons, videos]);

  const openGeneralComposer = (compose: 'post' | 'audio') => router.push({ pathname: '/general/community', params: { compose, intentId: String(Date.now()) } } as any);
  const openPost = (postId: string, focusComments = false) => router.push({ pathname: '/general/post/[id]', params: { id: postId, scope: 'general', ...(focusComments ? { focus: 'comments' } : {}) } } as any);

  const reactToPost = async (postId: string, reaction: string | null) => {
    if (!authenticated) { openPost(postId, true); return false; }
    try { await api.request('engagement', { method: 'POST', context: 'public', body: JSON.stringify(reaction ? { action: 'react', contentId: postId, reaction } : { action: 'unreact', contentId: postId }) }); return true; } catch { return false; }
  };
  const bookmarkPost = async (postId: string, currentlySaved: boolean) => {
    if (!authenticated) { openPost(postId); return false; }
    try { const result = await api.request<{ bookmarked: boolean }>('engagement', { method: 'POST', context: 'public', body: JSON.stringify({ action: 'bookmark', contentId: postId }) }); return result.bookmarked === !currentlySaved; } catch { return false; }
  };

  const renderSection = (unit: SectionUnit) => {
    const sermonMap = new Map(sermons.map((item) => [item.id, item]));
    const eventMap = new Map(events.map((item) => [item.id, item]));
    const announcementMap = new Map(announcements.map((item) => [item.id, item]));
    const config = unit.contentKind === 'sermon'
      ? { eyebrow: 'WATCH · LISTEN · STUDY', title: 'Messages for the week', subtitle: 'Sermons presented as focused discovery, not another feed.', action: '/general/sermons', icon: 'book-outline' }
      : unit.contentKind === 'event'
        ? { eyebrow: 'GATHER', title: 'Coming up', subtitle: 'See what is happening and move straight into the event.', action: '/general/events', icon: 'calendar-outline' }
        : { eyebrow: 'IMPORTANT', title: 'Announcements', subtitle: 'Church-wide updates without burying them in the timeline.', action: '/general/announcements', icon: 'megaphone-outline' };

    return (
      <View style={[styles.discoverySection, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <View style={styles.discoveryHeadingRow}>
          <View style={[styles.discoveryIcon, { backgroundColor: colors.primarySoft }]}><Icon name={config.icon as any} size={18} color={colors.interactive} /></View>
          <View style={styles.flex}><Text style={[styles.discoveryEyebrow, { color: colors.interactive }]}>{config.eyebrow}</Text><Text style={[styles.discoveryTitle, { color: colors.text }]}>{config.title}</Text><Text style={[styles.discoverySubtitle, { color: colors.textMuted }]}>{config.subtitle}</Text></View>
          <Pressable onPress={() => router.push(config.action as any)} style={({ pressed }) => [styles.viewAllButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><Text style={[styles.viewAllText, { color: colors.text }]}>View all</Text><Icon name="arrow-forward" size={14} color={colors.interactive} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalContent}>
          {unit.ids.map((id) => {
            if (unit.contentKind === 'sermon') { const sermon = sermonMap.get(id); return sermon ? <View key={id} style={styles.discoveryCardWidth}><SermonCard sermon={sermon} variant="discovery" onPress={() => router.push(`/general/sermon/${sermon.id}` as any)} /></View> : null; }
            if (unit.contentKind === 'event') { const event = eventMap.get(id); return event ? <View key={id} style={styles.discoveryCardWidth}><EventCard event={event} variant="discovery" onPress={() => router.push(`/general/event/${id}` as any)} /></View> : null; }
            const announcement = announcementMap.get(id); if (!announcement) return null;
            return (
              <Pressable key={id} onPress={() => router.push('/general/announcements' as any)} style={({ pressed }) => [styles.announcementCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}>
                <View style={styles.announcementTop}><View style={[styles.announcementIcon, { backgroundColor: colors.primarySoft }]}><Icon name="megaphone-outline" size={17} color={colors.interactive} /></View>{announcement.published_at ? <Text style={[styles.announcementDate, { color: colors.textMuted }]}>{new Date(announcement.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text> : null}</View>
                <Text style={[styles.announcementTitle, { color: colors.text }]} numberOfLines={2}>{announcement.title}</Text>
                <Text style={[styles.announcementBody, { color: colors.textSecondary }]} numberOfLines={4}>{announcement.body}</Text>
                <View style={styles.announcementFooter}><Text style={[styles.announcementLink, { color: colors.interactive }]}>Read update</Text><Icon name="arrow-forward" size={14} color={colors.interactive} /></View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const header = (
    <View style={[styles.headerContent, { width: contentWidth }]}>
      <GeneralHomeActionDeck />
      <GeneralHomeSpotlightCarousel />

      {degradedSections.length ? <Pressable onPress={refreshHome} style={[styles.degradedBanner, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={[styles.degradedIcon, { backgroundColor: colors.card }]}><Icon name="refresh-outline" size={16} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.degradedTitle, { color: colors.text }]}>A few sections need another try</Text><Text style={[styles.degradedText, { color: colors.textMuted }]}>Your Home remains usable. Tap here to refresh only the missing pieces.</Text></View></Pressable> : null}
      {activeStream ? <View style={styles.liveSection}><FeedSectionHeading eyebrow={activeStream.status === 'live' ? 'LIVE NOW' : 'NEXT LIVE'} title={activeStream.status === 'live' ? 'Join what is happening now' : 'Coming up live'} subtitle="Open the broadcast without leaving Home discovery." actionLabel="Live" onAction={() => router.push('/general/live' as any)} /><HeroLiveCard stream={activeStream} onPress={() => router.push(`/general/live/${activeStream.id}` as any)} /></View> : null}

      {feed.length ? <FeedSectionHeading eyebrow="COMMUNITY FEED" title={rankingMode === 'personalized' ? 'For you' : 'Latest from COT'} actionLabel="Discover" onAction={() => router.push('/general/explore')} /> : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <GeneralTopBar organizationName={organization?.name} authenticated={authenticated} avatarUrl={context?.profile?.avatar_url} displayName={context?.profile?.display_name} canManage={canManageAny} />
      {resource.loading && !resource.data ? (
        <View style={[styles.loadingContainer, { width: contentWidth }]}><Skeleton height={220} borderRadius={radius.xxl} /><Skeleton height={74} count={4} /><Skeleton height={180} count={2} /></View>
      ) : resource.error && !resource.data ? (
        <View style={[styles.errorWrap, { width: contentWidth }]}><ResourceError message={resource.error} retry={refreshHome} /></View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListEmptyComponent={<View style={[styles.emptyHome, { width: contentWidth }]}><EmptyState title="General COT is ready" message="Sermons, events, media and community activity will form focused sections here as they are published." iconName="home-outline" /></View>}
          contentContainerStyle={{ paddingBottom: insets.bottom + 132 }}
          refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={refreshHome} tintColor={colors.interactive} colors={[colors.interactive]} progressBackgroundColor={colors.card} />}
          renderItem={({ item }) => {
            if (item.kind === 'section') return <View style={[styles.fullWidthItem, { width: contentWidth }]}>{renderSection(item)}</View>;
            if (item.kind === 'post') return <View style={[styles.timelineItem, { width: Math.min(contentWidth, 920) }]}><PostCard post={item.post} expressionName={item.post.expression?.name} canEngage={authenticated} allowExternalShare={item.post.visibility === 'public'} onPressAuthor={item.post.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.post.author!.username! } } as any) : undefined} onPress={() => openPost(item.post.id)} onReply={controls.isEnabled('comments') ? () => openPost(item.post.id, true) : undefined} onReact={authenticated && controls.isEnabled('reactions') ? (reaction) => reactToPost(item.post.id, reaction) : undefined} onBookmark={authenticated && controls.isEnabled('bookmarks') ? (currentlySaved) => bookmarkPost(item.post.id, currentlySaved) : undefined} variant="feed" showContext={false} style={styles.homePostCard} /></View>;
            if (item.kind === 'reel') return <View style={[styles.timelineItem, { width: Math.min(contentWidth, 920) }]}><ReelCard reel={item.reel} width={reelWidth} variant="feed" commentContext="public" onPressCreator={item.reel.content_items?.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.reel.content_items!.author!.username! } } as any) : undefined} onPress={() => router.push({ pathname: '/general/reels', params: { reelId: item.reel.id } } as any)} onOpenComments={item.reel.content_items?.id ? () => router.push({ pathname: '/general/comments/[contentId]', params: { contentId: item.reel.content_items!.id } } as any) : undefined} /></View>;
            return <View style={[styles.timelineItem, { width: Math.min(contentWidth, 920) }]}><VideoCard video={item.video} variant="feed" commentContext="public" onPress={() => router.push(`/general/watch/${item.video.id}` as any)} onPressCreator={item.video.content_items?.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.video.content_items!.author!.username! } } as any) : undefined} onOpenComments={item.video.content_items?.id ? () => router.push({ pathname: '/general/comments/[contentId]', params: { contentId: item.video.content_items!.id } } as any) : undefined} /></View>;
          }}
        />
      )}

      {authenticated ? (
        <Pressable
          onPress={() => openGeneralComposer('post')}
          accessibilityRole="button"
          accessibilityLabel="Create"
          style={({ pressed }) => [
            styles.createFab,
            { bottom: insets.bottom + 88, backgroundColor: colors.interactive },
            pressed && styles.createFabPressed,
          ]}
        >
          <Icon name="add" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1, minWidth: 0 },
  headerContent: { alignSelf: 'center', paddingTop: spacing.sm, gap: spacing.md },
  loadingContainer: { alignSelf: 'center', paddingTop: spacing.md, gap: spacing.md },
  errorWrap: { alignSelf: 'center', paddingTop: spacing.xl },
  fullWidthItem: { alignSelf: 'center', marginTop: spacing.md },
  timelineItem: { alignSelf: 'center', marginTop: spacing.sm },
  homePostCard: { marginHorizontal: 0, marginVertical: 0, borderRadius: 0 },
  createFab: { position: 'absolute', right: 18, zIndex: 30, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', ...shadows.floating },
  createFabPressed: { opacity: 0.82, transform: [{ scale: 0.95 }] },
  feedHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingTop: 2, paddingBottom: 0 },
  feedEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.05 },
  feedTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  feedSubtitle: { fontSize: 11.5, lineHeight: 17, marginTop: 3, maxWidth: 600 },
  headingAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 }, headingActionText: { fontSize: 10.5, fontWeight: '900' },
  degradedBanner: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, degradedIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, degradedTitle: { fontSize: 12.5, fontWeight: '900' }, degradedText: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  liveSection: { gap: spacing.sm },
  discoverySection: { borderWidth: 1, borderRadius: radius.xxl, paddingVertical: spacing.lg, overflow: 'hidden' },
  discoveryHeadingRow: { paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  discoveryIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  discoveryEyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.95 }, discoveryTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 }, discoverySubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 2, maxWidth: 520 },
  viewAllButton: { minHeight: 38, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5 }, viewAllText: { fontSize: 10.5, fontWeight: '800' },
  horizontalContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, paddingBottom: 2 }, discoveryCardWidth: { width: 280 },
  announcementCard: { width: 270, minHeight: 190, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, announcementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, announcementIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, announcementDate: { fontSize: 9.5, fontWeight: '700' }, announcementTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900', letterSpacing: -0.25 }, announcementBody: { fontSize: 11.5, lineHeight: 17 }, announcementFooter: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }, announcementLink: { fontSize: 10.5, fontWeight: '900' },
  emptyHome: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});

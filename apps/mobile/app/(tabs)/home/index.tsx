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
  EmptyState,
  EventCard,
  HeroLiveCard,
  Icon,
  ReelCard,
  ResourceError,
  SermonCard,
  Skeleton,
  StoriesTray,
  VideoCard,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Event, LiveStream, Reel, Sermon, Video } from '@/types/content';

interface HomePayload {
  organization: { id: string; name: string; slug?: string };
  expression?: { id: string; name: string } | null;
  mode: 'general' | 'expression';
  streams: LiveStream[];
  reels: Reel[];
  sermons: Sermon[];
  videos: Video[];
  events: Event[];
  degradedSections?: string[];
  rankingMode?: 'personalized' | 'recent' | 'expression';
}

type Ranked = { feed_rank?: number; feed_reason?: 'following' | 'continue' | 'popular' | 'recent' };
type HomeFeedUnit =
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
  const { api, context, mode, hasCapability } = useSession();
  const { colors } = useTheme();

  const hasAnyLeadershipCapability = Boolean(context?.expression?.id) && (
    hasCapability('posts.create') ||
    hasCapability('reels.create') ||
    hasCapability('videos.create') ||
    hasCapability('streams.broadcast') ||
    hasCapability('sermons.create') ||
    hasCapability('studio.access') ||
    hasCapability('*')
  );

  const contextOrganization = context?.organization ?? context?.organizations?.[0];
  const contextExpression = context?.expression;
  const organizationId = contextOrganization?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (contextExpression?.id) params.set('expressionId', contextExpression.id);
    const suffix = params.toString();
    return `home-feed${suffix ? `?${suffix}` : ''}`;
  }, [organizationId, contextExpression?.id]);

  const resourceKey = `mobile:home-feed:${organizationId || 'auto'}:${contextExpression?.id ?? 'general'}:${mode}`;
  const resource = useResource<HomePayload>(resourceKey, (signal) => api.request<HomePayload>(query, { signal }));

  const organization = resource.data?.organization ?? contextOrganization;
  const expression = resource.data?.expression ?? contextExpression;
  const streams = resource.data?.streams ?? [];
  const reels = resource.data?.reels ?? [];
  const videos = resource.data?.videos ?? [];
  const sermons = resource.data?.sermons ?? [];
  const events = resource.data?.events ?? [];
  const degradedSections = resource.data?.degradedSections ?? [];
  const rankingMode = resource.data?.rankingMode ?? (expression?.id ? 'expression' : 'recent');

  const activeStream = useMemo(
    () => streams.find((stream) => stream.status === 'live') ?? streams.find((stream) => stream.status === 'scheduled'),
    [streams],
  );

  const feed = useMemo<HomeFeedUnit[]>(() => {
    const units: HomeFeedUnit[] = [
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
  }, [reels, videos, sermons, events]);

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
        onPress: () => router.push(`/(tabs)/live/${activeStream.id}` as any),
      });
    }

    reels.slice(0, 6).forEach((reel) => {
      list.push({
        id: `reel:${reel.id}`,
        title: reel.caption ? reel.caption.slice(0, 12) : 'Reel',
        imageUrl: reel.media_assets?.thumbnailUrl,
        isLive: false,
        hasUnseen: false,
        onPress: () => router.push('/reels'),
      });
    });
    return list;
  }, [activeStream, reels]);

  const canEngage = mode === 'authenticated';
  const reelWidth = Math.max(260, Math.min(width - spacing.lg * 2, 460));

  const listHeader = (
    <>
      {mode === 'authenticated' && !expression?.id ? (
        <View style={[styles.publicNotice, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <Icon name="globe-outline" size={17} color={colors.interactive} />
          <View style={styles.noticeCopy}>
            <Text style={[styles.publicNoticeTitle, { color: colors.text }]}>Public COT Home</Text>
            <Text style={[styles.publicNoticeText, { color: colors.textSecondary }]}>You’re in the public COT space. Enter an Expression when you want its private community.</Text>
            <Pressable onPress={() => router.push('/expressions')} accessibilityRole="button" style={[styles.expressionAction, { borderColor: colors.interactive }]}>
              <Text style={[styles.expressionActionText, { color: colors.interactive }]}>Join or enter an Expression</Text>
              <Icon name="arrow-forward" size={14} color={colors.interactive} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {mode === 'authenticated' && expression?.id ? (
        <View style={[styles.expressionNotice, { backgroundColor: colors.card, borderColor: colors.primarySoftStrong }, shadows.sm]}>
          <Icon name="people" size={17} color={colors.interactive} />
          <View style={styles.noticeCopy}>
            <Text style={[styles.publicNoticeTitle, { color: colors.text }]}>Expression Space · {expression.name}</Text>
            <Text style={[styles.publicNoticeText, { color: colors.textSecondary }]}>You’re inside this Expression. Switch spaces anytime from Expressions.</Text>
          </View>
          <Pressable onPress={() => router.push('/expressions')} accessibilityRole="button" accessibilityLabel="Change or leave Expression" hitSlop={8}>
            <Icon name="swap-horizontal" size={20} color={colors.interactive} />
          </Pressable>
        </View>
      ) : null}

      {degradedSections.length ? (
        <View style={[styles.degradedBanner, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="alert-circle-outline" size={17} color={colors.textSecondary} />
          <Text style={[styles.degradedText, { color: colors.textSecondary }]}>Some Home content is temporarily unavailable: {degradedSections.join(', ')}. The rest of Home is still available.</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push('/(tabs)/community')}
        accessibilityRole="button"
        accessibilityLabel="Open Community"
        style={({ pressed }) => [
          styles.communityShortcut,
          { backgroundColor: colors.card, borderColor: colors.borderSubtle },
          shadows.sm,
          pressed && styles.shortcutPressed,
        ]}
      >
        <View style={[styles.communityShortcutIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="chatbubbles-outline" size={19} color={colors.interactive} />
        </View>
        <View style={styles.noticeCopy}>
          <Text style={[styles.publicNoticeTitle, { color: colors.text }]}>Community conversations</Text>
          <Text style={[styles.publicNoticeText, { color: colors.textSecondary }]}>Public social posts and Expression conversations live in Community.</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      {stories.length ? <StoriesTray stories={stories} /> : null}

      {activeStream ? (
        <View style={styles.heroSection}>
          <HeroLiveCard stream={activeStream} onPress={() => router.push(`/(tabs)/live/${activeStream.id}` as any)} />
        </View>
      ) : null}

      {feed.length ? (
        <View style={styles.timelineHeading}>
          <Text style={[styles.timelineTitle, { color: colors.text }]}>{expression?.name ? `${expression.name} Home` : rankingMode === 'personalized' ? 'For You' : 'Latest from COT'}</Text>
          <Text style={[styles.timelineSubtitle, { color: colors.textMuted }]}>Live, sermons, Reels, videos and upcoming gatherings.</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.topBarLeft}>
          <Text style={[styles.brandWordmark, { color: colors.text }]} numberOfLines={1}>{organization?.name ?? 'Church Community'}</Text>
          {expression?.name ? (
            <View style={[styles.campusPill, { backgroundColor: colors.bgSecondary }]}>
              <Icon name="people-outline" size={12} color={colors.interactive} />
              <Text style={[styles.campusPillText, { color: colors.interactive }]} numberOfLines={1}>{expression.name}</Text>
            </View>
          ) : (
            <View style={[styles.campusPill, { backgroundColor: colors.bgSecondary }]}>
              <Icon name="globe-outline" size={12} color={colors.interactive} />
              <Text style={[styles.campusPillText, { color: colors.interactive }]}>Public</Text>
            </View>
          )}
        </View>

        <View style={styles.topBarRight}>
          <Pressable onPress={() => router.push('/assistant')} hitSlop={8} style={[styles.iconButton, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Spiritual AI Assistant">
            <Icon name="sparkles" size={18} color={colors.interactive} />
          </Pressable>
          {hasAnyLeadershipCapability ? (
            <Pressable onPress={() => router.push('/studio')} hitSlop={8} style={[styles.iconButton, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Ministry Studio">
              <Icon name="grid-outline" size={18} color={colors.interactive} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/(tabs)/live' as any)} hitSlop={8} style={[styles.iconButton, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Live Broadcasts">
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
                message={expression?.name ? 'Published media and events for this Expression will appear here.' : 'Published sermons, Reels, videos, live broadcasts and events will appear here.'}
                iconName="home-outline"
              />
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
          refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item }) => {
            if (item.kind === 'reel') {
              return (
                <View style={styles.feedCardWrap}>
                  <View style={styles.itemLabelRow}><Icon name="flash" size={16} color="#EF4444" /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>REEL</Text></View>
                  <ReelCard reel={item.reel} width={reelWidth} onPress={() => router.push('/reels')} />
                </View>
              );
            }
            if (item.kind === 'video') {
              return (
                <View style={styles.feedCardWrap}>
                  <View style={styles.itemLabelRow}><Icon name="play-circle-outline" size={16} color={colors.interactive} /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>WATCH</Text></View>
                  <VideoCard video={item.video} expressionName={expression?.name} onPress={() => router.push(`/watch/${item.video.id}${expression?.id ? '?context=expression' : ''}` as any)} />
                </View>
              );
            }
            if (item.kind === 'sermon') {
              const hasAudio = Boolean(item.sermon.audio_asset_id || item.sermon.audio_url);
              const hasVideo = Boolean(item.sermon.video_asset_id || item.sermon.video_url);
              return (
                <View style={styles.feedCardWrap}>
                  <View style={styles.itemLabelRow}><Icon name={hasAudio && !hasVideo ? 'headset-outline' : 'book-outline'} size={16} color={colors.interactive} /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>{hasAudio && !hasVideo ? 'AUDIO TEACHING' : 'SERMON / TEACHING'}</Text></View>
                  <SermonCard sermon={item.sermon} onPress={() => router.push(`/sermon/${item.sermon.id}${expression?.id ? '?context=expression' : ''}` as any)} />
                </View>
              );
            }
            return (
              <View style={styles.feedCardWrap}>
                <View style={styles.itemLabelRow}><Icon name="calendar-outline" size={16} color={colors.interactive} /><Text style={[styles.itemLabel, { color: colors.textSecondary }]}>UPCOMING</Text></View>
                <EventCard event={item.event} onPress={() => router.push(`/event/${item.event.id}${expression?.id ? '?context=expression' : ''}` as any)} />
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.md, marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  brandWordmark: { fontSize: 21, fontWeight: '800', letterSpacing: -0.65, flexShrink: 1 },
  campusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, maxWidth: 150 },
  campusPillText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconButton: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  publicNotice: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  expressionNotice: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  noticeCopy: { flex: 1 },
  publicNoticeTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  publicNoticeText: { fontSize: 11, lineHeight: 16 },
  expressionAction: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6, marginTop: spacing.sm },
  expressionActionText: { fontSize: 12, fontWeight: '700' },
  communityShortcut: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  communityShortcutIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  shortcutPressed: { opacity: 0.9, transform: [{ scale: 0.994 }] },
  degradedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, margin: spacing.lg, marginBottom: 0, padding: spacing.md, borderWidth: 1, borderRadius: radius.md },
  degradedText: { flex: 1, fontSize: 11, lineHeight: 16 },
  heroSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  timelineHeading: { paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  timelineTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  timelineSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  feedCardWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  itemLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  emptyHome: { paddingVertical: 56, paddingHorizontal: spacing.lg },
});

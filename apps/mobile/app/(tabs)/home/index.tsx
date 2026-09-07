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
  const { api, context, mode, hasCapability, hasOrganizationCapability, hasPublicCapability } = useSession();
  const { colors } = useTheme();

  const hasPublicBroadcastAccess = hasPublicCapability('public.live_stream.create');
  const hasGeneralPastoralAccess =
    (hasOrganizationCapability('prayer.moderate') &&
      (hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive'))) ||
    hasOrganizationCapability('pastoral.followups.receive');
  const hasGeneralLeadershipCapability =
    hasPublicBroadcastAccess ||
    hasOrganizationCapability('organization.leadership.manage') ||
    hasOrganizationCapability('giving.campaigns.manage') ||
    hasOrganizationCapability('giving.finance.read') ||
    hasGeneralPastoralAccess ||
    Boolean(context?.creatorOrganizations?.length);
  const hasExpressionLeadershipCapability = Boolean(context?.expression?.id) && (
    hasCapability('posts.create') ||
    hasCapability('posts.publish') ||
    (hasCapability('media.upload') && hasCapability('reels.publish')) ||
    (hasCapability('media.upload') && hasCapability('videos.publish')) ||
    hasCapability('streams.broadcast') ||
    hasCapability('sermons.create') ||
    hasCapability('sermons.manage') ||
    hasCapability('events.create') ||
    hasCapability('events.update') ||
    hasCapability('studio.access') ||
    hasCapability('prayer.moderate') ||
    hasCapability('pastoral.followups.receive') ||
    hasCapability('giving.campaigns.manage') ||
    hasCapability('giving.finance.read') ||
    hasCapability('expression.leadership.manage') ||
    hasCapability('members.invite') ||
    hasCapability('roles.assign')
  );
  const hasAnyLeadershipCapability = hasGeneralLeadershipCapability || hasExpressionLeadershipCapability;

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
        onPress: () => router.push({
          pathname: '/reels',
          params: expression?.id ? { reelId: reel.id } : { reelId: reel.id, context: 'public' },
        } as any),
      });
    });
    return list;
  }, [activeStream, reels, expression?.id]);

  const reelWidth = Math.max(260, Math.min(width - spacing.lg * 2, 460));

  const listHeader = (
    <>
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
          <HeroLiveCard stream={activeStream} onPress={() => router.push(`/(tabs)/live/${activeStream.id}` as any)} />
        </View>
      ) : null}

      {feed.length ? (
        <View style={styles.timelineHeading}>
          <Text style={[styles.timelineTitle, { color: colors.text }]}>
            {expression?.name || (rankingMode === 'personalized' ? 'For you' : 'Latest')}
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
              accessibilityLabel={expression?.name ? `Current Expression: ${expression.name}. Change space` : 'Public COT. Change space'}
              style={({ pressed }) => [styles.scopeControl, pressed && mode === 'authenticated' ? styles.iconPressed : null]}
            >
              <Icon name={expression?.name ? 'people-outline' : 'globe-outline'} size={12} color={colors.interactive} />
              <Text style={[styles.scopeControlText, { color: colors.textSecondary }]} numberOfLines={1}>{expression?.name || 'Public'}</Text>
              {mode === 'authenticated' ? <Icon name="chevron-down" size={12} color={colors.textMuted} /> : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <Pressable onPress={() => router.push('/assistant')} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]} accessibilityRole="button" accessibilityLabel="COT Assistant">
            <Icon name="sparkles" size={18} color={colors.interactive} />
          </Pressable>
          {hasAnyLeadershipCapability ? (
            <Pressable onPress={() => router.push('/studio')} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]} accessibilityRole="button" accessibilityLabel="Ministry Studio">
              <Icon name="grid-outline" size={18} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/(tabs)/live' as any)} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.iconPressed]} accessibilityRole="button" accessibilityLabel="Live">
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
                  <ReelCard
                    reel={item.reel}
                    width={reelWidth}
                    onPress={() => router.push({
                      pathname: '/reels',
                      params: expression?.id ? { reelId: item.reel.id } : { reelId: item.reel.id, context: 'public' },
                    } as any)}
                  />
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
  degradedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: 42, borderWidth: 1, borderRadius: radius.lg },
  degradedText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  heroSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  timelineHeading: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  timelineTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  feedCardWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  itemLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  emptyHome: { paddingVertical: 56, paddingHorizontal: spacing.lg },
});

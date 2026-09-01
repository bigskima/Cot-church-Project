import React from 'react';
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
  EventCard,
  HeroLiveCard,
  Icon,
  LiveCard,
  PostCard,
  ReelCard,
  ResourceError,
  SectionHeader,
  SermonCard,
  Skeleton,
  VideoCard,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Event, LiveStream, Reel, Sermon, SocialPost, Video } from '@/types/content';

const publicOrganization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context, hasCapability } = useSession();
  const { colors, isDark } = useTheme();

  const publicBase = publicOrganization
    ? `public-content?organizationId=${publicOrganization}`
    : 'public-content';

  const streams = useResource<LiveStream[]>('home:streams', (signal) =>
    api.request<LiveStream[]>(
      mode === 'authenticated' ? 'live-streams' : `${publicBase}${publicBase.includes('?') ? '&' : '?'}type=streams`,
      { signal }
    )
  );

  const reels = useResource<Reel[]>('home:reels', (signal) =>
    api.request<Reel[]>(`${publicBase}${publicBase.includes('?') ? '&' : '?'}type=reels`, { signal })
  );

  const videos = useResource<Video[]>('home:videos', (signal) =>
    api.request<Video[]>(`${publicBase}${publicBase.includes('?') ? '&' : '?'}type=videos`, { signal })
  );

  const sermons = useResource<Sermon[]>('home:sermons', (signal) =>
    api.request<Sermon[]>(`${publicBase}${publicBase.includes('?') ? '&' : '?'}type=sermons`, { signal })
  );

  const posts = useResource<SocialPost[]>('home:posts', (signal) =>
    api.request<SocialPost[]>(
      mode === 'authenticated' ? 'social-feed' : `${publicBase}${publicBase.includes('?') ? '&' : '?'}type=feed`,
      { signal }
    )
  );

  const events = useResource<Event[]>('home:events', (signal) =>
    api.request<Event[]>(
      mode === 'authenticated' ? 'events' : `${publicBase}${publicBase.includes('?') ? '&' : '?'}type=events`,
      { signal }
    )
  );

  const handleRefreshAll = () => {
    streams.refresh();
    reels.refresh();
    videos.refresh();
    sermons.refresh();
    posts.refresh();
    events.refresh();
  };

  const isRefreshing =
    streams.loading ||
    reels.loading ||
    videos.loading ||
    sermons.loading ||
    posts.loading ||
    events.loading;

  const name = context?.profile?.display_name?.split(' ')[0];
  const orgName = context?.organizations?.[0]?.name;
  const expressionName = context?.expression?.name;

  // Capability check for Studio: only authorized users see it
  const canCreateContent =
    hasCapability('content.create') ||
    hasCapability('streams.broadcast') ||
    hasCapability('sermons.create') ||
    hasCapability('*');

  const activeStream = streams.data?.find((s) => s.status === 'live') ?? streams.data?.[0];
  const reelsList = reels.data ?? [];
  const videosList = videos.data ?? [];
  const sermonsList = sermons.data ?? [];
  const eventsList = events.data ?? [];
  const postsList = posts.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            tintColor={colors.interactive}
          />
        }
      >
        {/* App Bar / Top Identity Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerIdentityCol}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {name ? `Good morning, ${name}` : 'Welcome'}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {orgName || expressionName || 'Church Platform'}
            </Text>
          </View>

          <View style={styles.headerActionsRow}>
            {/* AI Sparkle Assistant Entry (Direct route to assistant) */}
            <Pressable
              onPress={() => router.push('/assistant')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: colors.primarySoft },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="AI Assistant"
            >
              <Icon name="sparkles" size={18} color={colors.interactive} />
            </Pressable>

            {/* Profile Avatar Entry */}
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Avatar
                url={context?.profile?.avatar_url}
                name={context?.profile?.display_name}
                size="sm"
              />
            </Pressable>
          </View>
        </View>

        {/* Quick Action Navigation Strip */}
        <View style={styles.quickActionsStrip}>
          <Pressable
            onPress={() => router.push('/(tabs)/live')}
            style={({ pressed }) => [
              styles.quickActionPill,
              { backgroundColor: colors.bgSecondary, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="radio-outline" size={16} color={colors.interactive} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Live</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/discover')}
            style={({ pressed }) => [
              styles.quickActionPill,
              { backgroundColor: colors.bgSecondary, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="book-outline" size={16} color={colors.interactive} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Sermons</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/discover')}
            style={({ pressed }) => [
              styles.quickActionPill,
              { backgroundColor: colors.bgSecondary, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="calendar-outline" size={16} color={colors.interactive} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Events</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/profile/prayer')}
            style={({ pressed }) => [
              styles.quickActionPill,
              { backgroundColor: colors.bgSecondary, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="heart-outline" size={16} color={colors.interactive} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Prayer</Text>
          </Pressable>

          {/* Studio button only visible to authorized creators/leaders */}
          {canCreateContent ? (
            <Pressable
              onPress={() => router.push('/studio')}
              style={({ pressed }) => [
                styles.quickActionPill,
                { backgroundColor: colors.primarySoft, borderColor: colors.interactive },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="create-outline" size={16} color={colors.interactive} />
              <Text style={[styles.quickActionLabel, { color: colors.interactive }]}>Studio</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Live Broadcast Hero Card */}
        {streams.loading ? (
          <View style={styles.sectionPad}>
            <Skeleton height={200} borderRadius={radius.lg} />
          </View>
        ) : activeStream ? (
          <View style={styles.sectionPad}>
            <HeroLiveCard
              stream={activeStream}
              onPress={() => router.push(`/(tabs)/live/${activeStream.id}`)}
            />
          </View>
        ) : null}

        {/* Featured / Public Heritage Banner */}
        <Pressable
          onPress={() => router.push('/(tabs)/discover/church-story')}
          style={({ pressed }) => [
            styles.storyBanner,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.sm,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.storyIconWrap, { backgroundColor: colors.primarySoft }]}>
            <Icon name="library-outline" size={20} color={colors.interactive} />
          </View>
          <View style={styles.storyCol}>
            <Text style={[styles.storyKicker, { color: colors.interactive }]}>HERITAGE & LEADERSHIP</Text>
            <Text style={[styles.storyTitle, { color: colors.text }]}>Discover Our Story & Pastors</Text>
            <Text style={[styles.storySub, { color: colors.textMuted }]}>
              Learn about our mission, founding history, and campus directors.
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Short Clips / Reels Carousel */}
        {reelsList.length > 0 ? (
          <View style={styles.sectionWrapper}>
            <SectionHeader
              title="Short Highlights"
              actionLabel="All Reels"
              onAction={() => router.push('/(tabs)/reels')}
            />
            <FlatList
              horizontal
              data={reelsList}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <ReelCard
                  reel={item}
                  onPress={() => router.push('/(tabs)/reels')}
                />
              )}
            />
          </View>
        ) : null}

        {/* Latest Sermons Section */}
        {sermonsList.length > 0 ? (
          <View style={styles.sectionWrapper}>
            <SectionHeader
              title="Latest Sermons"
              actionLabel="Browse All"
              onAction={() => router.push('/(tabs)/discover')}
            />
            <View style={styles.sectionPad}>
              {sermonsList.slice(0, 3).map((sermon) => (
                <SermonCard
                  key={sermon.id}
                  sermon={sermon}
                  onPress={() => router.push(`/(tabs)/discover/sermon/${sermon.id}`)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Watch Videos Section */}
        {videosList.length > 0 ? (
          <View style={styles.sectionWrapper}>
            <SectionHeader
              title="Watch & Documentaries"
              actionLabel="All Videos"
              onAction={() => router.push('/watch')}
            />
            <View style={styles.sectionPad}>
              {videosList.slice(0, 2).map((vid) => (
                <VideoCard
                  key={vid.id}
                  video={vid}
                  expressionName={expressionName}
                  onPress={() => router.push(`/watch/${vid.id}`)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Upcoming Gatherings / Events */}
        {eventsList.length > 0 ? (
          <View style={styles.sectionWrapper}>
            <SectionHeader
              title="Upcoming Events"
              actionLabel="Calendar"
              onAction={() => router.push('/(tabs)/discover')}
            />
            <View style={styles.sectionPad}>
              {eventsList.slice(0, 3).map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onPress={() => router.push('/(tabs)/discover')}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Community Highlights */}
        {postsList.length > 0 ? (
          <View style={styles.sectionWrapper}>
            <SectionHeader
              title="Community Fellowship"
              actionLabel="Social Feed"
              onAction={() => router.push('/(tabs)/community')}
            />
            {postsList.slice(0, 2).map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onComment={() => router.push('/(tabs)/community')}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerIdentityCol: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    ...typography.caption,
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.h2,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsStrip: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  quickActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 5,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionPad: {
    paddingHorizontal: spacing.lg,
  },
  sectionWrapper: {
    marginTop: spacing.sm,
  },
  horizontalList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  storyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  storyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCol: {
    flex: 1,
    gap: 2,
  },
  storyKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  storyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  storySub: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.8,
  },
});

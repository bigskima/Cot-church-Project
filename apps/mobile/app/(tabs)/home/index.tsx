import React from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  AIButton,
  Badge,
  EmptyState,
  EventCard,
  HeroLiveCard,
  PostCard,
  ReelCard,
  ResourceError,
  SectionHeader,
  SermonCard,
  Skeleton,
  VideoCard,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Event, LiveStream, Reel, Sermon, SocialPost, Video } from '@/types/content';

const publicOrganization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function HomeScreen() {
  const { api, mode, context } = useSession();
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

  const name = context?.profile?.display_name?.split(' ')[0];
  const activeStream = streams.data?.find((s) => s.status === 'live') ?? streams.data?.[0];
  const reelsList = reels.data ?? [];
  const videosList = videos.data ?? [];
  const sermonsList = sermons.data ?? [];

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.bg }] as any}
        contentContainerStyle={styles.content as any}
      >
        {/* Luxury Hero Welcome Banner */}
        <View style={styles.heroBanner as any}>
          <View style={styles.heroHeaderRow as any}>
            <View>
              <Text style={styles.greetingText as any}>
                {name ? `Welcome back, ${name}` : 'Welcome to the Sanctuary'}
              </Text>
              <Text style={styles.heroTitle as any}>Your church is alive.</Text>
            </View>
            <View style={styles.orgBadgeWrapper as any}>
              <Badge
                label={context?.organizations?.[0]?.name ?? 'Global Sanctuary'}
                variant="gold"
              />
            </View>
          </View>

          {/* Quick Action Navigation Grid */}
          <View style={styles.quickActionsRow as any}>
            <Pressable
              onPress={() => router.push('/(tabs)/live')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed] as any}
            >
              <Text style={styles.quickActionIcon as any}>📡</Text>
              <Text style={styles.quickActionLabel as any}>Live</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/reels')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed] as any}
            >
              <Text style={styles.quickActionIcon as any}>🎬</Text>
              <Text style={styles.quickActionLabel as any}>Reels</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/discover')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed] as any}
            >
              <Text style={styles.quickActionIcon as any}>📖</Text>
              <Text style={styles.quickActionLabel as any}>Sermons</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/studio')}
              style={({ pressed }) => [styles.quickActionPill, styles.studioPill, pressed && styles.pressed] as any}
            >
              <Text style={styles.quickActionIcon as any}>✨</Text>
              <Text style={[styles.quickActionLabel, { color: palette.gold }] as any}>Studio</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bodyContent as any}>
          {/* Public Church Story Banner */}
          <Pressable
            onPress={() => router.push('/(tabs)/discover/church-story')}
            style={{
              backgroundColor: '#1E120A',
              borderRadius: radius.lg,
              padding: spacing.md,
              marginTop: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: '#452A1A',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            } as any}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#E5B94B', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' } as any}>
                PUBLIC HERITAGE & DIRECTORY
              </Text>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '900', marginTop: 2 } as any}>
                Discover Our Story & Leadership
              </Text>
              <Text style={{ color: '#C9D2E1', fontSize: 12, marginTop: 2 } as any}>
                Meet our founding leaders and pastors across expressions.
              </Text>
            </View>
            <Text style={{ color: '#E5B94B', fontSize: 20, fontWeight: '900' } as any}>›</Text>
          </Pressable>

          {/* Live Broadcast Feature Section */}
          <SectionHeader
            title="Live Gathering"
            actionLabel="View all"
            onAction={() => router.push('/(tabs)/live')}
            dark={isDark}
          />

          {streams.loading ? (
            <Skeleton height={240} borderRadius={radius.xl} dark={isDark} />
          ) : streams.error && !streams.data ? (
            <ResourceError
              offline={streams.offline}
              message={streams.error}
              retry={streams.refresh}
              dark={isDark}
            />
          ) : activeStream ? (
            <HeroLiveCard
              stream={activeStream}
              onPress={() => router.push(`/(tabs)/live/${activeStream.id}` as any)}
            />
          ) : (
            <EmptyState
              title="No Active Broadcast Right Now"
              message="Tune in for our scheduled services or replay recent messages."
              icon="📡"
              actionLabel="View Archive"
              onAction={() => router.push('/(tabs)/live')}
              dark={isDark}
            />
          )}

          {/* Short-Form Reels Horizontal Carousel */}
          {reelsList.length > 0 ? (
            <View style={styles.sectionWrapper as any}>
              <SectionHeader
                title="Worship & Ministry Reels"
                actionLabel="Explore all"
                onAction={() => router.push('/(tabs)/reels')}
                dark={isDark}
              />
              <FlatList
                horizontal
                data={reelsList}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <ReelCard reel={item} onPress={() => router.push('/(tabs)/reels')} />
                )}
              />
            </View>
          ) : null}

          {/* Latest Long-Form Watch Section */}
          {videosList.length > 0 ? (
            <View style={styles.sectionWrapper as any}>
              <SectionHeader
                title="Latest Watch Broadcasts"
                actionLabel="Watch Hub"
                onAction={() => router.push('/(tabs)/discover')}
                dark={isDark}
              />
              {videosList.slice(0, 2).map((item) => (
                <VideoCard
                  key={item.id}
                  video={item}
                  onPress={() => router.push(`/watch/${item.id}` as any)}
                  dark={isDark}
                />
              ))}
            </View>
          ) : null}

          {/* Latest Sermons Teaching Section */}
          {sermonsList.length > 0 ? (
            <View style={styles.sectionWrapper as any}>
              <SectionHeader
                title="Latest Ministry Sermons"
                actionLabel="All Sermons"
                onAction={() => router.push('/(tabs)/discover')}
                dark={isDark}
              />
              {sermonsList.slice(0, 2).map((sermon) => (
                <SermonCard
                  key={sermon.id}
                  sermon={sermon}
                  onPress={() => router.push(`/(tabs)/discover/sermon/${sermon.id}` as any)}
                />
              ))}
            </View>
          ) : null}

          {/* Today's / Upcoming Gatherings */}
          <SectionHeader
            title="Upcoming Gatherings"
            actionLabel="View calendar"
            onAction={() => router.push('/(tabs)/community')}
            dark={isDark}
          />

          {events.loading ? (
            <Skeleton height={140} count={2} dark={isDark} />
          ) : events.error && !events.data ? (
            <ResourceError
              offline={events.offline}
              message={events.error}
              retry={events.refresh}
              dark={isDark}
            />
          ) : events.data && events.data.length > 0 ? (
            events.data.slice(0, 2).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push('/(tabs)/community')}
              />
            ))
          ) : (
            <EmptyState
              title="No Upcoming Gatherings"
              message="New sanctuary worship gatherings and conferences will be scheduled shortly."
              icon="🗓️"
              dark={isDark}
            />
          )}

          {/* Community Post Feed */}
          <SectionHeader
            title="Church Community Feed"
            actionLabel="Open Feed"
            onAction={() => router.push('/(tabs)/community')}
            dark={isDark}
          />

          {posts.loading ? (
            <Skeleton height={180} count={2} dark={isDark} />
          ) : posts.error && !posts.data ? (
            <ResourceError
              offline={posts.offline}
              message={posts.error}
              retry={posts.refresh}
              dark={isDark}
            />
          ) : posts.data && posts.data.length > 0 ? (
            posts.data.slice(0, 3).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onReact={async (reaction) => {
                  try {
                    await api.request('social-feed', {
                      method: 'POST',
                      body: JSON.stringify({ postId: post.id, reaction }),
                    });
                    posts.refresh();
                  } catch {
                    // Guest reaction or offline
                  }
                }}
              />
            ))
          ) : (
            <EmptyState
              title="No Community Posts"
              message="Inspiring thoughts and weekly devotionals from leadership will appear here."
              icon="✦"
              dark={isDark}
            />
          )}
        </View>
      </ScrollView>

      {/* Floating AI Spiritual Assistant */}
      <AIButton onPress={() => router.push('/(tabs)/discover')} />
    </>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 110,
  },
  heroBanner: {
    backgroundColor: '#140C07',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greetingText: {
    color: '#E6CCB2',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFDF9',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  orgBadgeWrapper: {
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  quickActionPill: {
    flex: 1,
    backgroundColor: '#2E1C11',
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#452A1A',
  },
  studioPill: {
    borderColor: palette.gold,
  },
  quickActionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  sectionWrapper: {
    gap: spacing.sm,
  },
});

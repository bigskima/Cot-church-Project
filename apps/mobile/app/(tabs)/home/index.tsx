import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import {
  AIButton,
  EventCard,
  HeroLiveCard,
  PostCard,
  SectionHeader,
  EmptyState,
  ResourceError,
  Skeleton,
  Badge,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Event, LiveStream, SocialPost } from '@/types/content';

const publicOrganization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function HomeScreen() {
  const { api, mode, context } = useSession();
  const publicQuery = `public-content?organizationId=${publicOrganization}`;

  const streams = useResource<LiveStream[]>('home:streams', (signal) =>
    api.request(mode === 'authenticated' ? 'live-streams' : `${publicQuery}&type=streams`, { signal })
  );

  const posts = useResource<SocialPost[]>('home:posts', (signal) =>
    api.request(mode === 'authenticated' ? 'social-feed' : `${publicQuery}&type=feed`, { signal })
  );

  const events = useResource<Event[]>('home:events', (signal) =>
    mode === 'authenticated' ? api.request('events', { signal }) : Promise.resolve([])
  );

  const name = context?.profile?.display_name?.split(' ')[0];
  const activeStream = streams.data?.find((s) => s.status === 'live') ?? streams.data?.[0];

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Luxury Hero Welcome Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroHeaderRow}>
            <View>
              <Text style={styles.greetingText}>
                {name ? `Welcome back, ${name}` : 'Welcome to the Sanctuary'}
              </Text>
              <Text style={styles.heroTitle}>Your church is alive.</Text>
            </View>
            <View style={styles.orgBadgeWrapper}>
              <Badge
                label={context?.organizations?.[0]?.name ?? 'Global Sanctuary'}
                variant="gold"
              />
            </View>
          </View>

          {/* Quick Action Pills */}
          <View style={styles.quickActionsRow}>
            <Pressable
              onPress={() => router.push('/(tabs)/live')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed]}
            >
              <Text style={styles.quickActionIcon}>🔴</Text>
              <Text style={styles.quickActionLabel}>Live Broadcast</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/discover')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed]}
            >
              <Text style={styles.quickActionIcon}>📖</Text>
              <Text style={styles.quickActionLabel}>Sermons</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/profile/giving')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed]}
            >
              <Text style={styles.quickActionIcon}>🤍</Text>
              <Text style={styles.quickActionLabel}>Give</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/profile/prayer')}
              style={({ pressed }) => [styles.quickActionPill, pressed && styles.pressed]}
            >
              <Text style={styles.quickActionIcon}>🙏</Text>
              <Text style={styles.quickActionLabel}>Prayer</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bodyContent}>
          {/* Live Broadcast Feature Section */}
          <SectionHeader
            title="Live Gathering"
            actionLabel="View all"
            onAction={() => router.push('/(tabs)/live')}
          />

          {streams.loading ? (
            <Skeleton height={240} borderRadius={radius.xl} />
          ) : streams.error && !streams.data ? (
            <ResourceError
              offline={streams.offline}
              message={streams.error}
              retry={streams.refresh}
            />
          ) : activeStream ? (
            <HeroLiveCard
              stream={activeStream}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/live/[id]',
                  params: { id: activeStream.id },
                })
              }
            />
          ) : (
            <EmptyState
              title="Next Gathering Scheduled Soon"
              message="Join us for upcoming Sunday and midweek services online."
              actionLabel="View Calendar"
              onAction={() => router.push('/(tabs)/discover')}
              icon="🕊️"
            />
          )}

          {/* Upcoming Gatherings & Services */}
          {mode === 'authenticated' && (
            <>
              <SectionHeader
                title="Upcoming Gatherings"
                actionLabel="Explore"
                onAction={() => router.push('/(tabs)/discover')}
              />
              {events.loading ? (
                <Skeleton height={90} count={2} />
              ) : events.data && events.data.length > 0 ? (
                events.data.slice(0, 3).map((event) => <EventCard key={event.id} event={event} />)
              ) : (
                <EmptyState
                  title="No Upcoming Events"
                  message="Check back soon for upcoming fellowship and worship gatherings."
                />
              )}
            </>
          )}

          {/* Community Feed Section */}
          <SectionHeader
            title="Sanctuary Community"
            actionLabel="Open feed"
            onAction={() => router.push('/(tabs)/community')}
          />
          {posts.loading ? (
            <Skeleton height={140} count={2} />
          ) : posts.error && !posts.data ? (
            <ResourceError
              offline={posts.offline}
              message={posts.error}
              retry={posts.refresh}
            />
          ) : posts.data && posts.data.length > 0 ? (
            posts.data
              .slice(0, 2)
              .map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={(reaction) =>
                    api
                      .request('social-feed', {
                        method: 'POST',
                        body: JSON.stringify({ postId: post.id, reaction }),
                      })
                      .then(() => posts.refresh())
                  }
                />
              ))
          ) : (
            <EmptyState
              title="Community Updates Coming"
              message="Announcements and encouragement from your pastors will appear here."
            />
          )}
        </View>
      </ScrollView>

      {/* Floating AI Church Assistant */}
      <AIButton onPress={() => router.push('/assistant')} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  heroBanner: {
    backgroundColor: palette.midnight,
    paddingHorizontal: spacing.lg,
    paddingTop: 58,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadows.lg,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingText: {
    color: '#ABB7CA',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.white,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  orgBadgeWrapper: {
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  quickActionPill: {
    flex: 1,
    backgroundColor: '#FFFFFF12',
    borderWidth: 1,
    borderColor: '#FFFFFF1A',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  quickActionLabel: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
  },
});

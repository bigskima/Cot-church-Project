import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  EmptyState,
  HeroLiveCard,
  LiveCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, spacing } from '@/design-system/tokens';
import type { LiveStream } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function LiveDiscoveryScreen() {
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();

  const publicBase = organization
    ? `public-content?organizationId=${organization}&type=streams`
    : 'public-content?type=streams';

  const resource = useResource<LiveStream[]>('live:discovery', (signal) =>
    api.request<LiveStream[]>(
      mode === 'visitor' ? publicBase : 'live-streams',
      { signal }
    )
  );

  const openStream = (id: string) =>
    router.push({ pathname: '/(tabs)/live/[id]', params: { id } });

  const liveStreams = resource.data?.filter((item) => item.status === 'live') ?? [];
  const scheduledStreams = resource.data?.filter((item) => item.status === 'scheduled') ?? [];
  const replays = resource.data?.filter((item) => item.status === 'ended') ?? [];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Sanctuary Live"
        subtitle="Global broadcasts, interactive services, and replay archives."
        dark={isDark}
      />

      <View style={styles.body}>
        {resource.loading ? (
          <View style={styles.loadingWrapper}>
            <Skeleton height={260} dark={isDark} />
            <Skeleton height={180} dark={isDark} />
          </View>
        ) : resource.error && !resource.data ? (
          <ResourceError
            offline={resource.offline}
            message={resource.error}
            retry={resource.refresh}
            dark={isDark}
          />
        ) : (
          <>
            {/* Featured Active Broadcast */}
            {liveStreams.length > 0 ? (
              <>
                <SectionHeader title="Broadcasting Now" dark={isDark} />
                <HeroLiveCard
                  stream={liveStreams[0]}
                  onPress={() => openStream(liveStreams[0].id)}
                />
              </>
            ) : null}

            {/* Upcoming Broadcasts Carousel */}
            <SectionHeader
              title="Upcoming Sanctuary Broadcasts"
              badge={scheduledStreams.length}
              dark={isDark}
            />
            {scheduledStreams.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContainer}
              >
                {scheduledStreams.map((stream) => (
                  <LiveCard
                    key={stream.id}
                    stream={stream}
                    onPress={() => openStream(stream.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <EmptyState
                title="No Upcoming Broadcasts"
                message="Weekly Sunday services stream live at 9:00 AM & 11:30 AM."
                icon="📡"
                dark={isDark}
              />
            )}

            {/* Broadcast Archives & Replays */}
            <SectionHeader
              title="Service Replays & Archives"
              badge={replays.length}
              dark={isDark}
            />
            {replays.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContainer}
              >
                {replays.map((stream) => (
                  <LiveCard
                    key={stream.id}
                    stream={stream}
                    onPress={() => openStream(stream.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <EmptyState
                title="No Replays Available"
                message="Live stream replays will be archived here following the service."
                icon="📼"
                dark={isDark}
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  loadingWrapper: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  carouselContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
});

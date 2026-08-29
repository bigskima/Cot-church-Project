import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
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
  const resource = useResource<LiveStream[]>('live:discovery', (signal) =>
    api.request(
      mode === 'visitor'
        ? `public-content?organizationId=${organization}&type=streams`
        : 'live-streams',
      { signal }
    )
  );

  const openStream = (id: string) =>
    router.push({ pathname: '/(tabs)/live/[id]', params: { id } });

  const liveStreams = resource.data?.filter((item) => item.status === 'live') ?? [];
  const scheduledStreams = resource.data?.filter((item) => item.status === 'scheduled') ?? [];
  const replays = resource.data?.filter((item) => item.status === 'ended') ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Sanctuary Live"
        subtitle="Global broadcasts, interactive services, and replay archives."
        dark
      />

      <View style={styles.body}>
        {resource.loading ? (
          <View style={styles.loadingWrapper}>
            <Skeleton height={260} dark />
            <Skeleton height={180} dark />
          </View>
        ) : resource.error && !resource.data ? (
          <ResourceError
            offline={resource.offline}
            message={resource.error}
            retry={resource.refresh}
            dark
          />
        ) : (
          <>
            {/* Active Live Broadcast */}
            {liveStreams.length > 0 ? (
              <>
                <SectionHeader title="Broadcasting Now" dark badge="LIVE" />
                <HeroLiveCard
                  stream={liveStreams[0]}
                  onPress={() => openStream(liveStreams[0].id)}
                />
              </>
            ) : null}

            {/* Scheduled Broadcasts */}
            <SectionHeader title="Upcoming Gatherings" dark />
            {scheduledStreams.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
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
                title="No Live Streams Right Now"
                message="Check back for scheduled services or watch recorded replays below."
                icon="📡"
                dark
              />
            )}

            {/* Replays and Archives */}
            {replays.length > 0 && (
              <>
                <SectionHeader title="Recent Broadcast Replays" dark />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
                  {replays.map((stream) => (
                    <LiveCard
                      key={stream.id}
                      stream={stream}
                      onPress={() => openStream(stream.id)}
                    />
                  ))}
                </ScrollView>
              </>
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
    backgroundColor: palette.midnight,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  loadingWrapper: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  carousel: {
    marginBottom: spacing.lg,
  },
});

import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { spacing } from '@/design-system/tokens';
import type { LiveStream } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function LiveDiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode } = useSession();
  const { colors } = useTheme();

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
    router.push(`/(tabs)/live/${id}` as any);

  const liveStreams = resource.data?.filter((item) => item.status === 'live') ?? [];
  const scheduledStreams = resource.data?.filter((item) => item.status === 'scheduled' || item.status === 'ready') ?? [];
  const replays = resource.data?.filter((item) => item.status === 'ended') ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor={colors.interactive}
          />
        }
      >
        <ScreenHeader
          title="Live Broadcasts"
          subtitle="Join live worship services, prayer sessions, and watch past service replays."
          showBack
        />

        <View style={styles.body}>
          {resource.loading ? (
            <View style={styles.loadingWrapper}>
              <Skeleton height={200} />
              <Skeleton height={140} />
            </View>
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : (
            <>
              {/* Featured Active Broadcast */}
              {liveStreams.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <SectionHeader title="Broadcasting Now" />
                  <HeroLiveCard
                    stream={liveStreams[0]}
                    onPress={() => openStream(liveStreams[0].id)}
                  />
                </View>
              ) : null}

              {/* Upcoming Broadcasts Carousel */}
              <View style={styles.sectionWrap}>
                <SectionHeader
                  title="Upcoming Services"
                  badge={scheduledStreams.length}
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
                    message="Check back soon for upcoming Sunday services and midweek fellowships."
                    iconName="radio-outline"
                  />
                )}
              </View>

              {/* Replay Archives */}
              {replays.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <SectionHeader title="Past Broadcast Replays" badge={replays.length} />
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
                </View>
              ) : null}
            </>
          )}
        </View>
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
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  loadingWrapper: {
    gap: spacing.md,
  },
  sectionWrap: {
    gap: spacing.xs,
  },
  carouselContainer: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
});

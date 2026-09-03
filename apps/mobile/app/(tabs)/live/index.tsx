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

type LiveHomePayload = {
  streams: LiveStream[];
  mode: 'general' | 'expression';
  degradedSections?: string[];
};

export default function LiveDiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();

  const organization = context?.organization ?? context?.organizations?.[0];
  const expression = context?.expression;
  const query = new URLSearchParams();
  if (organization?.id) query.set('organizationId', organization.id);
  if (expression?.id) query.set('expressionId', expression.id);

  // Use the same scope resolver as Home. General live content is always retained;
  // selecting an active Expression adds that Expression's permitted broadcasts.
  const resource = useResource<LiveHomePayload>(
    `live:discovery:${organization?.id ?? 'default'}:${expression?.id ?? 'general'}`,
    (signal) => api.request<LiveHomePayload>(`home-feed${query.size ? `?${query.toString()}` : ''}`, { signal })
  );

  const openStream = (id: string) => router.push(`/(tabs)/live/${id}` as any);

  const streams = resource.data?.streams ?? [];
  const liveStreams = streams.filter((item) => item.status === 'live');
  const scheduledStreams = streams.filter((item) => item.status === 'scheduled' || item.status === 'ready');
  const replays = streams.filter((item) => item.status === 'ended');

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
          subtitle={expression?.name ? `General Community and ${expression.name} broadcasts.` : 'Live services and replays available to the General Community.'}
          showBack
        />

        <View style={styles.body}>
          {resource.loading && !resource.data ? (
            <View style={styles.loadingWrapper}>
              <Skeleton height={200} />
              <Skeleton height={140} />
            </View>
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : (
            <>
              {liveStreams.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <SectionHeader title="Broadcasting Now" />
                  <HeroLiveCard
                    stream={liveStreams[0]}
                    onPress={() => openStream(liveStreams[0].id)}
                  />
                </View>
              ) : null}

              <View style={styles.sectionWrap}>
                <SectionHeader title="Upcoming" badge={scheduledStreams.length} />
                {scheduledStreams.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContainer}
                  >
                    {scheduledStreams.map((stream) => (
                      <LiveCard key={stream.id} stream={stream} onPress={() => openStream(stream.id)} />
                    ))}
                  </ScrollView>
                ) : (
                  <EmptyState
                    title="No Upcoming Broadcasts"
                    message="No upcoming live broadcasts have been scheduled yet."
                    iconName="radio-outline"
                  />
                )}
              </View>

              {replays.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <SectionHeader title="Recent Replays" badge={replays.length} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContainer}
                  >
                    {replays.map((stream) => (
                      <LiveCard key={stream.id} stream={stream} onPress={() => openStream(stream.id)} />
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
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  loadingWrapper: { gap: spacing.md },
  sectionWrap: { gap: spacing.xs },
  carouselContainer: { gap: spacing.md, paddingVertical: spacing.xs },
});

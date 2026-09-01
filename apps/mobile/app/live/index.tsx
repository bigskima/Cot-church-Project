import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  Skeleton,
} from '@/components';
import { spacing } from '@/design-system/tokens';
import type { LiveStream } from '@/types/content';

export default function LiveCatalogueScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const orgParam =
    mode === 'visitor'
      ? `?organizationId=${process.env.EXPO_PUBLIC_ORGANIZATION_ID || ''}`
      : context?.expression?.id
      ? `?expressionId=${context.expression.id}`
      : '';

  const resource = useResource<LiveStream[]>('live:streams:catalogue', (signal) => {
    if (mode === 'visitor') {
      return api.request<LiveStream[]>(`public-content?type=streams${orgParam ? `&${orgParam.slice(1)}` : ''}`, { signal });
    }
    return api.request<LiveStream[]>(`live-streams${orgParam}`, { signal });
  });

  const streams = resource.data ?? [];
  const activeLive = streams.find((s) => s.status === 'live');
  const otherStreams = streams.filter((s) => s.id !== activeLive?.id);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Live Broadcasts"
        subtitle="Join real-time sanctuary worship, prayer vigils, and church conferences."
        showBack
      />

      <FlatList
        data={otherStreams}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor={colors.interactive}
          />
        }
        ListHeaderComponent={
          activeLive ? (
            <View style={styles.heroWrap}>
              <HeroLiveCard
                stream={activeLive}
                onPress={() => router.push(`/live/${activeLive.id}` as any)}
              />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Upcoming & Past Broadcasts
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          resource.loading && !resource.data ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={200} />
              <Skeleton height={90} count={3} />
            </View>
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : (
            <EmptyState
              title="No Live Streams Right Now"
              message="Check the church schedule for our upcoming Sunday and midweek services."
              iconName="radio-outline"
            />
          )
        }
        renderItem={({ item }) => (
          <LiveCard
            stream={item}
            onPress={() => router.push(`/live/${item.id}` as any)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  heroWrap: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

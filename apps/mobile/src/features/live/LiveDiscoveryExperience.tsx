import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Button,
  EmptyState,
  HeroLiveCard,
  LiveCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LiveStream } from '@/types/content';

type LiveHomePayload = {
  streams: LiveStream[];
  mode: 'general' | 'expression';
  degradedSections?: string[];
};

export function LiveDiscoveryExperience({ scope = 'general', embedded = false }: { scope?: 'general' | 'expression'; embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability, hasPublicCapability } = useSession();
  const { colors } = useTheme();

  const organization = context?.organization ?? context?.organizations?.[0];
  const expression = context?.expression;
  const expressionMode = scope === 'expression';
  const expressionId = expressionMode ? expression?.id : undefined;
  const canOpenLiveStudio = expressionMode
    ? Boolean(expressionId) && hasCapability('streams.broadcast')
    : hasPublicCapability('public.live_stream.create');
  const query = new URLSearchParams();
  if (organization?.id) query.set('organizationId', organization.id);
  if (expressionId) query.set('expressionId', expressionId);

  // Use the same scope resolver as Home. General live content is always retained;
  // selecting an active Expression adds that Expression's permitted broadcasts.
  const resource = useResource<LiveHomePayload>(
    `live:discovery:${organization?.id ?? 'default'}:${expressionId ?? 'general'}:${scope}`,
    (signal) => api.request<LiveHomePayload>(`home-feed${query.size ? `?${query.toString()}` : ''}`, { signal })
  );

  const openStream = (id: string) => expressionMode && expressionId
    ? router.push(`/expressions/${expressionId}/live/${id}` as any)
    : router.push(`/(tabs)/live/${id}` as any);

  const streams = resource.data?.streams ?? [];
  const liveStreams = streams.filter((item) => item.status === 'live');
  const scheduledStreams = streams.filter((item) =>
    item.status === 'scheduled' || item.status === 'provisioning' || item.status === 'ready',
  );
  const replays = streams.filter((item) =>
    item.status === 'ended' || item.status === 'processing' || item.status === 'replay_ready',
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: embedded ? spacing.md : insets.top + spacing.sm, paddingBottom: embedded ? insets.bottom + spacing.xl : insets.bottom + 120 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor={colors.interactive}
          />
        }
      >
        {embedded ? (
          <View style={[styles.embeddedHeader, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={styles.embeddedHeaderCopy}>
              <Text style={[styles.embeddedEyebrow, { color: colors.interactive }]}>EXPRESSION LIVE</Text>
              <Text style={[styles.embeddedTitle, { color: colors.text }]}>Live</Text>
              <Text style={[styles.embeddedSubtitle, { color: colors.textSecondary }]}>
                Broadcasts and replays inside {expression?.name ?? 'this Expression'}.
              </Text>
            </View>
            {canOpenLiveStudio ? (
              <Button label="Live studio" onPress={() => router.push('/(tabs)/profile/leadership/media-studio' as any)} size="sm" />
            ) : null}
          </View>
        ) : (
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <ScreenHeader
              title="Live"
              kicker="BROADCASTS"
              subtitle={expressionMode ? `Broadcasts inside ${expression?.name ?? 'this Expression'}.` : 'Services, gatherings and replays from COT.'}
              showBack
              rightAction={canOpenLiveStudio ? (
                <Button
                  label={expressionMode ? 'Live studio' : 'Go live'}
                  onPress={() => router.push('/(tabs)/profile/leadership/media-studio' as any)}
                  size="sm"
                />
              ) : undefined}
            />
          </View>
  
  
        )}

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
                  <SectionHeader title="Replays & recordings" badge={replays.length} subtitle="Ended services stay here while recordings finish processing." />
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

export default function GeneralLiveDiscoveryExperience() {
  return <LiveDiscoveryExperience scope="general" />;
}

const styles = StyleSheet.create({
  embeddedHeader: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  embeddedHeaderCopy: { flex: 1, minWidth: 0 },
  embeddedEyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  embeddedTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800' },
  embeddedSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.xl },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  loadingWrapper: { gap: spacing.md },
  sectionWrap: { gap: spacing.sm },
  carouselContainer: { gap: spacing.md, paddingVertical: spacing.xs },
});

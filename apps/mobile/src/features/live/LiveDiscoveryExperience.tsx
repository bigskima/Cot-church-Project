import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { ExpressionMediaHeader } from '@/components/expression/ExpressionMediaHeader';
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

  // The route owns the experience scope. General Live stays church-wide, while
  // Expression Live requests only the exact active Expression.
  const resource = useResource<LiveHomePayload>(
    `live:discovery:${organization?.id ?? 'default'}:${expressionId ?? 'general'}:${scope}`,
    (signal) => api.request<LiveHomePayload>(`home-feed${query.size ? `?${query.toString()}` : ''}`, { signal })
  );

  const openStream = (id: string) => expressionMode && expressionId
    ? router.push(`/expressions/${expressionId}/live/${id}` as any)
    : router.push(`/general/live/${id}` as any);

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
        {embedded && expressionMode && expressionId ? (
          <ExpressionMediaHeader
            expressionId={expressionId}
            expressionName={expression?.name ?? 'This Expression'}
            active="live"
            title="Live"
            subtitle="Watch current broadcasts, see what is scheduled next and return to recent replays."
            icon="radio-outline"
            actionLabel={canOpenLiveStudio ? 'Studio' : undefined}
            actionIcon="videocam-outline"
            onAction={canOpenLiveStudio ? () => router.push(`/expressions/${expressionId}/manage/live` as any) : undefined}
          />
        ) : embedded ? (
          <View style={[styles.embeddedHeader, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={styles.embeddedHeaderCopy}>
              <Text style={[styles.embeddedEyebrow, { color: colors.interactive }]}>LIVE</Text>
              <Text style={[styles.embeddedTitle, { color: colors.text }]}>Broadcasts</Text>
              <Text style={[styles.embeddedSubtitle, { color: colors.textSecondary }]}>Services, gatherings and replays from COT.</Text>
            </View>
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
                  onPress={() => router.push((expressionMode && expressionId ? `/expressions/${expressionId}/manage/live` : '/general/leadership/media-studio') as any)}
                  size="sm"
                />
              ) : undefined}
            />
          </View>
        )}

        <View style={styles.body}>
          {expressionMode && resource.data ? (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: liveStreams.length ? colors.live : colors.borderSubtle }]}>
                <Text style={[styles.summaryNumber, { color: liveStreams.length ? colors.live : colors.text }]}>{liveStreams.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Live now</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.summaryNumber, { color: colors.text }]}>{scheduledStreams.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Upcoming</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.summaryNumber, { color: colors.text }]}>{replays.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Replays</Text>
              </View>
            </View>
          ) : null}

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
                  <SectionHeader title="Broadcasting now" badge={liveStreams.length} subtitle="Current broadcasts inside this Expression." />
                  <HeroLiveCard
                    stream={liveStreams[0]}
                    onPress={() => openStream(liveStreams[0].id)}
                  />
                  {liveStreams.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
                      {liveStreams.slice(1).map((stream) => (
                        <LiveCard key={stream.id} stream={stream} onPress={() => openStream(stream.id)} />
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.sectionWrap}>
                <SectionHeader title="Upcoming" badge={scheduledStreams.length} subtitle="Scheduled and preparing broadcasts." />
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
                    title="No upcoming broadcasts"
                    message="Nothing has been scheduled for this Expression yet."
                    iconName="radio-outline"
                  />
                )}
              </View>

              {replays.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <SectionHeader title="Replays & recordings" badge={replays.length} subtitle="Ended broadcasts stay here while recordings finish processing." />
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
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: { flex: 1, minHeight: 62, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  summaryNumber: { fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.4 },
  summaryLabel: { fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 2 },
  loadingWrapper: { gap: spacing.md },
  sectionWrap: { gap: spacing.sm },
  carouselContainer: { gap: spacing.md, paddingVertical: spacing.xs },
});

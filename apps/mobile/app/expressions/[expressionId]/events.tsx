import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState, EventCard, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Event } from '@/types/content';

type Payload = { events: Event[] };

function timestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCurrentOrUpcoming(event: Event, now: number) {
  const status = event.status?.toLowerCase();
  if (status === 'cancelled' || status === 'completed' || status === 'archived') return false;
  const end = timestamp(event.ends_at);
  return end === null || end > now;
}

function isLiveEvent(event: Event, now: number) {
  const start = timestamp(event.starts_at);
  const end = timestamp(event.ends_at);
  return start !== null && start <= now && (end === null || end > now);
}

function eventRank(event: Event, now: number) {
  const start = timestamp(event.starts_at);
  return {
    bucket: isLiveEvent(event, now) ? 0 : 1,
    time: start ?? Number.MAX_SAFE_INTEGER,
  };
}

export default function ExpressionEventsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';
  const activeExpressionName = context?.expression?.id === id ? context?.expression?.name : undefined;
  const expressionName = activeExpressionName ?? membership?.name ?? 'this Expression';

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (id) params.set('expressionId', id);
    return `home-feed?${params.toString()}`;
  }, [id, organizationId]);

  const resource = useResource<Payload>(
    `expression:events:${organizationId || 'none'}:${id || 'none'}:${mode}`,
    (signal) => api.request<Payload>(path, { signal }),
  );

  const events = useMemo(() => {
    const now = Date.now();
    return [...(resource.data?.events ?? [])]
      .filter((event) => isCurrentOrUpcoming(event, now))
      .sort((a, b) => {
        const left = eventRank(a, now);
        const right = eventRank(b, now);
        return left.bucket - right.bucket || left.time - right.time;
      });
  }, [resource.data?.events]);

  const now = Date.now();
  const liveCount = events.filter((event) => isLiveEvent(event, now)).length;
  const nextEvent = events[0];
  const laterEvents = events.slice(1);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
    >
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.heroTop}>
          <View style={[styles.iconWrap, { backgroundColor: liveCount ? colors.liveSoft : colors.primarySoft }]}>
            <Icon name={liveCount ? 'radio-outline' : 'calendar-outline'} size={22} color={liveCount ? colors.live : colors.interactive} />
          </View>
          <View style={styles.flex}>
            <View style={styles.scopeRow}>
              <Icon name="people-outline" size={11} color={colors.interactive} />
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION CALENDAR</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Events & gatherings</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>
              Meetings, worship moments and activities happening inside {expressionName}.
            </Text>
          </View>
        </View>

        <View style={styles.quickRow}>
          <View style={[styles.countPill, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.countNumber, { color: colors.text }]}>{events.length}</Text>
            <Text style={[styles.countLabel, { color: colors.textMuted }]}>{liveCount ? `${liveCount} live · ${events.length - liveCount} upcoming` : 'upcoming'}</Text>
          </View>
          <Pressable
            onPress={() => router.push(`/expressions/${id}/feed` as any)}
            style={({ pressed }) => [styles.feedButton, { backgroundColor: colors.primarySoft }, pressed ? styles.pressed : null]}
          >
            <Icon name="chatbubbles-outline" size={15} color={colors.interactive} />
            <Text style={[styles.feedButtonText, { color: colors.interactive }]}>Community</Text>
          </Pressable>
        </View>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.stack}><Skeleton height={130} count={4} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : nextEvent ? (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: liveCount ? colors.live : colors.interactive }]}>{liveCount ? 'HAPPENING / NEXT UP' : 'NEXT UP'}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{liveCount ? 'Happening now' : 'Coming soon'}</Text>
            </View>
          </View>
          <View style={[styles.featuredShell, { backgroundColor: colors.card, borderColor: liveCount ? colors.live : colors.interactive }, shadows.sm]}>
            <View style={styles.featuredLabelRow}>
              <View style={[styles.nextPill, { backgroundColor: liveCount ? colors.liveSoft : colors.primarySoft }]}>
                <Icon name={liveCount ? 'radio-outline' : 'time-outline'} size={12} color={liveCount ? colors.live : colors.interactive} />
                <Text style={[styles.nextPillText, { color: liveCount ? colors.live : colors.interactive }]}>{liveCount ? 'LIVE GATHERING' : 'NEXT GATHERING'}</Text>
              </View>
            </View>
            <EventCard
              event={nextEvent}
              onPress={() => router.push(`/expressions/${id}/event/${nextEvent.id}` as any)}
            />
          </View>

          {laterEvents.length ? (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>LATER</Text>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>More on the calendar</Text>
                </View>
              </View>
              <View style={styles.stack}>
                {laterEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPress={() => router.push(`/expressions/${id}/event/${event.id}` as any)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No upcoming Expression events"
          message="New gatherings and activities published for this Expression will appear here with a live countdown."
          iconName="calendar-outline"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingBottom: 80, gap: spacing.lg },
  hero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4, marginTop: 1 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countPill: { flex: 1, minHeight: 40, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  countNumber: { fontSize: 15, fontWeight: '900' },
  countLabel: { flexShrink: 1, fontSize: 11, fontWeight: '700' },
  feedButton: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedButtonText: { fontSize: 11, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.25, marginTop: 2 },
  featuredShell: { borderWidth: 1.5, borderRadius: radius.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs, overflow: 'hidden' },
  featuredLabelRow: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  nextPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextPillText: { fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 0.7 },
  stack: { gap: spacing.md },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});

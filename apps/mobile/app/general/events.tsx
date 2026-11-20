import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, EventCard, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
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
  if (status === 'cancelled' || status === 'archived' || status === 'completed') return false;
  const end = timestamp(event.ends_at);
  return end === null || end > now;
}

function eventRank(event: Event, now: number) {
  const start = timestamp(event.starts_at);
  const end = timestamp(event.ends_at);
  const live = start !== null && start <= now && (end === null || end > now);
  if (live) return { bucket: 0, time: start ?? now };
  return { bucket: 1, time: start ?? Number.MAX_SAFE_INTEGER };
}

export default function GeneralEventsScreen() {
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const organization = context?.organization ?? context?.organizations?.[0];
  const organizationId = organization?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  const resource = useResource<Payload>(
    `general:events:${organizationId || 'auto'}:${mode}`,
    (signal) => {
      const suffix = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
      return api.request<Payload>(`home-feed${suffix}`, { signal, context: 'public' });
    },
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
  const liveCount = events.filter((event) => {
    const start = timestamp(event.starts_at);
    const end = timestamp(event.ends_at);
    return start !== null && start <= now && (end === null || end > now);
  }).length;
  const nextEvent = events[0];
  const laterEvents = events.slice(1);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
      >
        <ScreenHeader
          title="Events"
          kicker="GENERAL COT"
          subtitle="Church-wide gatherings with live countdowns to every start time."
          showBack
        />

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={[styles.summaryIcon, { backgroundColor: liveCount ? colors.liveSoft : colors.primarySoft }]}>
            <Icon name={liveCount ? 'radio-outline' : 'calendar-outline'} size={22} color={liveCount ? colors.live : colors.interactive} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{events.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {liveCount ? `${liveCount} live now · ${events.length - liveCount} upcoming` : 'current and upcoming gatherings'}
            </Text>
          </View>
        </View>

        {resource.loading && !resource.data ? (
          <View style={styles.stack}><Skeleton height={130} count={4} borderRadius={radius.xl} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : nextEvent ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>{liveCount ? 'HAPPENING / NEXT UP' : 'NEXT UP'}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{liveCount ? 'Join what is happening now' : 'Coming up in COT'}</Text>
            </View>

            <View style={[styles.featured, { backgroundColor: colors.bgSecondary, borderColor: liveCount ? colors.live : colors.borderSubtle }]}>
              <EventCard event={nextEvent} onPress={() => router.push(`/general/event/${nextEvent.id}` as any)} />
            </View>

            {laterEvents.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>CALENDAR</Text>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>More gatherings</Text>
                </View>
                <View style={styles.stack}>
                  {laterEvents.map((event) => (
                    <EventCard key={event.id} event={event} onPress={() => router.push(`/general/event/${event.id}` as any)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No upcoming events"
            message="Published church-wide gatherings will appear here with a live countdown when they are scheduled."
            iconName="calendar-outline"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingBottom: 120, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  summaryIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, lineHeight: 26, fontWeight: '900' },
  summaryLabel: { marginTop: 2, fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionHeader: { gap: 2 },
  sectionEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.3 },
  featured: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.xs },
  stack: { gap: spacing.sm },
});

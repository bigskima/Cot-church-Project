import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState, EventCard, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Event } from '@/types/content';

type Payload = {
  events: Event[];
};

export default function ExpressionEventsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';
  const expressionName =
    context?.expression?.id === id
      ? context.expression.name
      : membership?.name ?? 'this Expression';

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

  const events = resource.data?.events ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={resource.refreshing}
          onRefresh={resource.refresh}
          tintColor={colors.interactive}
        />
      }
    >
      <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name="calendar-outline" size={21} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION COMMUNITY</Text>
          <Text style={[styles.title, { color: colors.text }]}>Events</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>
            Gatherings, meetings and activities happening inside {expressionName}.
          </Text>
        </View>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.stack}>
          <Skeleton height={120} count={4} />
        </View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : events.length ? (
        <View style={styles.stack}>
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => router.push(`/expressions/${id}/event/${event.id}` as any)}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No upcoming Expression events"
          message="New gatherings and activities published for this Expression will appear here."
          iconName="calendar-outline"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 80,
    gap: spacing.lg,
  },
  intro: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', marginTop: 1 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  stack: { gap: spacing.md },
});

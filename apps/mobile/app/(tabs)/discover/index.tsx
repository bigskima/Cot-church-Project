import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  EmptyState,
  EventCard,
  ResourceError,
  SearchBar,
  SectionHeader,
  SermonCard,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Event, Sermon, SermonSeries } from '@/types/content';

const publicOrg = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function DiscoverScreen() {
  const { api, mode } = useSession();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'sermons' | 'series' | 'events'>('all');

  const sermons = useResource<Sermon[]>('discover:sermons', (signal) =>
    api.request<Sermon[]>(
      mode === 'authenticated'
        ? 'sermons'
        : `public-content?organizationId=${publicOrg}&type=sermons`,
      { signal }
    )
  );

  const series = useResource<SermonSeries[]>('discover:series', (signal) =>
    api.request<SermonSeries[]>(
      mode === 'authenticated'
        ? 'sermons?series=true'
        : `public-content?organizationId=${publicOrg}&type=series`,
      { signal }
    ).catch(() => [] as SermonSeries[])
  );

  const events = useResource<Event[]>('discover:events', (signal) =>
    api.request<Event[]>(
      mode === 'authenticated'
        ? 'events'
        : `public-content?organizationId=${publicOrg}&type=events`,
      { signal }
    )
  );

  const filteredSermons =
    sermons.data?.filter((s) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.preacher?.toLowerCase().includes(q) ||
        s.scripture_references?.some((ref) => ref.toLowerCase().includes(q))
      );
    }) ?? [];

  const filteredEvents =
    events.data?.filter((e) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.location?.name?.toLowerCase().includes(q);
    }) ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.kicker}>SANCTUARY TEACHINGS & MEDIA</Text>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>
          Explore sermon archives, series teachings, podcasts, and upcoming gatherings.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search by topic, scripture, speaker..."
            dark
          />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {[
            ['all', 'All Content'],
            ['sermons', 'Sermons'],
            ['series', 'Series'],
            ['events', 'Gatherings'],
          ].map(([key, label]) => {
            const isSelected = activeFilter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveFilter(key as any)}
                style={({ pressed }) => [
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.body}>
        {/* Sermon Series Carousel */}
        {(activeFilter === 'all' || activeFilter === 'series') &&
          series.data &&
          series.data.length > 0 && (
            <>
              <SectionHeader title="Teaching Series" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seriesCarousel}>
                {series.data.map((item) => (
                  <View key={item.id} style={[styles.seriesCard, shadows.sm]}>
                    <View style={styles.seriesArtwork}>
                      <Text style={styles.seriesIcon}>✦</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.seriesTitle}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.seriesDescription}>
                      {item.description || 'Spiritual discipleship series'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

        {/* Sermons List */}
        {(activeFilter === 'all' || activeFilter === 'sermons') && (
          <>
            <SectionHeader
              title="Recent Messages"
              badge={filteredSermons.length}
            />

            {sermons.loading ? (
              <View style={styles.loadingList}>
                <Skeleton height={100} />
                <Skeleton height={100} />
                <Skeleton height={100} />
              </View>
            ) : sermons.error && !sermons.data ? (
              <ResourceError
                offline={sermons.offline}
                message={sermons.error}
                retry={sermons.refresh}
              />
            ) : filteredSermons.length > 0 ? (
              filteredSermons.map((sermon) => (
                <SermonCard
                  key={sermon.id}
                  sermon={sermon}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/discover/sermon/[id]',
                      params: { id: sermon.id },
                    })
                  }
                />
              ))
            ) : (
              <EmptyState
                title="No Sermons Found"
                message="Try adjusting your search keywords or topic filter."
                icon="📖"
              />
            )}
          </>
        )}

        {/* Events & Gatherings */}
        {(activeFilter === 'all' || activeFilter === 'events') && (
          <>
            <SectionHeader
              title="Church Gatherings"
              badge={filteredEvents.length}
            />

            {events.loading ? (
              <View style={styles.loadingList}>
                <Skeleton height={80} />
                <Skeleton height={80} />
              </View>
            ) : events.error && !events.data ? (
              <ResourceError
                offline={events.offline}
                message={events.error}
                retry={events.refresh}
              />
            ) : filteredEvents.length > 0 ? (
              filteredEvents.map((event) => <EventCard key={event.id} event={event} />)
            ) : (
              <EmptyState
                title="No Events Scheduled"
                message="Upcoming fellowship and worship gatherings will appear here."
                icon="🗓️"
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
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    backgroundColor: palette.midnight,
    paddingHorizontal: spacing.lg,
    paddingTop: 58,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  kicker: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.white,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#B5C2D5',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },
  searchWrapper: {
    marginTop: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF12',
    borderWidth: 1,
    borderColor: '#FFFFFF1A',
  },
  filterPillActive: {
    backgroundColor: palette.gold,
    borderColor: palette.gold,
  },
  filterPillText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
  },
  filterPillTextActive: {
    color: palette.midnight,
    fontWeight: '900',
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  seriesCarousel: {
    marginBottom: spacing.md,
  },
  seriesCard: {
    width: 170,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
  },
  seriesArtwork: {
    width: '100%',
    height: 100,
    backgroundColor: palette.navy,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  seriesIcon: {
    color: palette.gold,
    fontSize: 28,
  },
  seriesTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.ink,
  },
  seriesDescription: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 2,
  },
  loadingList: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

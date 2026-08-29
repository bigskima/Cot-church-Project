import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  ChurchPickerModal,
  EmptyState,
  EventCard,
  ResourceError,
  SearchBar,
  SectionHeader,
  SermonCard,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { ChurchOrganization, Event, Sermon, SermonSeries } from '@/types/content';

const publicOrg = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function DiscoverScreen() {
  const { api, mode, context } = useSession();
  const { colors, isDark } = useTheme();
  const [selectedChurch, setSelectedChurch] = useState<ChurchOrganization | null>(null);
  const [showChurchPicker, setShowChurchPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'sermons' | 'series' | 'events'>('all');

  const activeOrgId = selectedChurch?.id || publicOrg;
  const publicBase = activeOrgId
    ? `public-content?organizationId=${activeOrgId}`
    : 'public-content';

  const churches = useResource<ChurchOrganization[]>('public:churches', (signal) =>
    api.request<ChurchOrganization[]>('public-content?type=churches', { signal }).catch(() => [])
  );

  const sermons = useResource<Sermon[]>(`discover:sermons:${activeOrgId ?? 'all'}`, (signal) =>
    api.request<Sermon[]>(
      mode === 'authenticated'
        ? 'sermons'
        : `${publicBase}${publicBase.includes('?') ? '&' : '?'}type=sermons`,
      { signal }
    )
  );

  const series = useResource<SermonSeries[]>(`discover:series:${activeOrgId ?? 'all'}`, (signal) =>
    api.request<SermonSeries[]>(
      mode === 'authenticated'
        ? 'sermons?type=series'
        : `${publicBase}${publicBase.includes('?') ? '&' : '?'}type=series`,
      { signal }
    ).catch(() => [] as SermonSeries[])
  );

  const events = useResource<Event[]>(`discover:events:${activeOrgId ?? 'all'}`, (signal) =>
    api.request<Event[]>(
      mode === 'authenticated'
        ? 'events'
        : `${publicBase}${publicBase.includes('?') ? '&' : '?'}type=events`,
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

  const currentChurchName =
    selectedChurch?.name ?? context?.organizations?.[0]?.name ?? 'Global Sanctuary';

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
      >
        {/* Header Banner */}
        <View style={styles.header as any}>
          <View style={styles.topRow as any}>
            <View>
              <Text style={styles.kicker as any}>TEACHINGS & MEDIA ARCHIVE</Text>
              <Text style={styles.title as any}>Discover</Text>
            </View>
            <Pressable
              onPress={() => setShowChurchPicker(true)}
              style={styles.churchSelectorPill as any}
            >
              <Text style={styles.churchSelectorText as any}>🏛️ {currentChurchName}</Text>
              <Text style={styles.churchSelectorChevron as any}>▾</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle as any}>
            Explore sermon archives, series teachings, podcasts, and upcoming gatherings.
          </Text>

          {/* Quick Church Story Link */}
          <Pressable
            onPress={() => router.push('/(tabs)/discover/church-story')}
            style={styles.storyLinkPill as any}
          >
            <Text style={{ fontSize: 13, color: palette.gold, fontWeight: '800' } as any}>
              ✦ Church Story, Heritage & Leadership Directory ›
            </Text>
          </Pressable>

          {/* Search Bar */}
          <View style={styles.searchWrapper as any}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search by topic, scripture, speaker..."
              dark
            />
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow as any}>
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
                  ] as any}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected ? styles.filterPillTextActive : null,
                    ] as any}
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
                <SectionHeader title="Teaching Series" dark={isDark} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seriesCarousel}>
                  {series.data.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.seriesCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        shadows.sm,
                      ] as any}
                    >
                      <View style={styles.seriesArtwork}>
                        <Text style={styles.seriesIcon as any}>✦</Text>
                      </View>
                      <Text numberOfLines={1} style={[styles.seriesTitle, { color: colors.text }] as any}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={[styles.seriesDescription, { color: colors.textMuted }] as any}>
                        {item.description || 'Spiritual teaching series'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

          {/* Sermons List */}
          {(activeFilter === 'all' || activeFilter === 'sermons') && (
            <>
              <SectionHeader title="Sermons & Messages" badge={filteredSermons.length} dark={isDark} />
              {sermons.loading ? (
                <Skeleton height={100} count={3} dark={isDark} />
              ) : sermons.error && !sermons.data ? (
                <ResourceError
                  offline={sermons.offline}
                  message={sermons.error}
                  retry={sermons.refresh}
                  dark={isDark}
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
                  message="Try searching for a different scripture, title, or topic."
                  icon="📖"
                  dark={isDark}
                />
              )}
            </>
          )}

          {/* Gatherings & Events List */}
          {(activeFilter === 'all' || activeFilter === 'events') && (
            <>
              <SectionHeader title="Sanctuary Gatherings" badge={filteredEvents.length} dark={isDark} />
              {events.loading ? (
                <Skeleton height={90} count={2} dark={isDark} />
              ) : filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <EmptyState
                  title="No Scheduled Events"
                  message="New worship services will appear here."
                  icon="🗓️"
                  dark={isDark}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Church Organization Switcher Modal */}
      <ChurchPickerModal
        visible={showChurchPicker}
        onClose={() => setShowChurchPicker(false)}
        churches={churches.data ?? []}
        selectedChurchId={selectedChurch?.id}
        onSelectChurch={(church) => {
          setSelectedChurch(church);
          sermons.refresh();
          events.refresh();
        }}
      />
    </>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 110,
  },
  header: {
    backgroundColor: '#140C07',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.yellow,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFDF9',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  churchSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E1C11',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#452A1A',
    maxWidth: 160,
  },
  churchSelectorText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.yellowLight,
    marginRight: 4,
  },
  churchSelectorChevron: {
    fontSize: 11,
    color: palette.muted,
  },
  subtitle: {
    fontSize: 13,
    color: '#E6CCB2',
    marginTop: 4,
    lineHeight: 18,
  },
  storyLinkPill: {
    backgroundColor: '#2E1C11',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#452A1A',
    marginTop: 10,
    alignSelf: 'flex-start',
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: '#2E1C11',
    borderWidth: 1,
    borderColor: '#452A1A',
  },
  filterPillActive: {
    backgroundColor: palette.yellow,
    borderColor: palette.yellow,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  filterPillTextActive: {
    color: '#140C07',
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  seriesCarousel: {
    marginBottom: spacing.md,
  },
  seriesCard: {
    width: 140,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  seriesArtwork: {
    width: '100%',
    height: 90,
    borderRadius: radius.md,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  seriesIcon: {
    fontSize: 24,
    color: palette.yellow,
  },
  seriesTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  seriesDescription: {
    fontSize: 11,
    marginTop: 2,
  },
});

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Chip,
  ChurchPickerModal,
  EmptyState,
  EventCard,
  Icon,
  ResourceError,
  SearchBar,
  SectionHeader,
  SermonCard,
  Skeleton,
} from '@/components';
import { radius, spacing, typography } from '@/design-system/tokens';
import type { ChurchOrganization, Event, Sermon, SermonSeries } from '@/types/content';

const publicOrg = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
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
    selectedChurch?.name ?? context?.organizations?.[0]?.name;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 100 },
        ]}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View>
              <Text style={[styles.kicker, { color: colors.interactive }]}>CONTENT & COMMUNITY DISCOVERY</Text>
              <Text style={[styles.title, { color: colors.text }]}>Discover</Text>
            </View>
            {churches.data && churches.data.length > 1 ? (
              <Pressable
                onPress={() => setShowChurchPicker(true)}
                style={({ pressed }) => [
                  styles.churchSelectorPill,
                  { backgroundColor: colors.bgSecondary, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="business-outline" size={14} color={colors.interactive} />
                <Text numberOfLines={1} style={[styles.churchSelectorText, { color: colors.text }]}>
                  {currentChurchName || 'All Churches'}
                </Text>
                <Icon name="chevron-down" size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Search Input Bar */}
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search teachings, scriptures, pastors, events..."
            style={{ marginTop: spacing.sm }}
          />

          {/* Filter Chips */}
          <View style={styles.chipsRow}>
            <Chip
              label="All"
              selected={activeFilter === 'all'}
              onPress={() => setActiveFilter('all')}
            />
            <Chip
              label="Sermons"
              selected={activeFilter === 'sermons'}
              onPress={() => setActiveFilter('sermons')}
              count={filteredSermons.length}
            />
            <Chip
              label="Events"
              selected={activeFilter === 'events'}
              onPress={() => setActiveFilter('events')}
              count={filteredEvents.length}
            />
            <Chip
              label="Our Story"
              onPress={() => router.push('/(tabs)/discover/church-story')}
              icon={<Icon name="library-outline" size={13} color={colors.textSecondary} />}
            />
          </View>
        </View>

        {/* Content Feeds */}
        {sermons.loading ? (
          <View style={styles.body}>
            <Skeleton height={140} count={3} />
          </View>
        ) : sermons.error && !sermons.data ? (
          <View style={styles.body}>
            <ResourceError message={sermons.error} retry={sermons.refresh} />
          </View>
        ) : (
          <View style={styles.body}>
            {/* Sermons Section */}
            {(activeFilter === 'all' || activeFilter === 'sermons') && (
              <View style={styles.sectionWrap}>
                <SectionHeader title="Sermons & Expository Series" badge={filteredSermons.length} />
                {filteredSermons.length > 0 ? (
                  filteredSermons.map((sermon) => (
                    <SermonCard
                      key={sermon.id}
                      sermon={sermon}
                      onPress={() => router.push(`/(tabs)/discover/sermon/${sermon.id}`)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No Sermons Found"
                    message={
                      query
                        ? `No teachings matching "${query}". Try another search keyword.`
                        : 'No sermon recordings available for this expression yet.'
                    }
                    iconName="book-outline"
                  />
                )}
              </View>
            )}

            {/* Events Section */}
            {(activeFilter === 'all' || activeFilter === 'events') && (
              <View style={styles.sectionWrap}>
                <SectionHeader title="Upcoming Gatherings" badge={filteredEvents.length} />
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onPress={() => router.push('/(tabs)/discover')}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No Upcoming Events"
                    message={
                      query
                        ? `No events matching "${query}".`
                        : 'No upcoming gatherings currently scheduled.'
                    }
                    iconName="calendar-outline"
                  />
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Church Organization Switcher Modal */}
      <ChurchPickerModal
        visible={showChurchPicker}
        onClose={() => setShowChurchPicker(false)}
        churches={churches.data ?? []}
        selectedChurchId={activeOrgId}
        onSelectChurch={(c) => setSelectedChurch(c)}
      />
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    ...typography.kicker,
  },
  title: {
    ...typography.h1,
    marginTop: 2,
  },
  churchSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 4,
    maxWidth: 160,
  },
  churchSelectorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  sectionWrap: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
});

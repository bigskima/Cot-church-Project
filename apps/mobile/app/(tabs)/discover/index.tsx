import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
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

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const [selectedChurch, setSelectedChurch] = useState<ChurchOrganization | null>(null);
  const [showChurchPicker, setShowChurchPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'sermons' | 'series' | 'events'>('all');

  const contextualOrganization = context?.organization ?? context?.organizations?.[0];
  const activeOrgId = selectedChurch?.id || contextualOrganization?.id || process.env.EXPO_PUBLIC_ORGANIZATION_ID;
  const publicEndpoint = (type: string) => {
    const params = new URLSearchParams({ type });
    if (activeOrgId) params.set('organizationId', activeOrgId);
    return `public-content?${params.toString()}`;
  };

  // Discover is intentionally General Community/public discovery for every viewer.
  // Authentication or Expression membership adds private capabilities elsewhere; it
  // never removes the public catalogue.
  const churches = useResource<ChurchOrganization[]>('public:churches', (signal) =>
    api.request<ChurchOrganization[]>('public-content?type=churches', { signal })
  );

  const sermons = useResource<Sermon[]>(`discover:sermons:${activeOrgId ?? 'all'}`, (signal) =>
    api.request<Sermon[]>(publicEndpoint('sermons'), { signal })
  );

  const series = useResource<SermonSeries[]>(`discover:series:${activeOrgId ?? 'all'}`, (signal) =>
    api.request<SermonSeries[]>(publicEndpoint('series'), { signal })
  );

  const events = useResource<Event[]>(`discover:events:${activeOrgId ?? 'all'}`, (signal) =>
    api.request<Event[]>(publicEndpoint('events'), { signal })
  );

  const filteredSermons = sermons.data?.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.preacher?.toLowerCase().includes(q) ||
      s.scripture_references?.some((ref) => ref.toLowerCase().includes(q))
    );
  }) ?? [];

  const filteredSeries = series.data?.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
  }) ?? [];

  const filteredEvents = events.data?.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.location?.name?.toLowerCase().includes(q);
  }) ?? [];

  const currentChurchName = selectedChurch?.name ?? contextualOrganization?.name;
  const initialLoading = sermons.loading && !sermons.data;
  const primaryError = sermons.error || events.error || series.error;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: 100 }]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.title, { color: colors.text }]}>Discover</Text>
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

          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search teachings, scriptures, pastors, events..."
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.chipsRow}>
            <Chip label="All" selected={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
            <Chip label="Sermons" selected={activeFilter === 'sermons'} onPress={() => setActiveFilter('sermons')} count={filteredSermons.length} />
            <Chip label="Series" selected={activeFilter === 'series'} onPress={() => setActiveFilter('series')} count={filteredSeries.length} />
            <Chip label="Events" selected={activeFilter === 'events'} onPress={() => setActiveFilter('events')} count={filteredEvents.length} />
            <Chip
              label="Our Story"
              onPress={() => router.push('/(tabs)/discover/church-story' as any)}
              icon={<Icon name="library-outline" size={13} color={colors.textSecondary} />}
            />
          </View>
        </View>

        {initialLoading ? (
          <View style={styles.body}><Skeleton height={140} count={3} /></View>
        ) : primaryError && !sermons.data && !events.data && !series.data ? (
          <View style={styles.body}>
            <ResourceError message={primaryError} retry={() => { sermons.refresh(); events.refresh(); series.refresh(); }} />
          </View>
        ) : (
          <View style={styles.body}>
            {(activeFilter === 'all' || activeFilter === 'sermons') && (
              <View style={styles.sectionWrap}>
                <SectionHeader title="Sermons" badge={filteredSermons.length} />
                {filteredSermons.length > 0 ? filteredSermons.map((sermon) => (
                  <SermonCard key={sermon.id} sermon={sermon} onPress={() => router.push(`/(tabs)/discover/sermon/${sermon.id}` as any)} />
                )) : (
                  <EmptyState
                    title="No Sermons Found"
                    message={query ? `No teachings matching "${query}".` : 'No public sermons have been published yet.'}
                    iconName="book-outline"
                  />
                )}
              </View>
            )}

            {(activeFilter === 'all' || activeFilter === 'series') && filteredSeries.length > 0 ? (
              <View style={styles.sectionWrap}>
                <SectionHeader title="Series" badge={filteredSeries.length} />
                {filteredSeries.map((item) => (
                  <Pressable key={item.id} style={[styles.seriesRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.seriesTitle, { color: colors.text }]}>{item.title}</Text>
                      {item.description ? <Text style={[styles.seriesDescription, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {(activeFilter === 'all' || activeFilter === 'events') && (
              <View style={styles.sectionWrap}>
                <SectionHeader title="Upcoming Gatherings" badge={filteredEvents.length} />
                {filteredEvents.length > 0 ? filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} onPress={() => router.push('/(tabs)/discover')} />
                )) : (
                  <EmptyState
                    title="No Upcoming Events"
                    message={query ? `No events matching "${query}".` : 'No public events are currently scheduled.'}
                    iconName="calendar-outline"
                  />
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <ChurchPickerModal
        visible={showChurchPicker}
        onClose={() => setShowChurchPicker(false)}
        churches={churches.data ?? []}
        selectedChurchId={activeOrgId}
        onSelectChurch={(church) => setSelectedChurch(church)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, marginTop: 2 },
  churchSelectorPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, gap: 4, maxWidth: 160 },
  churchSelectorText: { fontSize: 12, fontWeight: '600', flex: 1 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  body: { paddingHorizontal: spacing.lg },
  sectionWrap: { marginBottom: spacing.md, gap: spacing.xs },
  seriesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  seriesTitle: { fontSize: 15, fontWeight: '700' },
  seriesDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  pressed: { opacity: 0.8 },
});

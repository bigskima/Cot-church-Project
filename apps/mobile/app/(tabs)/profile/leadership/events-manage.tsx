import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Event } from '@/types/content';

export default function EventsManageScreen() {
  const { api } = useSession();
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('Main Sanctuary & Online');
  const [capacity, setCapacity] = useState('200');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const events = useResource<Event[]>('leadership:events', (signal) =>
    api.request<Event[]>('events', { signal })
  );

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      setErrorMsg('Please provide a gathering title.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    try {
      await api.request('events', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location: { name: locationName, is_online: true },
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() + 93600000).toISOString(),
          capacity: parseInt(capacity, 10) || null,
          visibility: 'members',
        }),
      });
      setTitle('');
      setDescription('');
      events.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create event.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Events & Gatherings Coordinator"
        subtitle="Schedule sanctuary worship services, configure attendance limits, and track registrations."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Create Event Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ] as any}
        >
          <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }] as any}>
            SCHEDULE NEW GATHERING
          </Text>

          <InputField
            label="Gathering Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Midweek Revival Service, Leaders Encounter..."
            dark={isDark}
          />

          <InputField
            label="Location & Venue"
            value={locationName}
            onChangeText={setLocationName}
            placeholder="e.g. Main Auditorium / Hybrid Online"
            dark={isDark}
          />

          <InputField
            label="Registration Capacity (Optional)"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="numeric"
            placeholder="e.g. 250"
            dark={isDark}
          />

          <InputField
            label="Description & Schedule"
            value={description}
            onChangeText={setDescription}
            placeholder="Keynote speakers, worship team, notes..."
            multiline
            numberOfLines={3}
            dark={isDark}
          />

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <Button
            label="Publish Gathering ➔"
            onPress={handleCreateEvent}
            variant="gold"
            size="lg"
            loading={creating}
            style={{ marginTop: spacing.md } as any}
          />
        </View>

        {/* Existing Events List */}
        <SectionHeader
          title="Active Church Gatherings"
          badge={events.data?.length ?? 0}
          dark={isDark}
        />
        {events.loading ? (
          <Skeleton height={100} count={2} dark={isDark} />
        ) : events.error && !events.data ? (
          <ResourceError
            offline={events.offline}
            message={events.error}
            retry={events.refresh}
            dark={isDark}
          />
        ) : events.data && events.data.length > 0 ? (
          events.data.map((event) => {
            const date = new Date(event.starts_at);
            return (
              <View
                key={event.id}
                style={[
                  styles.eventCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ] as any}
              >
                <View
                  style={[
                    styles.dateBlock,
                    { backgroundColor: isDark ? '#2E1C11' : '#F1E3D3' },
                  ] as any}
                >
                  <Text style={[styles.dateMonth, { color: colors.primaryDark }] as any}>
                    {date.toLocaleString(undefined, { month: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={[styles.dateDay, { color: colors.primaryDark }] as any}>
                    {date.getDate()}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: colors.text }] as any}>{event.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.textMuted }] as any}>
                    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {event.location?.name ?? 'Main Sanctuary'}
                  </Text>
                  <View style={styles.badgeRow}>
                    <Badge label={`Capacity: ${event.capacity ?? 'Open'}`} variant="neutral" />
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            title="No Gatherings Scheduled"
            message="Schedule upcoming worship services and conferences above."
            icon="🗓️"
            dark={isDark}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 4,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  dateBlock: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '900',
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '900',
  },
  eventInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  eventMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 4,
  },
});

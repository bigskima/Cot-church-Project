import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Event } from '@/types/content';

export default function EventsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('Campus Sanctuary');
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

  const list = events.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Events & Gatherings"
          subtitle="Schedule worship services, conferences, and fellowships."
          showBack
        />

        <View style={styles.body}>
          {/* Create Event Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="calendar-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Schedule New Gathering</Text>
            </View>

            {errorMsg ? (
              <View style={[styles.errorBar, { backgroundColor: 'rgba(229, 72, 77, 0.12)' }]}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <InputField
              label="Gathering Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Sunday Celebration Service"
            />

            <InputField
              label="Venue Location"
              value={locationName}
              onChangeText={setLocationName}
              placeholder="e.g. Main Sanctuary / Online Stream"
            />

            <InputField
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder="Provide agenda, guest minister details..."
            />

            <Button
              label="Publish Gathering"
              onPress={handleCreateEvent}
              loading={creating}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Scheduled Gatherings List */}
          <View style={styles.listSection}>
            <SectionHeader title="Published Church Calendar" badge={list.length} />
            {events.loading ? (
              <Skeleton height={80} count={3} />
            ) : events.error && !events.data ? (
              <ResourceError message={events.error} retry={events.refresh} />
            ) : list.length > 0 ? (
              list.map((ev) => (
                <View
                  key={ev.id}
                  style={[styles.eventTile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                >
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{ev.title}</Text>
                    {ev.location?.name ? (
                      <Text style={[styles.eventMeta, { color: colors.interactive }]}>
                        {ev.location.name}
                      </Text>
                    ) : null}
                    {ev.starts_at ? (
                      <Text style={[styles.eventDate, { color: colors.textMuted }]}>
                        {new Date(ev.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label="UPCOMING" variant="primary" />
                </View>
              ))
            ) : (
              <EmptyState
                title="No Events Scheduled"
                message="Use the form above to schedule your first church gathering."
                iconName="calendar-outline"
              />
            )}
          </View>
        </View>
      </ScrollView>
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
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorBar: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  errorText: {
    color: '#E5484D',
    fontSize: 12,
  },
  listSection: {
    gap: spacing.xs,
  },
  eventTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDate: {
    fontSize: 11,
  },
});

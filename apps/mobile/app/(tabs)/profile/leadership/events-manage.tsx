import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  EventCard,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Event } from '@/types/content';

type EventVisibility = 'members' | 'public' | 'private';

function parseLocalDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function EventsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [visibility, setVisibility] = useState<EventVisibility>(expression?.id ? 'members' : 'public');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const events = useResource<Event[]>('leadership:events', (signal) =>
    api.request<Event[]>('events', { signal })
  );

  const list = events.data ?? [];
  const upcomingCount = useMemo(
    () => list.filter((event) => !event.ends_at || Date.parse(event.ends_at) > Date.now()).length,
    [list],
  );

  const resetComposer = () => {
    setTitle('');
    setDescription('');
    setLocationName('');
    setStartsAt('');
    setEndsAt('');
    setCapacity('');
    setIsOnline(false);
    setVisibility(expression?.id ? 'members' : 'public');
    setErrorMsg('');
  };

  const handleCreateEvent = async () => {
    const start = parseLocalDateTime(startsAt);
    const end = parseLocalDateTime(endsAt);
    if (!title.trim()) return setErrorMsg('Enter an event title.');
    if (!start) return setErrorMsg('Enter a valid start date and time.');
    if (!end) return setErrorMsg('Enter a valid end date and time.');
    if (end.getTime() <= start.getTime()) return setErrorMsg('End time must be after the start time.');

    const parsedCapacity = capacity.trim() ? Number(capacity) : null;
    if (parsedCapacity !== null && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)) {
      return setErrorMsg('Capacity must be a positive whole number.');
    }
    if (!isOnline && !locationName.trim()) return setErrorMsg('Add a venue or mark the event as online.');

    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('events', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          visibility,
          location: { name: locationName.trim(), is_online: isOnline },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          capacity: parsedCapacity,
        }),
      });
      resetComposer();
      setComposerOpen(false);
      setSuccessMsg(`Event created${expression?.name ? ` inside ${expression.name}` : ''}.`);
      events.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create event.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader
          title="Events"
          kicker="LEADERSHIP"
          subtitle={expression?.name ? `Manage gatherings inside ${expression.name}.` : 'Manage church-wide gatherings and public events.'}
          showBack
          rightAction={<Button label="New event" onPress={() => setComposerOpen(true)} size="sm" />}
        />

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="calendar-outline" size={22} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{upcomingCount}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Upcoming in this scope</Text>
            </View>
            <Button label="Create" onPress={() => setComposerOpen(true)} variant="secondary" size="sm" />
          </View>

          <View style={styles.listSection}>
            <SectionHeader title="Calendar" badge={list.length} subtitle="Events visible in your current church scope" />
            {events.loading ? (
              <Skeleton height={110} count={3} />
            ) : events.error && !events.data ? (
              <ResourceError message={events.error} retry={events.refresh} />
            ) : list.length ? (
              list.map((event) => (
                <View key={event.id} style={styles.eventWrap}>
                  <EventCard
                    event={event}
                    onPress={() => router.push(`/event/${event.id}${expression?.id ? '?context=expression' : ''}` as any)}
                  />
                  <View style={styles.statusRow}>
                    <Badge label={(event.status || 'draft').toUpperCase()} variant={event.status === 'published' ? 'success' : 'neutral'} />
                    <Text style={[styles.scopeText, { color: colors.textMuted }]}>
                      {event.visibility === 'public' ? 'Public' : event.visibility === 'private' ? 'Private' : 'Members'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No events yet"
                message="Create a gathering when your church or Expression is ready."
                iconName="calendar-outline"
                actionLabel="Create event"
                onAction={() => setComposerOpen(true)}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={composerOpen}
        onClose={() => !creating && setComposerOpen(false)}
        title="Create event"
        subtitle={expression?.name ? `Inside ${expression.name}` : 'Church-wide event'}
        maxHeightPercent={94}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField label="Event title" value={title} onChangeText={setTitle} placeholder="Sunday celebration, conference, prayer night…" />
          <InputField label="Venue" value={locationName} onChangeText={setLocationName} placeholder={isOnline ? 'Optional for online events' : 'Where is it happening?'} />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FORMAT</Text>
          <View style={styles.chips}>
            <Chip label="In person" selected={!isOnline} onPress={() => setIsOnline(false)} />
            <Chip label="Online / hybrid" selected={isOnline} onPress={() => setIsOnline(true)} />
          </View>

          <View style={styles.twoCol}>
            <InputField containerStyle={styles.flex} label="Starts" value={startsAt} onChangeText={setStartsAt} placeholder="2026-09-12 09:00" autoCapitalize="none" />
            <InputField containerStyle={styles.flex} label="Ends" value={endsAt} onChangeText={setEndsAt} placeholder="2026-09-12 12:00" autoCapitalize="none" />
          </View>
          <Text style={[styles.helper, { color: colors.textMuted }]}>Use your local date and time. COT stores the event with your device timezone.</Text>

          <InputField label="Capacity (optional)" value={capacity} onChangeText={setCapacity} placeholder="No limit" keyboardType="number-pad" />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AUDIENCE</Text>
          <View style={styles.chips}>
            <Chip label="Public" selected={visibility === 'public'} onPress={() => setVisibility('public')} />
            <Chip label="Members" selected={visibility === 'members'} onPress={() => setVisibility('members')} />
            <Chip label="Private" selected={visibility === 'private'} onPress={() => setVisibility('private')} />
          </View>

          <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="What should people know about this event?" />

          <Button label="Create event" onPress={() => void handleCreateEvent()} loading={creating} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.xl },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 1 },
  listSection: { gap: spacing.sm },
  eventWrap: { marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -spacing.xs, paddingHorizontal: spacing.xs },
  scopeText: { fontSize: 11, fontWeight: '600' },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  helper: { fontSize: 11, lineHeight: 16, marginTop: -spacing.sm },
});

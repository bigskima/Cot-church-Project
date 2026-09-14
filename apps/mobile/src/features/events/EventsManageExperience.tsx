import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedUpload, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Event } from '@/types/content';

type EventWithBanner = Event & { banner_url?: string | null };
type EventVisibility = 'members' | 'public' | 'private';
type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed' | 'archived';
type BannerUploadIntent = { signedUploadUrl: string; publicUrl: string };

function safeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export default function EventsManageExperience() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const expressionWorkspace = pathname.startsWith('/expressions/');
  const { api, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canCreate = hasCapability('events.create');
  const canUpdate = hasCapability('events.update');

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithBanner | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [visibility, setVisibility] = useState<EventVisibility>(expression?.id ? 'members' : 'public');
  const [status, setStatus] = useState<EventStatus>('draft');
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const events = useResource<EventWithBanner[]>(
    `leadership:events:${organizationId || 'none'}:${expression?.id ?? 'general'}`,
    (signal) => api.request<EventWithBanner[]>('events', { signal }),
  );
  const list = events.data ?? [];
  const upcomingCount = useMemo(() => list.filter((event) => Date.parse(event.ends_at) > Date.now()).length, [list]);

  const resetComposer = () => {
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setLocationName('');
    setStartsAt(null);
    setEndsAt(null);
    setCapacity('');
    setIsOnline(false);
    setVisibility(expression?.id ? 'members' : 'public');
    setStatus('draft');
    setBannerFile(null);
    setErrorMsg('');
  };

  const openCreate = () => {
    if (!canCreate) return;
    resetComposer();
    const start = defaultStart();
    setStartsAt(start);
    setEndsAt(new Date(start.getTime() + 2 * 60 * 60 * 1000));
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const openEdit = (event: EventWithBanner) => {
    if (!canUpdate) return;
    setEditingEvent(event);
    setTitle(event.title ?? '');
    setDescription(event.description ?? '');
    setLocationName(event.location?.name ?? '');
    setStartsAt(safeDate(event.starts_at));
    setEndsAt(safeDate(event.ends_at));
    setCapacity(event.capacity ? String(event.capacity) : '');
    setIsOnline(event.location?.is_online === true);
    setVisibility(['members', 'public', 'private'].includes(event.visibility) ? event.visibility as EventVisibility : 'members');
    setStatus(['draft', 'published', 'cancelled', 'completed', 'archived'].includes(event.status ?? '') ? event.status as EventStatus : 'draft');
    setBannerFile(null);
    setErrorMsg('');
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const chooseBanner = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setErrorMsg('Allow photo-library access to choose an event banner.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return setErrorMsg('Choose a JPG, PNG, or WebP banner.');
    setBannerFile({ uri: asset.uri, name: asset.fileName || `event-banner-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const handleSaveEvent = async () => {
    if (editingEvent ? !canUpdate : !canCreate) return;
    if (!title.trim()) return setErrorMsg('Enter an event title.');
    if (!startsAt) return setErrorMsg('Choose a start date and time.');
    if (!endsAt) return setErrorMsg('Choose an end date and time.');
    if (endsAt.getTime() <= startsAt.getTime()) return setErrorMsg('End time must be after the start time.');
    if (!isOnline && !locationName.trim()) return setErrorMsg('Add a venue or mark the event as online.');
    const parsedCapacity = capacity.trim() ? Number(capacity) : null;
    if (parsedCapacity !== null && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)) return setErrorMsg('Capacity must be a positive whole number.');

    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let bannerUrl = editingEvent?.banner_url ?? null;
      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('events', {
          method: 'POST',
          body: JSON.stringify({ action: 'create_banner_upload', mimeType: bannerFile.mimeType }),
        });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        bannerUrl = intent.publicUrl;
      }
      const payload = {
        title: title.trim(),
        description: description.trim(),
        visibility,
        location: { name: locationName.trim(), is_online: isOnline },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity: parsedCapacity,
        bannerUrl,
      };
      const wasEditing = Boolean(editingEvent);
      await api.request('events', {
        method: wasEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(wasEditing ? { id: editingEvent!.id, status, ...payload } : payload),
      });
      setComposerOpen(false);
      resetComposer();
      setSuccessMsg(wasEditing ? 'Event updated.' : `Event created${expression?.name ? ` inside ${expression.name}` : ''}.`);
      events.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to save event.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm, paddingBottom: expressionWorkspace ? insets.bottom + spacing.xl : insets.bottom + 120 }]}>
        {!expressionWorkspace ? <ScreenHeader title="Events" kicker="LEADERSHIP" subtitle="Publish schedules with a proper date picker and optional flyer/banner." showBack rightAction={canCreate ? <Button label="New event" onPress={openCreate} size="sm" /> : undefined} /> : null}
        <View style={styles.body}>
          {successMsg ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text></View> : null}
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}><Icon name="calendar-outline" size={22} color={colors.interactive} /></View>
            <View style={styles.flex}><Text style={[styles.summaryValue, { color: colors.text }]}>{upcomingCount}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Upcoming events</Text></View>
            {canCreate ? <Button label="Create" onPress={openCreate} variant="secondary" size="sm" /> : null}
          </View>
          <View style={styles.listSection}>
            <SectionHeader title="Calendar" badge={list.length} subtitle="Gatherings and events in this space" />
            {events.loading ? <Skeleton height={110} count={3} /> : events.error && !events.data ? <ResourceError message={events.error} retry={events.refresh} /> : list.length ? list.map((event) => (
              <View key={event.id} style={styles.eventWrap}>
                {event.banner_url ? <Image source={{ uri: event.banner_url }} style={styles.listBanner} resizeMode="cover" /> : null}
                <EventCard event={event} onPress={() => router.push((expression?.id ? `/expressions/${expression.id}/event/${event.id}` : `/general/event/${event.id}`) as any)} />
                <View style={styles.statusRow}><View style={styles.statusMeta}><Badge label={(event.status || 'draft').toUpperCase()} variant={event.status === 'published' ? 'success' : 'neutral'} /><Text style={[styles.scopeText, { color: colors.textMuted }]}>{event.visibility === 'public' ? 'Public' : event.visibility === 'private' ? 'Private' : 'Members'}</Text></View>{canUpdate ? <Button label="Edit" onPress={() => openEdit(event)} variant="outline" size="sm" /> : null}</View>
              </View>
            )) : <EmptyState title="No events yet" message={canCreate ? 'Create a gathering when your church or Expression is ready.' : 'Events will appear here when they’re created.'} iconName="calendar-outline" actionLabel={canCreate ? 'Create event' : undefined} onAction={canCreate ? openCreate : undefined} />}
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={composerOpen} onClose={() => { if (!creating) { setComposerOpen(false); resetComposer(); } }} title={editingEvent ? 'Edit event' : 'Create event'} subtitle={editingEvent ? editingEvent.title : expression?.name ? `Inside ${expression.name}` : 'Church-wide event'} maxHeightPercent={96}>
        <View style={styles.form}>
          {errorMsg ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}
          <InputField label="Event title" value={title} onChangeText={setTitle} placeholder="Sunday celebration, conference, prayer night…" />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EVENT FLYER / BANNER (OPTIONAL)</Text>
          <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            {bannerFile?.uri || editingEvent?.banner_url ? <Image source={{ uri: bannerFile?.uri || editingEvent?.banner_url! }} style={styles.bannerPreview} resizeMode="cover" /> : <View style={[styles.imagePlaceholder, { backgroundColor: colors.primarySoft }]}><Icon name="image-outline" size={26} color={colors.interactive} /></View>}
            <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>Choose image</Text><Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Use a flyer or 16:9 banner. The schedule still displays even when no image is added.</Text></View>
          </Pressable>
          <InputField label="Venue" value={locationName} onChangeText={setLocationName} placeholder={isOnline ? 'Optional for online events' : 'Where is it happening?'} />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FORMAT</Text>
          <View style={styles.chips}><Chip label="In person" selected={!isOnline} onPress={() => setIsOnline(false)} /><Chip label="Online / hybrid" selected={isOnline} onPress={() => setIsOnline(true)} /></View>
          <DateTimeField label="Starts" value={startsAt} onChange={(date) => { setStartsAt(date); if (!endsAt || endsAt <= date) setEndsAt(new Date(date.getTime() + 2 * 60 * 60 * 1000)); }} helperText="Choose from the calendar/time controls; no date typing needed." />
          <DateTimeField label="Ends" value={endsAt} onChange={setEndsAt} />
          <InputField label="Capacity (optional)" value={capacity} onChangeText={setCapacity} placeholder="No limit" keyboardType="number-pad" />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AUDIENCE</Text>
          <View style={styles.chips}><Chip label="Public" selected={visibility === 'public'} onPress={() => setVisibility('public')} /><Chip label="Members" selected={visibility === 'members'} onPress={() => setVisibility('members')} /><Chip label="Private" selected={visibility === 'private'} onPress={() => setVisibility('private')} /></View>
          <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="What should people know about this event?" />
          {editingEvent ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text><View style={styles.chips}><Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} /><Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} /><Chip label="Completed" selected={status === 'completed'} onPress={() => setStatus('completed')} /><Chip label="Cancelled" selected={status === 'cancelled'} onPress={() => setStatus('cancelled')} /><Chip label="Archived" selected={status === 'archived'} onPress={() => setStatus('archived')} /></View></> : null}
          <Button label={editingEvent ? 'Save changes' : 'Create event'} onPress={() => void handleSaveEvent()} loading={creating} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.xl }, flex: { flex: 1, minWidth: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg }, summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }, summaryValue: { fontSize: 22, fontWeight: '800' }, summaryLabel: { fontSize: 12 },
  listSection: { gap: spacing.sm }, eventWrap: { marginBottom: spacing.sm }, listBanner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.xl, marginBottom: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.xs }, statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }, scopeText: { fontSize: 11, fontWeight: '600' },
  form: { gap: spacing.md }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadCard: { minHeight: 86, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, bannerPreview: { width: 112, aspectRatio: 16 / 9, borderRadius: radius.md }, imagePlaceholder: { width: 76, height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, uploadTitle: { fontSize: 12, fontWeight: '800' }, uploadHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
});

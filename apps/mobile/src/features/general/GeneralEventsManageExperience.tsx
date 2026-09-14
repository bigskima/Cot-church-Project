import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
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
  ProgressiveFlow,
  type ProgressiveFlowStep,
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

const STEPS: ProgressiveFlowStep[] = [
  { key: 'details', label: 'Details', hint: 'Name the gathering and describe it.', icon: 'create-outline' },
  { key: 'schedule', label: 'Schedule', hint: 'Set when and where it happens.', icon: 'calendar-outline' },
  { key: 'audience', label: 'Audience', hint: 'Choose visibility and capacity.', icon: 'people-outline' },
  { key: 'review', label: 'Review', hint: 'Confirm everything before saving.', icon: 'checkmark-circle-outline' },
];

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

export default function GeneralEventsManageExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canCreate = hasOrganizationCapability('events.create');
  const canUpdate = hasOrganizationCapability('events.update');

  const events = useResource<EventWithBanner[]>(
    `general:ministry:events:${organizationId || 'none'}`,
    (signal) => api.request<EventWithBanner[]>('events', { signal }),
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<EventWithBanner | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [status, setStatus] = useState<EventStatus>('draft');
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const list = events.data ?? [];
  const upcomingCount = useMemo(() => list.filter((event) => Date.parse(event.ends_at) > Date.now()).length, [list]);
  const publishedCount = useMemo(() => list.filter((event) => event.status === 'published').length, [list]);

  const reset = () => {
    setStep(0);
    setEditing(null);
    setTitle('');
    setDescription('');
    setLocationName('');
    setStartsAt(null);
    setEndsAt(null);
    setCapacity('');
    setIsOnline(false);
    setVisibility('public');
    setStatus('draft');
    setBannerFile(null);
    setError('');
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    reset();
  };

  const openCreate = () => {
    if (!canCreate) return;
    reset();
    const start = defaultStart();
    setStartsAt(start);
    setEndsAt(new Date(start.getTime() + 2 * 60 * 60 * 1000));
    setSuccess('');
    setOpen(true);
  };

  const openEdit = (event: EventWithBanner) => {
    if (!canUpdate) return;
    setEditing(event);
    setTitle(event.title ?? '');
    setDescription(event.description ?? '');
    setLocationName(event.location?.name ?? '');
    setStartsAt(safeDate(event.starts_at));
    setEndsAt(safeDate(event.ends_at));
    setCapacity(event.capacity ? String(event.capacity) : '');
    setIsOnline(event.location?.is_online === true);
    setVisibility(['members', 'public', 'private'].includes(event.visibility) ? event.visibility as EventVisibility : 'public');
    setStatus(['draft', 'published', 'cancelled', 'completed', 'archived'].includes(event.status ?? '') ? event.status as EventStatus : 'draft');
    setBannerFile(null);
    setError('');
    setSuccess('');
    setStep(0);
    setOpen(true);
  };

  const chooseBanner = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo-library access to choose an event banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      setError('Choose a JPG, PNG, or WebP banner.');
      return;
    }
    setBannerFile({ uri: asset.uri, name: asset.fileName || `event-banner-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const parsedCapacity = () => capacity.trim() ? Number(capacity) : null;

  const canContinue = () => {
    if (step === 0) return Boolean(title.trim());
    if (step === 1) return Boolean(startsAt && endsAt && endsAt.getTime() > startsAt.getTime() && (isOnline || locationName.trim()));
    if (step === 2) {
      const value = parsedCapacity();
      return value === null || (Number.isInteger(value) && value > 0);
    }
    return true;
  };

  const next = () => {
    setError('');
    if (!canContinue()) {
      setError(step === 0 ? 'Add an event title to continue.' : step === 1 ? 'Check the date, time and venue before continuing.' : 'Capacity must be a positive whole number.');
      return;
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const save = async () => {
    if (editing ? !canUpdate : !canCreate) return;
    if (!title.trim()) {
      setError('Enter an event title.');
      setStep(0);
      return;
    }
    if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
      setError('Choose a valid start and end time.');
      setStep(1);
      return;
    }
    if (!isOnline && !locationName.trim()) {
      setError('Add a venue or mark the event as online.');
      setStep(1);
      return;
    }
    const capacityValue = parsedCapacity();
    if (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 1)) {
      setError('Capacity must be a positive whole number.');
      setStep(2);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let bannerUrl = editing?.banner_url ?? null;
      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('events', { method: 'POST', body: JSON.stringify({ action: 'create_banner_upload', mimeType: bannerFile.mimeType }) });
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
        capacity: capacityValue,
        bannerUrl,
      };
      await api.request('events', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing ? { id: editing.id, status, ...payload } : payload),
      });
      setOpen(false);
      setSuccess(editing ? 'Event updated.' : 'Event created.');
      reset();
      events.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 0) return (
      <View style={styles.stepBody}>
        <InputField label="Event title" value={title} onChangeText={setTitle} placeholder="Sunday celebration, conference, prayer night…" />
        <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={5} placeholder="What should people know about this gathering?" />
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EVENT FLYER / BANNER</Text>
        <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          {bannerFile?.uri || editing?.banner_url ? <Image source={{ uri: bannerFile?.uri || editing?.banner_url! }} style={styles.bannerPreview} resizeMode="cover" /> : <View style={[styles.imagePlaceholder, { backgroundColor: colors.primarySoft }]}><Icon name="image-outline" size={25} color={colors.interactive} /></View>}
          <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>Choose image</Text><Text style={[styles.uploadHint, { color: colors.textMuted }]}>Optional flyer or 16:9 banner.</Text></View><Icon name="chevron-forward" size={17} color={colors.textMuted} />
        </Pressable>
      </View>
    );
    if (step === 1) return (
      <View style={styles.stepBody}>
        <DateTimeField label="Starts" value={startsAt} onChange={(date) => { setStartsAt(date); if (!endsAt || endsAt <= date) setEndsAt(new Date(date.getTime() + 2 * 60 * 60 * 1000)); }} helperText="Choose from the calendar and time controls." />
        <DateTimeField label="Ends" value={endsAt} onChange={setEndsAt} />
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FORMAT</Text>
        <View style={styles.chips}><Chip label="In person" selected={!isOnline} onPress={() => setIsOnline(false)} /><Chip label="Online / hybrid" selected={isOnline} onPress={() => setIsOnline(true)} /></View>
        <InputField label="Venue" value={locationName} onChangeText={setLocationName} placeholder={isOnline ? 'Optional for online events' : 'Where is it happening?'} />
      </View>
    );
    if (step === 2) return (
      <View style={styles.stepBody}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AUDIENCE</Text>
        <View style={styles.chips}><Chip label="Public" selected={visibility === 'public'} onPress={() => setVisibility('public')} /><Chip label="Members" selected={visibility === 'members'} onPress={() => setVisibility('members')} /><Chip label="Private" selected={visibility === 'private'} onPress={() => setVisibility('private')} /></View>
        <InputField label="Capacity (optional)" value={capacity} onChangeText={setCapacity} placeholder="No limit" keyboardType="number-pad" />
        {editing ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text><View style={styles.chips}><Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} /><Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} /><Chip label="Completed" selected={status === 'completed'} onPress={() => setStatus('completed')} /><Chip label="Cancelled" selected={status === 'cancelled'} onPress={() => setStatus('cancelled')} /><Chip label="Archived" selected={status === 'archived'} onPress={() => setStatus('archived')} /></View></> : null}
      </View>
    );
    return (
      <View style={styles.stepBody}>
        <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.reviewTop}><View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}><Icon name="calendar-outline" size={20} color={colors.interactive} /></View><Badge label={(editing ? status : 'NEW EVENT').toUpperCase()} variant={status === 'published' ? 'success' : 'neutral'} /></View>
          <Text style={[styles.reviewTitle, { color: colors.text }]}>{title || 'Untitled event'}</Text>
          {startsAt && endsAt ? <Text style={[styles.reviewMeta, { color: colors.interactive }]}>{startsAt.toLocaleString()} → {endsAt.toLocaleString()}</Text> : null}
          <Text style={[styles.reviewMeta, { color: colors.textSecondary }]}>{isOnline ? 'Online / hybrid' : locationName || 'Venue not set'} · {visibility}</Text>
          <Text style={[styles.reviewBody, { color: colors.textSecondary }]} numberOfLines={5}>{description || 'No description added.'}</Text>
          <Text style={[styles.reviewMeta, { color: colors.textMuted }]}>{capacity.trim() ? `Capacity ${capacity}` : 'No capacity limit'} · {bannerFile || editing?.banner_url ? 'Banner attached' : 'No banner'}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader title="Events" kicker="MINISTRY · CONTENT" subtitle="Build gatherings in focused steps: details, schedule, audience and review." showBack rightAction={canCreate ? <Button label="New event" onPress={openCreate} size="sm" /> : undefined} />
        <View style={styles.body}>
          {success ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{success}</Text></View> : null}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{upcomingCount}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Upcoming</Text></View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{publishedCount}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Published</Text></View>
          </View>
          <SectionHeader title="Calendar" badge={list.length} subtitle="Church-wide gatherings and schedules" />
          {events.loading ? <Skeleton height={110} count={3} /> : events.error && !events.data ? <ResourceError message={events.error} retry={events.refresh} /> : list.length ? list.map((event) => (
            <View key={event.id} style={styles.eventWrap}>
              {event.banner_url ? <Image source={{ uri: event.banner_url }} style={styles.listBanner} resizeMode="cover" /> : null}
              <EventCard event={event} variant="row" onPress={() => router.push(`/general/event/${event.id}` as any)} />
              <View style={styles.statusRow}><View style={styles.statusMeta}><Badge label={(event.status || 'draft').toUpperCase()} variant={event.status === 'published' ? 'success' : 'neutral'} /><Text style={[styles.scopeText, { color: colors.textMuted }]}>{event.visibility === 'public' ? 'Public' : event.visibility === 'private' ? 'Private' : 'Members'}</Text></View>{canUpdate ? <Button label="Edit" onPress={() => openEdit(event)} variant="outline" size="sm" /> : null}</View>
            </View>
          )) : <EmptyState title="No events yet" message={canCreate ? 'Create a gathering and move through a focused four-step flow.' : 'Events will appear here when they are created.'} iconName="calendar-outline" actionLabel={canCreate ? 'Create event' : undefined} onAction={canCreate ? openCreate : undefined} />}
        </View>
      </ScrollView>

      <BottomSheet visible={open} onClose={close} title={editing ? 'Edit event' : 'Create event'} subtitle="General COT · Church-wide gathering" maxHeightPercent={96}>
        {error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}
        <ProgressiveFlow steps={STEPS} currentStep={step} onStepChange={setStep} onBack={step === 0 ? close : () => setStep((value) => Math.max(0, value - 1))} onNext={next} onComplete={() => void save()} canContinue={canContinue()} busy={saving} completeLabel={editing ? 'Save changes' : 'Create event'}>
          {renderStep()}
        </ProgressiveFlow>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, summaryValue: { fontSize: 24, lineHeight: 29, fontWeight: '900' }, summaryLabel: { fontSize: 10.5, marginTop: 2 },
  eventWrap: { marginBottom: spacing.md }, listBanner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.xl, marginBottom: spacing.xs }, statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: -spacing.xs, paddingHorizontal: spacing.xs }, statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }, scopeText: { fontSize: 10.5, fontWeight: '700' },
  stepBody: { gap: spacing.md }, fieldLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadCard: { minHeight: 84, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, bannerPreview: { width: 100, aspectRatio: 16 / 9, borderRadius: radius.md }, imagePlaceholder: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }, uploadTitle: { fontSize: 12.5, fontWeight: '900' }, uploadHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reviewIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reviewTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3 }, reviewMeta: { fontSize: 10.5, lineHeight: 16, fontWeight: '700' }, reviewBody: { fontSize: 12, lineHeight: 18 },
});

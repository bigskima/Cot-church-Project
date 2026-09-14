import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
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

type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'cancelled' | 'archived';
type Announcement = {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  scheduled_for?: string | null;
  published_at?: string | null;
  banner_url?: string | null;
};
type BannerUploadIntent = { signedUploadUrl: string; publicUrl: string };

const STEPS: ProgressiveFlowStep[] = [
  { key: 'message', label: 'Message', hint: 'Write the official update clearly.', icon: 'megaphone-outline' },
  { key: 'visual', label: 'Visual', hint: 'Add an optional flyer or banner.', icon: 'image-outline' },
  { key: 'delivery', label: 'Delivery', hint: 'Save, schedule or publish.', icon: 'notifications-outline' },
  { key: 'review', label: 'Review', hint: 'Confirm the announcement before sending.', icon: 'checkmark-circle-outline' },
];

function safeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function GeneralAnnouncementsManageExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canManage = hasOrganizationCapability('announcements.manage');
  const resource = useResource<Announcement[]>(
    `general:ministry:announcements:${organizationId || 'none'}`,
    (signal) => canManage ? api.request<Announcement[]>('announcements', { signal }) : Promise.resolve([]),
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<AnnouncementStatus>('draft');
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const list = resource.data ?? [];
  const publishedCount = useMemo(() => list.filter((item) => item.status === 'published').length, [list]);
  const scheduledCount = useMemo(() => list.filter((item) => item.status === 'scheduled').length, [list]);

  const reset = () => {
    setStep(0);
    setEditing(null);
    setTitle('');
    setBody('');
    setStatus('draft');
    setScheduledFor(null);
    setBannerFile(null);
    setError('');
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    reset();
  };

  const openCreate = () => {
    if (!canManage) return;
    reset();
    setSuccess('');
    setOpen(true);
  };

  const openEdit = (item: Announcement) => {
    if (!canManage) return;
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setStatus(item.status);
    setScheduledFor(safeDate(item.scheduled_for));
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
      setError('Allow photo-library access to choose an announcement banner.');
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
    setBannerFile({ uri: asset.uri, name: asset.fileName || `announcement-banner-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const canContinue = () => {
    if (step === 0) return Boolean(title.trim() && body.trim());
    if (step === 2 && status === 'scheduled') return Boolean(scheduledFor && scheduledFor.getTime() > Date.now());
    return true;
  };

  const next = () => {
    setError('');
    if (!canContinue()) {
      setError(step === 0 ? 'Add both a title and the announcement message.' : 'Choose a future date and time before continuing.');
      return;
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const save = async () => {
    if (!canManage) return;
    if (!title.trim() || !body.trim()) {
      setError('Add both a title and the announcement message.');
      setStep(0);
      return;
    }
    if (status === 'scheduled' && (!scheduledFor || scheduledFor.getTime() <= Date.now())) {
      setError('Choose a future time for a scheduled announcement.');
      setStep(2);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let bannerUrl = editing?.banner_url ?? null;
      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('announcements', { method: 'POST', body: JSON.stringify({ action: 'create_banner_upload', mimeType: bannerFile.mimeType }) });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        bannerUrl = intent.publicUrl;
      }

      const publishNow = status === 'published';
      const persistedStatus: AnnouncementStatus = publishNow ? 'draft' : status;
      const payload = {
        title: title.trim(),
        body: body.trim(),
        branchId: null,
        audience: {},
        channels: ['in_app', 'push'],
        status: persistedStatus,
        scheduledFor: status === 'scheduled' ? scheduledFor?.toISOString() : null,
        bannerUrl,
      };

      let saved = editing
        ? await api.request<Announcement>('announcements', { method: 'PATCH', body: JSON.stringify({ id: editing.id, ...payload }) })
        : await api.request<Announcement>('announcements', { method: 'POST', body: JSON.stringify(payload) });

      if (publishNow) saved = await api.request<Announcement>('announcements', { method: 'POST', body: JSON.stringify({ action: 'publish', id: saved.id }) });

      setOpen(false);
      setSuccess(saved.status === 'published' ? 'Announcement published and notifications prepared.' : saved.status === 'scheduled' ? `Announcement scheduled for ${new Date(saved.scheduled_for || scheduledFor!).toLocaleString()}.` : editing ? 'Announcement updated.' : 'Announcement draft saved.');
      reset();
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 0) return (
      <View style={styles.stepBody}>
        <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Important update" />
        <InputField label="Message" value={body} onChangeText={setBody} multiline numberOfLines={8} placeholder="What does everyone need to know?" />
      </View>
    );
    if (step === 1) return (
      <View style={styles.stepBody}>
        <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          {bannerFile?.uri || editing?.banner_url ? <Image source={{ uri: bannerFile?.uri || editing?.banner_url! }} style={styles.bannerPreview} /> : <View style={[styles.imagePlaceholder, { backgroundColor: colors.primarySoft }]}><Icon name="image-outline" size={25} color={colors.interactive} /></View>}
          <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>Flyer or banner</Text><Text style={[styles.uploadHint, { color: colors.textMuted }]}>Optional. The announcement stays fully readable without an image.</Text></View><Icon name="chevron-forward" size={17} color={colors.textMuted} />
        </Pressable>
      </View>
    );
    if (step === 2) return (
      <View style={styles.stepBody}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DELIVERY</Text>
        <View style={styles.chips}>
          <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
          <Chip label="Schedule" selected={status === 'scheduled'} onPress={() => { setStatus('scheduled'); if (!scheduledFor) setScheduledFor(new Date(Date.now() + 60 * 60 * 1000)); }} />
          <Chip label="Publish now" selected={status === 'published'} onPress={() => setStatus('published')} />
        </View>
        {status === 'scheduled' ? <DateTimeField label="Publish at" value={scheduledFor} onChange={setScheduledFor} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 2} helperText="The announcement will publish automatically at or shortly after this time." /> : null}
        <View style={[styles.deliveryNote, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="notifications-outline" size={18} color={colors.interactive} /><Text style={[styles.deliveryText, { color: colors.textSecondary }]}>Publishing continues to use the existing COT notification fan-out, so members can open the official announcement directly.</Text></View>
      </View>
    );
    return (
      <View style={styles.stepBody}>
        <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.reviewTop}><View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}><Icon name="megaphone-outline" size={20} color={colors.interactive} /></View><Badge label={status === 'published' ? 'PUBLISH NOW' : status.toUpperCase()} variant={status === 'published' ? 'success' : status === 'scheduled' ? 'active' : 'neutral'} /></View>
          <Text style={[styles.reviewTitle, { color: colors.text }]}>{title || 'Untitled announcement'}</Text>
          <Text style={[styles.reviewBody, { color: colors.textSecondary }]} numberOfLines={6}>{body || 'No message yet.'}</Text>
          {status === 'scheduled' && scheduledFor ? <Text style={[styles.reviewMeta, { color: colors.interactive }]}>Scheduled · {scheduledFor.toLocaleString()}</Text> : null}
          <Text style={[styles.reviewMeta, { color: colors.textMuted }]}>{bannerFile || editing?.banner_url ? 'Visual attached' : 'Text-only announcement'}</Text>
        </View>
      </View>
    );
  };

  if (!canManage) {
    return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}><ScreenHeader title="Announcements" kicker="MINISTRY" showBack /><View style={styles.body}><EmptyState title="Announcement publishing is unavailable" message="Only authorized roles can draft, schedule and publish official General COT announcements." iconName="lock-closed-outline" /></View></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader title="Announcements" kicker="MINISTRY · CONTENT" subtitle="Move from message to delivery in a short, focused publishing flow." showBack rightAction={<Button label="New" onPress={openCreate} size="sm" />} />
        <View style={styles.body}>
          {success ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{success}</Text></View> : null}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryNumber, { color: colors.text }]}>{publishedCount}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Published</Text></View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryNumber, { color: colors.text }]}>{scheduledCount}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Scheduled</Text></View>
          </View>
          <SectionHeader title="Announcement library" badge={list.length} subtitle="Church-wide official updates" />
          {resource.loading ? <Skeleton height={124} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : list.length ? list.map((item) => (
            <Pressable key={item.id} onPress={() => openEdit(item)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}>
              {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.cardBanner} resizeMode="cover" /> : null}
              <View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.status === 'scheduled' && item.scheduled_for ? `Scheduled ${new Date(item.scheduled_for).toLocaleString()}` : item.published_at ? `Published ${new Date(item.published_at).toLocaleDateString()}` : 'Draft'}</Text></View><Badge label={item.status.toUpperCase()} variant={item.status === 'published' ? 'success' : item.status === 'scheduled' ? 'active' : 'neutral'} /></View>
              <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={4}>{item.body}</Text>
            </Pressable>
          )) : <EmptyState title="No announcements yet" message="Create an official update when the whole church needs to know something." iconName="megaphone-outline" actionLabel="Create announcement" onAction={openCreate} />}
        </View>
      </ScrollView>

      <BottomSheet visible={open} onClose={close} title={editing ? 'Edit announcement' : 'New announcement'} subtitle="General COT · Official update" maxHeightPercent={96}>
        {error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}
        <ProgressiveFlow steps={STEPS} currentStep={step} onStepChange={setStep} onBack={step === 0 ? close : () => setStep((value) => Math.max(0, value - 1))} onNext={next} onComplete={() => void save()} canContinue={canContinue()} busy={saving} completeLabel={status === 'published' ? 'Publish announcement' : status === 'scheduled' ? 'Schedule announcement' : editing ? 'Save changes' : 'Save draft'}>
          {renderStep()}
        </ProgressiveFlow>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, summaryNumber: { fontSize: 24, lineHeight: 29, fontWeight: '900' }, summaryLabel: { fontSize: 10.5, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, overflow: 'hidden' }, cardBanner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' }, cardMeta: { fontSize: 10.5, marginTop: 2 }, cardBody: { fontSize: 12, lineHeight: 18 },
  stepBody: { gap: spacing.md }, fieldLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadCard: { minHeight: 84, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, bannerPreview: { width: 100, aspectRatio: 16 / 9, borderRadius: radius.md }, imagePlaceholder: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }, uploadTitle: { fontSize: 12.5, fontWeight: '900' }, uploadHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  deliveryNote: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, deliveryText: { flex: 1, fontSize: 11, lineHeight: 16 },
  reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reviewIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reviewTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3 }, reviewBody: { fontSize: 12, lineHeight: 19 }, reviewMeta: { fontSize: 10.5, fontWeight: '700' }, pressed: { opacity: 0.84 },
});

import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
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
import { MinistryImageGenerator } from '@/features/ministry/MinistryImageGenerator';

type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'cancelled' | 'archived';
type Announcement = {
  id: string;
  organization_id?: string;
  branch_id?: string | null;
  title: string;
  body: string;
  status: AnnouncementStatus;
  audience?: Record<string, unknown>;
  channels?: string[];
  scheduled_for?: string | null;
  published_at?: string | null;
  banner_url?: string | null;
  created_at?: string | null;
};
type BannerUploadIntent = { signedUploadUrl: string; publicUrl: string };

function safeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function AnnouncementsManageExperience() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const expressionWorkspace = pathname.startsWith('/expressions/');
  const { api, context, hasCapability, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canManage = expressionWorkspace ? hasCapability('announcements.manage') : hasOrganizationCapability('announcements.manage');

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<AnnouncementStatus>('draft');
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [generatedBannerUrl, setGeneratedBannerUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resource = useResource<Announcement[]>(
    `leadership:announcements:${organizationId || 'none'}:${expression?.id ?? 'general'}`,
    (signal) => {
      if (!canManage) return Promise.resolve([]);
      const suffix = expression?.id ? `?branchId=${encodeURIComponent(expression.id)}` : '';
      return api.request<Announcement[]>(`announcements${suffix}`, { signal });
    },
  );

  const list = resource.data ?? [];
  const publishedCount = useMemo(() => list.filter((item) => item.status === 'published').length, [list]);

  const reset = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setStatus('draft');
    setScheduledFor(null);
    setBannerFile(null);
    setGeneratedBannerUrl('');
    setErrorMsg('');
  };

  const openCreate = () => {
    if (!canManage) return;
    reset();
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const openEdit = (item: Announcement) => {
    if (!canManage) return;
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setStatus(item.status);
    setScheduledFor(safeDate(item.scheduled_for));
    setBannerFile(null);
    setGeneratedBannerUrl('');
    setErrorMsg('');
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const chooseBanner = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setErrorMsg('Allow photo-library access to choose an announcement banner.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return setErrorMsg('Choose a JPG, PNG, or WebP banner.');
    setGeneratedBannerUrl('');
    setBannerFile({ uri: asset.uri, name: asset.fileName || `announcement-banner-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const save = async () => {
    if (!canManage) return;
    if (!title.trim()) return setErrorMsg('Enter an announcement title.');
    if (!body.trim()) return setErrorMsg('Add the announcement message.');
    if (status === 'scheduled' && !scheduledFor) return setErrorMsg('Choose when this announcement should be published.');
    if (status === 'scheduled' && scheduledFor && scheduledFor.getTime() <= Date.now()) return setErrorMsg('Choose a future time for a scheduled announcement.');

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let bannerUrl = generatedBannerUrl || editing?.banner_url || null;
      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('announcements', {
          method: 'POST',
          body: JSON.stringify({ action: 'create_banner_upload', mimeType: bannerFile.mimeType }),
        });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        bannerUrl = intent.publicUrl;
      }

      const wantsPublishNow = status === 'published';
      const persistedStatus: AnnouncementStatus = wantsPublishNow ? 'draft' : status;
      const payload = {
        title: title.trim(),
        body: body.trim(),
        branchId: expression?.id ?? null,
        audience: {},
        channels: ['in_app', 'push'],
        status: persistedStatus,
        scheduledFor: status === 'scheduled' ? scheduledFor?.toISOString() : null,
        bannerUrl,
      };

      let saved: Announcement;
      if (editing) {
        saved = await api.request<Announcement>('announcements', {
          method: 'PATCH',
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
      } else {
        saved = await api.request<Announcement>('announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (wantsPublishNow) {
        saved = await api.request<Announcement>('announcements', {
          method: 'POST',
          body: JSON.stringify({ action: 'publish', id: saved.id }),
        });
      }

      setComposerOpen(false);
      reset();
      setSuccessMsg(
        saved.status === 'published'
          ? 'Announcement published and member notifications prepared.'
          : saved.status === 'scheduled'
            ? `Announcement scheduled for ${new Date(saved.scheduled_for || scheduledFor!).toLocaleString()}.`
            : editing
              ? 'Announcement updated.'
              : 'Announcement draft saved.',
      );
      resource.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm }]}>
        {!expressionWorkspace ? <ScreenHeader title="Announcements" kicker="LEADERSHIP" showBack /> : null}
        <View style={styles.body}><EmptyState title="Announcement publishing is unavailable" message="Only authorized roles can draft, schedule and publish official announcements in this space." iconName="lock-closed-outline" /></View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm, paddingBottom: expressionWorkspace ? insets.bottom + spacing.xl : insets.bottom + 120 }]}>
        {!expressionWorkspace ? <ScreenHeader title="Announcements" kicker="LEADERSHIP" subtitle="Draft, schedule or publish official updates with an optional flyer." showBack rightAction={<Button label="New" onPress={openCreate} size="sm" />} /> : null}
        <View style={styles.body}>
          {successMsg ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{successMsg}</Text></View> : null}
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}><Icon name="megaphone-outline" size={22} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.summaryNumber, { color: colors.text }]}>{publishedCount}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Published announcements</Text></View><Button label="Create" onPress={openCreate} variant="secondary" size="sm" /></View>
          <View style={styles.section}><SectionHeader title="Announcement library" badge={list.length} subtitle={expression?.name ? `Official updates for ${expression.name}` : 'Church-wide official updates'} />
            {resource.loading ? <Skeleton height={124} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : list.length ? list.map((item) => (
              <Pressable key={item.id} onPress={() => openEdit(item)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.cardBanner} resizeMode="cover" /> : null}
                <View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.status === 'scheduled' && item.scheduled_for ? `Scheduled ${new Date(item.scheduled_for).toLocaleString()}` : item.published_at ? `Published ${new Date(item.published_at).toLocaleDateString()}` : 'Draft'}</Text></View><Badge label={item.status.toUpperCase()} variant={item.status === 'published' ? 'success' : item.status === 'scheduled' ? 'active' : 'neutral'} /></View>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={4}>{item.body}</Text>
              </Pressable>
            )) : <EmptyState title="No announcements yet" message="Create an official announcement when there is something the church or this Expression needs to know." iconName="megaphone-outline" actionLabel="Create announcement" onAction={openCreate} />}
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={composerOpen} onClose={() => { if (!saving) { setComposerOpen(false); reset(); } }} title={editing ? 'Edit announcement' : 'New announcement'} subtitle={expression?.name ? `Inside ${expression.name}` : 'General COT'} maxHeightPercent={96}>
        <View style={styles.form}>
          {errorMsg ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{errorMsg}</Text></View> : null}
          <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Important update" />
          <InputField label="Message" value={body} onChangeText={setBody} multiline numberOfLines={6} placeholder="What does everyone need to know?" />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FLYER / BANNER (OPTIONAL)</Text>
          <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>{bannerFile?.uri || generatedBannerUrl || editing?.banner_url ? <Image source={{ uri: bannerFile?.uri || generatedBannerUrl || editing?.banner_url! }} style={styles.bannerPreview} /> : <View style={[styles.imagePlaceholder, { backgroundColor: colors.primarySoft }]}><Icon name="image-outline" size={25} color={colors.interactive} /></View>}<View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>Choose flyer or banner</Text><Text style={[styles.uploadHint, { color: colors.textSecondary }]}>JPG, PNG or WebP. The text announcement remains readable without an image.</Text></View></Pressable>
          <MinistryImageGenerator
            organizationId={organizationId}
            branchId={expression?.id ?? null}
            useCase="announcement_banner"
            title={title}
            description={body}
            currentImageUrl={bannerFile?.uri || generatedBannerUrl || editing?.banner_url}
            onGenerated={(url) => { setBannerFile(null); setGeneratedBannerUrl(url); }}
            onUploadInstead={() => void chooseBanner()}
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DELIVERY</Text>
          <View style={styles.chips}><Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} /><Chip label="Schedule" selected={status === 'scheduled'} onPress={() => { setStatus('scheduled'); if (!scheduledFor) setScheduledFor(new Date(Date.now() + 60 * 60 * 1000)); }} /><Chip label="Publish now" selected={status === 'published'} onPress={() => setStatus('published')} /></View>
          {status === 'scheduled' ? <DateTimeField label="Publish at" value={scheduledFor} onChange={setScheduledFor} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 2} helperText="COT will publish the announcement automatically at or shortly after this time." /> : null}
          <View style={[styles.deliveryNote, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="notifications-outline" size={17} color={colors.interactive} /><Text style={[styles.deliveryText, { color: colors.textSecondary }]}>Publishing uses the existing COT announcement fan-out so in-app notifications stay tied to the official announcement record.</Text></View>
          <Button label={status === 'published' ? 'Publish announcement' : status === 'scheduled' ? 'Schedule announcement' : editing ? 'Save changes' : 'Save draft'} onPress={() => void save()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.xl }, flex: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  summary: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, summaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, summaryNumber: { fontSize: 21, fontWeight: '900' }, summaryLabel: { fontSize: 11.5 },
  section: { gap: spacing.sm }, card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, overflow: 'hidden' }, cardBanner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' }, cardMeta: { fontSize: 10.5, marginTop: 2 }, cardBody: { fontSize: 12, lineHeight: 18 },
  form: { gap: spacing.md }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadCard: { minHeight: 84, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, bannerPreview: { width: 112, aspectRatio: 16 / 9, borderRadius: radius.md }, imagePlaceholder: { width: 76, height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, uploadTitle: { fontSize: 12, fontWeight: '800' }, uploadHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  deliveryNote: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, deliveryText: { flex: 1, fontSize: 11, lineHeight: 16 },
});

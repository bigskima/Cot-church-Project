import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
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
  SermonCard,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { MinistryImageGenerator } from '@/features/ministry/MinistryImageGenerator';
import type { Sermon } from '@/types/content';
import { SermonRichEditor } from '@/features/media/SermonRichEditor';
import {
  newSermonBlock,
  parseSermonMarkdown,
  sermonBlocksToMarkdown,
  sermonBlocksToPlainText,
  sermonExcerpt,
  type SermonRichBlock,
} from '@/features/media/sermon-rich-content';

type ContentUploadIntent = { uploadSession: { assetId: string; signedUploadUrl: string } };
type BannerUploadIntent = { signedUploadUrl: string; publicUrl: string };

const STEPS: ProgressiveFlowStep[] = [
  { key: 'basics', label: 'Basics', hint: 'Title, speaker and scriptures.', icon: 'create-outline' },
  { key: 'message', label: 'Message', hint: 'Build the sermon in readable sections.', icon: 'document-text-outline' },
  { key: 'media', label: 'Media', hint: 'Add the banner and optional audio.', icon: 'images-outline' },
  { key: 'review', label: 'Review', hint: 'Choose the status and confirm before saving.', icon: 'checkmark-circle-outline' },
];

function normalizeAudioMime(name: string, supplied?: string | null) {
  const value = supplied?.toLowerCase().split(';')[0]?.trim();
  if (value === 'audio/x-m4a' || value === 'audio/m4a') return 'audio/mp4';
  if (value === 'audio/mp3') return 'audio/mpeg';
  if (value === 'audio/x-wav') return 'audio/wav';
  if (value && ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'].includes(value)) return value;
  const lower = name.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}

export default function GeneralSermonsManageExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canCreate = hasOrganizationCapability('sermons.create');
  const canManage = hasOrganizationCapability('sermons.manage');
  const canPublish = hasOrganizationCapability('sermons.publish');

  const sermons = useResource<Sermon[]>(
    `general:ministry:sermons:${organizationId || 'none'}`,
    (signal) => api.request<Sermon[]>('sermons?view=manage', { signal }),
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<Sermon | null>(null);
  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [blocks, setBlocks] = useState<SermonRichBlock[]>([newSermonBlock()]);
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [generatedBannerUrl, setGeneratedBannerUrl] = useState('');
  const [audioFile, setAudioFile] = useState<UploadFile | null>(null);
  const [status, setStatus] = useState<Sermon['status']>('draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const list = sermons.data ?? [];
  const publishedCount = useMemo(() => list.filter((item) => item.status === 'published').length, [list]);
  const draftCount = useMemo(() => list.filter((item) => item.status !== 'published').length, [list]);

  const reset = () => {
    setStep(0);
    setEditing(null);
    setTitle('');
    setPreacher('');
    setScripture('');
    setBlocks([newSermonBlock()]);
    setBannerFile(null);
    setGeneratedBannerUrl('');
    setAudioFile(null);
    setStatus('draft');
    setError('');
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const openCreate = () => {
    if (!canCreate) return;
    reset();
    setSuccess('');
    setOpen(true);
  };

  const openEdit = (sermon: Sermon) => {
    if (!canManage) return;
    setEditing(sermon);
    setTitle(sermon.title ?? '');
    setPreacher(sermon.preacher ?? sermon.preacher_name ?? '');
    setScripture((sermon.scripture_references ?? []).join(', '));
    setBlocks(parseSermonMarkdown(sermon.transcript || sermon.description));
    setBannerFile(null);
    setGeneratedBannerUrl('');
    setAudioFile(null);
    setStatus(sermon.status ?? 'draft');
    setError('');
    setSuccess('');
    setStep(0);
    setOpen(true);
  };

  const chooseBanner = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo-library access to choose a sermon banner.');
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
    setGeneratedBannerUrl('');
    setBannerFile({ uri: asset.uri, name: asset.fileName || `sermon-banner-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const chooseAudio = async () => {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/*'], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    if ((asset.size ?? 0) > 200 * 1024 * 1024) {
      setError('Choose an audio recording that is 200 MB or smaller.');
      return;
    }
    const mimeType = normalizeAudioMime(asset.name, asset.mimeType);
    setAudioFile({ uri: asset.uri, name: asset.name, mimeType, size: asset.size, file: (asset as any).file });
  };

  const currentCanContinue = () => {
    if (step === 0) return Boolean(title.trim() && preacher.trim());
    if (step === 1) return Boolean(sermonBlocksToPlainText(blocks).trim() || audioFile || editing?.audio_asset_id);
    if (step === 2) return Boolean(bannerFile || generatedBannerUrl || editing?.thumbnail_url);
    return true;
  };

  const next = () => {
    setError('');
    if (!currentCanContinue()) {
      setError(step === 0 ? 'Add a sermon title and speaker to continue.' : step === 1 ? 'Add sermon text or attach an audio recording.' : 'Choose a 16:9 sermon banner to continue.');
      return;
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const save = async () => {
    if (editing ? !canManage : !canCreate) return;
    if (!title.trim() || !preacher.trim()) {
      setError('Enter both a sermon title and speaker.');
      setStep(0);
      return;
    }
    if (!bannerFile && !generatedBannerUrl && !editing?.thumbnail_url) {
      setError('Choose a 16:9 banner for this sermon.');
      setStep(2);
      return;
    }
    const cleanBlocks = blocks.map((block) => ({ ...block, text: block.text.trim() })).filter((block) => block.text.length > 0);
    if (!sermonBlocksToPlainText(cleanBlocks).length && !audioFile && !editing?.audio_asset_id) {
      setError('Add sermon text or attach an audio recording.');
      setStep(1);
      return;
    }
    if ((status === 'published' || status === 'scheduled') && !canPublish) {
      setError('Publishing isn’t available for this account.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      let thumbnailUrl = generatedBannerUrl || editing?.thumbnail_url || null;
      let audioAssetId = editing?.audio_asset_id ?? null;

      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('sermons', { method: 'POST', body: JSON.stringify({ action: 'create_banner_upload', mimeType: bannerFile.mimeType }) });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        thumbnailUrl = intent.publicUrl;
      }

      if (audioFile) {
        const audioBody = await readUploadFile(audioFile);
        const intent = await api.request<ContentUploadIntent>('content-media', {
          method: 'POST',
          body: JSON.stringify({ action: 'create_upload_intent', mediaType: 'audio', mimeType: audioFile.mimeType, expressionId: null, fileSizeBytes: audioBody.size, fileName: audioFile.name }),
        });
        await putSignedUpload(intent.uploadSession.signedUploadUrl, { ...audioFile, file: audioBody });
        await api.request('content-media', { method: 'POST', body: JSON.stringify({ action: 'complete_upload', assetId: intent.uploadSession.assetId }) });
        audioAssetId = intent.uploadSession.assetId;
      }

      const payload = {
        title: title.trim(),
        preacher: preacher.trim(),
        scriptures: scripture.split(',').map((item) => item.trim()).filter(Boolean),
        description: sermonExcerpt(cleanBlocks),
        transcript: sermonBlocksToMarkdown(cleanBlocks),
        thumbnailUrl,
        audioAssetId,
      };
      await api.request<Sermon>('sermons', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing ? { id: editing.id, ...payload, ...(status !== editing.status ? { status } : {}) } : { ...payload, status }),
      });

      setOpen(false);
      setSuccess(editing ? 'Sermon updated.' : status === 'published' ? 'Sermon published.' : status === 'review' ? 'Sermon saved for review.' : 'Sermon draft created.');
      reset();
      sermons.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save sermon.');
    } finally {
      setBusy(false);
    }
  };

  const renderStep = () => {
    if (step === 0) return (
      <View style={styles.stepBody}>
        <InputField label="Sermon title" value={title} onChangeText={setTitle} placeholder="Walking in divine alignment" />
        <InputField label="Speaker" value={preacher} onChangeText={setPreacher} placeholder="Pastor / minister name" />
        <InputField label="Scripture references" value={scripture} onChangeText={setScripture} placeholder="Romans 8:28, Hebrews 11:1" helperText="Separate multiple passages with commas." />
      </View>
    );
    if (step === 1) return <SermonRichEditor blocks={blocks} onChange={setBlocks} disabled={busy} />;
    if (step === 2) return (
      <View style={styles.stepBody}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SERMON BANNER</Text>
        <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          {bannerFile?.uri || generatedBannerUrl || editing?.thumbnail_url ? <Image source={{ uri: bannerFile?.uri || generatedBannerUrl || editing?.thumbnail_url! }} style={styles.bannerPreview} /> : <View style={[styles.mediaIcon, { backgroundColor: colors.primarySoft }]}><Icon name="image-outline" size={25} color={colors.interactive} /></View>}
          <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>Choose 16:9 banner</Text><Text style={[styles.uploadHint, { color: colors.textMuted }]}>Used on sermon cards and the reading screen.</Text></View><Icon name="chevron-forward" size={17} color={colors.textMuted} />
        </Pressable>
        <MinistryImageGenerator
          organizationId={organizationId}
          useCase="sermon_artwork"
          title={title}
          description={[scripture, sermonExcerpt(blocks)].filter(Boolean).join(' · ')}
          context={{ scripture, excerpt: sermonExcerpt(blocks), speaker: preacher }}
          currentImageUrl={bannerFile?.uri || generatedBannerUrl || editing?.thumbnail_url}
          onGenerated={(url) => { setBannerFile(null); setGeneratedBannerUrl(url); }}
          onUploadInstead={() => void chooseBanner()}
        />
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>OPTIONAL AUDIO</Text>
        <Pressable onPress={() => void chooseAudio()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <View style={[styles.mediaIcon, { backgroundColor: colors.primarySoft }]}><Icon name={audioFile || editing?.audio_asset_id ? 'checkmark-circle-outline' : 'headset-outline'} size={24} color={colors.interactive} /></View>
          <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>{audioFile ? 'Audio selected' : editing?.audio_asset_id ? 'Audio recording attached' : 'Attach sermon audio'}</Text><Text style={[styles.uploadHint, { color: colors.textMuted }]}>Listeners can use the original recording or Read Aloud. File names stay private.</Text></View><Icon name="chevron-forward" size={17} color={colors.textMuted} />
        </Pressable>
      </View>
    );
    return (
      <View style={styles.stepBody}>
        <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.reviewKicker, { color: colors.interactive }]}>READY TO SAVE</Text>
          <Text style={[styles.reviewTitle, { color: colors.text }]}>{title || 'Untitled sermon'}</Text>
          <Text style={[styles.reviewMeta, { color: colors.textSecondary }]}>{preacher || 'No speaker'}{scripture.trim() ? ` · ${scripture}` : ''}</Text>
          <View style={styles.reviewChecklist}>
            <ReviewLine label="Structured message" ready={Boolean(sermonBlocksToPlainText(blocks).trim())} />
            <ReviewLine label="16:9 banner" ready={Boolean(bannerFile || generatedBannerUrl || editing?.thumbnail_url)} />
            <ReviewLine label="Audio" ready={Boolean(audioFile || editing?.audio_asset_id)} optional />
          </View>
        </View>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PUBLISHING STATUS</Text>
        <View style={styles.chips}>
          <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
          <Chip label="Review" selected={status === 'review'} onPress={() => setStatus('review')} />
          {editing ? <Chip label="Archived" selected={status === 'archived'} onPress={() => setStatus('archived')} /> : null}
          {canPublish ? <Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} /> : null}
        </View>
      </View>
    );
  };

  const ReviewLine = ({ label, ready, optional = false }: { label: string; ready: boolean; optional?: boolean }) => (
    <View style={styles.reviewLine}><Icon name={ready ? 'checkmark-circle' : optional ? 'remove-circle-outline' : 'alert-circle-outline'} size={17} color={ready ? colors.success : colors.textMuted} /><Text style={[styles.reviewLineText, { color: colors.textSecondary }]}>{label}{optional ? ' · optional' : ''}</Text></View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader title="Sermons" kicker="MINISTRY · CONTENT" subtitle="Create church-wide teachings in focused steps instead of one long publishing form." showBack rightAction={canCreate ? <Button label="New sermon" onPress={openCreate} size="sm" /> : undefined} />
        <View style={styles.body}>
          {success ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{success}</Text></View> : null}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{publishedCount}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Published</Text></View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{draftCount}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Draft / review</Text></View>
          </View>
          <SectionHeader title="Sermon library" badge={list.length} subtitle="Published messages open publicly. Draft and review messages open directly in the editor." />
          {sermons.loading ? <Skeleton height={104} count={3} /> : sermons.error && !sermons.data ? <ResourceError message={sermons.error} retry={sermons.refresh} /> : list.length ? list.map((sermon) => (
            <View key={sermon.id} style={styles.sermonWrap}>
              <SermonCard sermon={sermon} variant="row" onPress={() => sermon.status === 'published' ? router.push(`/general/sermon/${sermon.id}` as any) : canManage ? openEdit(sermon) : undefined} />
              <View style={styles.statusRow}><View style={styles.statusMeta}><Badge label={(sermon.status || 'draft').toUpperCase()} variant={sermon.status === 'published' ? 'success' : 'neutral'} /><Text style={[styles.scopeText, { color: colors.textMuted }]}>General COT</Text></View>{canManage ? <Button label="Edit" onPress={() => openEdit(sermon)} variant="outline" size="sm" /> : null}</View>
            </View>
          )) : <EmptyState title="No sermons yet" message={canCreate ? 'Start a sermon and move through Basics, Message, Media and Review.' : 'Published teachings will appear here.'} iconName="book-outline" actionLabel={canCreate ? 'Create sermon' : undefined} onAction={canCreate ? openCreate : undefined} />}
        </View>
      </ScrollView>

      <BottomSheet visible={open} onClose={close} title={editing ? 'Edit sermon' : 'Create sermon'} subtitle={editing ? editing.title : 'General COT · Church-wide'} maxHeightPercent={96}>
        {error ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text></View> : null}
        <ProgressiveFlow steps={STEPS} currentStep={step} onStepChange={setStep} onBack={step === 0 ? close : () => setStep((value) => Math.max(0, value - 1))} onNext={next} onComplete={() => void save()} canContinue={currentCanContinue()} busy={busy} completeLabel={editing ? 'Save changes' : status === 'published' ? 'Publish sermon' : 'Save sermon'}>
          {renderStep()}
        </ProgressiveFlow>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }, bannerText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, summaryValue: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 }, summaryLabel: { fontSize: 10.5, marginTop: 2 },
  sermonWrap: { marginBottom: spacing.sm }, statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: -spacing.xs, paddingHorizontal: spacing.xs }, statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }, scopeText: { fontSize: 10.5, fontWeight: '700' },
  stepBody: { gap: spacing.md }, fieldLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadCard: { minHeight: 76, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, mediaIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, bannerPreview: { width: 92, aspectRatio: 16 / 9, borderRadius: radius.md }, uploadTitle: { fontSize: 12.5, fontWeight: '900' }, uploadHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs }, reviewKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 }, reviewTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35 }, reviewMeta: { fontSize: 11, lineHeight: 16 }, reviewChecklist: { gap: spacing.xs, marginTop: spacing.sm }, reviewLine: { flexDirection: 'row', alignItems: 'center', gap: 7 }, reviewLineText: { fontSize: 11.5, fontWeight: '700' },
});
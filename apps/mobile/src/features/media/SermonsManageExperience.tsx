import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, usePathname } from 'expo-router';
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
  SermonCard,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedResumableUpload, putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { MinistryImageGenerator } from '@/features/ministry/MinistryImageGenerator';
import type { Sermon } from '@/types/content';
import { SermonRichEditor } from './SermonRichEditor';
import {
  newSermonBlock,
  parseSermonMarkdown,
  sermonBlocksToMarkdown,
  sermonBlocksToPlainText,
  sermonExcerpt,
  type SermonRichBlock,
} from './sermon-rich-content';

type ContentUploadIntent = { uploadSession: { assetId: string; signedUploadUrl: string; uploadToken?: string; storagePath: string } };
type BannerUploadIntent = { signedUploadUrl: string; publicUrl: string };

export default function SermonsManageExperience() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const expressionWorkspace = pathname.startsWith('/expressions/');
  const { api, context, hasCapability, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);
  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [blocks, setBlocks] = useState<SermonRichBlock[]>([newSermonBlock()]);
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [generatedBannerUrl, setGeneratedBannerUrl] = useState('');
  const [audioFile, setAudioFile] = useState<UploadFile | null>(null);
  const [videoFile, setVideoFile] = useState<UploadFile | null>(null);
  const [status, setStatus] = useState<Sermon['status']>('draft');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ label: string; percent: number } | null>(null);

  const expressionScope = Boolean(expression?.id);
  const canCreate = expressionScope ? hasCapability('expression.pastor_messages.create') : hasOrganizationCapability('pastor_messages.create');
  const canManage = expressionScope ? hasCapability('expression.pastor_messages.manage') : hasOrganizationCapability('pastor_messages.manage');
  const canPublish = expressionScope ? hasCapability('expression.pastor_messages.publish') : hasOrganizationCapability('pastor_messages.publish');

  const sermons = useResource<Sermon[]>(
    `leadership:pastor-messages:${organizationId || 'none'}:${expression?.id ?? 'general'}`,
    (signal) => api.request<Sermon[]>('sermons?view=manage&pastorMessages=true', { signal }),
  );

  const list = sermons.data ?? [];
  const publishedCount = useMemo(() => list.filter((sermon) => sermon.status === 'published').length, [list]);

  const resetComposer = () => {
    setEditingSermon(null);
    setTitle('');
    setPreacher('');
    setScripture('');
    setBlocks([newSermonBlock()]);
    setBannerFile(null);
    setGeneratedBannerUrl('');
    setAudioFile(null);
    setVideoFile(null);
    setStatus('draft');
    setErrorMsg('');
    setUploadProgress(null);
  };

  const chooseBanner = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMsg('Allow photo-library access to choose a sermon banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      setErrorMsg('Choose a JPG, PNG, or WebP banner.');
      return;
    }
    setGeneratedBannerUrl('');
    setBannerFile({
      uri: asset.uri,
      name: asset.fileName || `sermon-banner-${Date.now()}.jpg`,
      mimeType,
      size: asset.fileSize,
      file: (asset as any).file,
    });
  };

  const chooseAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav'],
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || (asset.name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4');
    if ((asset.size ?? 0) > 100 * 1024 * 1024) {
      setErrorMsg('Choose an audio recording that is 100 MB or smaller.');
      return;
    }
    setAudioFile({ uri: asset.uri, name: asset.name, mimeType, size: asset.size, file: (asset as any).file });
  };

  const chooseVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['video/mp4', 'video/webm', 'video/quicktime'],
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase()
      || (asset.name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : asset.name.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4');
    if ((asset.size ?? 0) > 100 * 1024 * 1024) {
      setErrorMsg('Choose a video recording that is 100 MB or smaller.');
      return;
    }
    setVideoFile({ uri: asset.uri, name: asset.name, mimeType, size: asset.size, file: (asset as any).file });
  };

  const openCreate = () => {
    if (!canCreate) return;
    resetComposer();
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const openEdit = (sermon: Sermon) => {
    if (!canManage) return;
    setEditingSermon(sermon);
    setTitle(sermon.title ?? '');
    setPreacher(sermon.preacher ?? sermon.preacher_name ?? '');
    setScripture((sermon.scripture_references ?? []).join(', '));
    setBlocks(parseSermonMarkdown(sermon.transcript || sermon.description));
    setStatus(sermon.status ?? 'draft');
    setBannerFile(null);
    setAudioFile(null);
    setVideoFile(null);
    setErrorMsg('');
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const handleSaveSermon = async () => {
    if (editingSermon ? !canManage : !canCreate) return;
    if (!title.trim() || !preacher.trim()) {
      setErrorMsg('Enter both a message title and speaker.');
      return;
    }
    if (!bannerFile && !generatedBannerUrl && !editingSermon?.thumbnail_url) {
      setErrorMsg('Choose a 16:9 banner for this message.');
      return;
    }

    const cleanBlocks = blocks
      .map((block) => ({ ...block, text: block.text.trim() }))
      .filter((block) => block.text.length > 0);
     if (!audioFile && !editingSermon?.audio_asset_id && !videoFile && !editingSermon?.video_asset_id) {
      setErrorMsg('Attach at least one audio or video recording.');
      return;
    }
    if ((status === 'published' || status === 'scheduled') && !canPublish) {
      setErrorMsg('Publishing isn’t available for this account.');
      return;
    }

    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const scriptures = scripture.split(',').map((item) => item.trim()).filter(Boolean);
      let thumbnailUrl = generatedBannerUrl || editingSermon?.thumbnail_url || null;
      let audioAssetId = editingSermon?.audio_asset_id ?? null;
      let videoAssetId = editingSermon?.video_asset_id ?? null;

      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('sermons', {
          method: 'POST',
          body: JSON.stringify({ action: 'create_banner_upload', purpose: 'pastor_message', mimeType: bannerFile.mimeType }),
        });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        thumbnailUrl = intent.publicUrl;
      }

      if (audioFile) {
        setUploadProgress({ label: 'Uploading audio', percent: 0 });
        const audioBody = await readUploadFile(audioFile);
        const intent = await api.request<ContentUploadIntent>('content-media', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_upload_intent',
            purpose: 'pastor_message',
            mediaType: 'audio',
            mimeType: audioFile.mimeType,
            expressionId: expression?.id ?? null,
            fileSizeBytes: audioBody.size,
            fileName: audioFile.name,
          }),
        });
        await putSignedResumableUpload(
          {
            signedUploadUrl: intent.uploadSession.signedUploadUrl,
            uploadToken: intent.uploadSession.uploadToken,
            storagePath: intent.uploadSession.storagePath,
            bucketName: 'content-media',
          },
          { ...audioFile, file: audioBody },
          (uploaded, total) => setUploadProgress({ label: 'Uploading audio', percent: Math.round((uploaded / total) * 100) }),
        );
        await api.request('content-media', {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_upload', assetId: intent.uploadSession.assetId }),
        });
        audioAssetId = intent.uploadSession.assetId;
      }

      if (videoFile) {
        setUploadProgress({ label: 'Uploading video', percent: 0 });
        const videoBody = await readUploadFile(videoFile);
        const intent = await api.request<ContentUploadIntent>('content-media', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_upload_intent',
            purpose: 'pastor_message',
            mediaType: 'video',
            mimeType: videoFile.mimeType,
            expressionId: expression?.id ?? null,
            fileSizeBytes: videoBody.size,
            fileName: videoFile.name,
          }),
        });
        await putSignedResumableUpload(
          {
            signedUploadUrl: intent.uploadSession.signedUploadUrl,
            uploadToken: intent.uploadSession.uploadToken,
            storagePath: intent.uploadSession.storagePath,
            bucketName: 'content-media',
          },
          { ...videoFile, file: videoBody },
          (uploaded, total) => setUploadProgress({ label: 'Uploading video', percent: Math.round((uploaded / total) * 100) }),
        );
        await api.request('content-media', {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_upload', assetId: intent.uploadSession.assetId }),
        });
        videoAssetId = intent.uploadSession.assetId;
      }

      setUploadProgress(null);
      const basePayload = {
        title: title.trim(),
        preacher: preacher.trim(),
        scriptures,
        description: sermonExcerpt(cleanBlocks),
        transcript: sermonBlocksToMarkdown(cleanBlocks),
        thumbnailUrl,
        audioAssetId,
        videoAssetId,
        isPastorMessage: true,
      };
      const isEditing = Boolean(editingSermon);
      await api.request<Sermon>('sermons', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(
          isEditing
            ? { id: editingSermon!.id, ...basePayload, ...(status !== editingSermon!.status ? { status } : {}) }
            : { ...basePayload, status },
        ),
      });

      setComposerOpen(false);
      resetComposer();
      setSuccessMsg(
        isEditing
          ? 'Pastor’s Message updated.'
          : status === 'published'
            ? `Pastor’s Message published${expression?.name ? ` inside ${expression.name}` : ''}.`
            : status === 'review'
              ? 'Pastor’s Message saved for review.'
              : 'Pastor’s Message draft created.',
      );
      sermons.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save sermon.');
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
          {
            paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm,
            paddingBottom: expressionWorkspace ? insets.bottom + spacing.xl : insets.bottom + 120,
          },
        ]}
      >
        {!expressionWorkspace ? (
          <ScreenHeader
            title="Pastor’s Messages"
            kicker="LEADERSHIP"
            subtitle="Create and publish dedicated pastoral audio and video messages."
            showBack
            rightAction={canCreate ? <Button label="New message" onPress={openCreate} size="sm" /> : undefined}
          />
        ) : null}

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="book-outline" size={22} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{publishedCount}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Published messages</Text>
            </View>
            {canCreate ? <Button label="Create" onPress={openCreate} variant="secondary" size="sm" /> : null}
          </View>

          <View style={styles.listSection}>
            <SectionHeader title="Pastor’s Messages" badge={list.length} subtitle={expression?.name ? 'Pastoral audio and video in this Expression' : 'Church-wide pastoral audio and video'} />
            {sermons.loading ? (
              <Skeleton height={100} count={3} />
            ) : sermons.error && !sermons.data ? (
              <ResourceError message={sermons.error} retry={sermons.refresh} />
            ) : list.length ? (
              list.map((sermon) => (
                <View key={sermon.id} style={styles.sermonWrap}>
                  <SermonCard
                    sermon={sermon}
                    variant="row"
                    onPress={() => router.push((expression?.id ? `/expressions/${expression.id}/pastor-messages/${sermon.id}` : `/general/pastor-messages/${sermon.id}`) as any)}
                  />
                  <View style={styles.statusRow}>
                    <View style={styles.statusMeta}>
                      <Badge label={(sermon.status || 'draft').toUpperCase()} variant={sermon.status === 'published' ? 'success' : 'neutral'} />
                      <Text style={[styles.scopeText, { color: colors.textMuted }]}>{sermon.visibility === 'public' ? 'Public' : expression?.name || 'Expression'}</Text>
                    </View>
                    {canManage ? <Button label="Edit" onPress={() => openEdit(sermon)} variant="outline" size="sm" /> : null}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No sermons yet"
                message={canCreate ? 'Create a sermon draft with structured text, a banner and optional audio.' : 'Sermons created here will appear in this library.'}
                iconName="book-outline"
                actionLabel={canCreate ? 'Create sermon' : undefined}
                onAction={canCreate ? openCreate : undefined}
              />
            )}
          </View>
        </View>
      {uploadProgress ? (
        <View style={[styles.uploadProgress, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={styles.uploadProgressRow}>
            <Text style={[styles.uploadProgressLabel, { color: colors.text }]}>{uploadProgress.label}</Text>
            <Text style={[styles.uploadProgressPercent, { color: colors.interactive }]}>{uploadProgress.percent}%</Text>
          </View>
          <View style={[styles.uploadTrack, { backgroundColor: colors.bgSecondary }]}>
            <View style={[styles.uploadFill, { backgroundColor: colors.interactive, width: `${uploadProgress.percent}%` }]} />
          </View>
        </View>
      ) : null}
      </ScrollView>

      <BottomSheet
        visible={composerOpen}
        onClose={() => {
          if (!creating) {
            setComposerOpen(false);
            resetComposer();
          }
        }}
        title={editingSermon ? 'Edit pastoral message' : 'Create pastoral message'}
        subtitle={editingSermon ? editingSermon.title : expression?.name ? `Inside ${expression.name}` : 'Church-wide pastoral message'}
        maxHeightPercent={96}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField label="Sermon title" value={title} onChangeText={setTitle} placeholder="Walking in divine alignment" />
          <InputField label="Speaker" value={preacher} onChangeText={setPreacher} placeholder="Pastor / minister name" />
          <InputField label="Scripture references" value={scripture} onChangeText={setScripture} placeholder="Romans 8:28, Hebrews 11:1" helperText="Separate multiple passages with commas." />

          <SermonRichEditor blocks={blocks} onChange={setBlocks} disabled={creating} />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>MESSAGE BANNER</Text>
          <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            {bannerFile?.uri || generatedBannerUrl || editingSermon?.thumbnail_url ? (
              <Image source={{ uri: bannerFile?.uri || generatedBannerUrl || editingSermon?.thumbnail_url! }} style={styles.bannerPreview} />
            ) : (
              <Icon name="image-outline" size={28} color={colors.interactive} />
            )}
            <View style={styles.flex}>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Choose 16:9 banner</Text>
              <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Shown on Pastor’s Messages cards and the message screen.</Text>
            </View>
          </Pressable>
          <MinistryImageGenerator
            organizationId={organizationId}
            branchId={expression?.id ?? null}
            useCase="sermon_artwork"
            title={title}
            description={[scripture, sermonExcerpt(blocks)].filter(Boolean).join(' · ')}
            context={{ scripture, excerpt: sermonExcerpt(blocks), speaker: preacher }}
            currentImageUrl={bannerFile?.uri || generatedBannerUrl || editingSermon?.thumbnail_url}
            onGenerated={(url) => { setBannerFile(null); setGeneratedBannerUrl(url); }}
            onUploadInstead={() => void chooseBanner()}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PASTORAL AUDIO</Text>
          <View style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name={audioFile || editingSermon?.audio_asset_id ? 'checkmark-circle' : 'headset-outline'} size={24} color={colors.interactive} />
            <View style={styles.flex}>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>{audioFile?.name || (editingSermon?.audio_asset_id ? 'Audio recording attached' : 'Attach pastor’s audio')}</Text>
              <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Upload the original pastor’s audio recording. Large files use resumable upload.</Text>
            </View>
            <Button label={audioFile || editingSermon?.audio_asset_id ? 'Replace' : 'Add audio'} onPress={() => void chooseAudio()} variant="outline" size="sm" />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PASTORAL VIDEO</Text>
          <View style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name={videoFile || editingSermon?.video_asset_id ? 'checkmark-circle' : 'videocam-outline'} size={24} color={colors.interactive} />
            <View style={styles.flex}>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>{videoFile?.name || (editingSermon?.video_asset_id ? 'Video recording attached' : 'Attach pastor’s video')}</Text>
              <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Upload the original pastor’s video for the dedicated video library.</Text>
            </View>
            <Button label={videoFile || editingSermon?.video_asset_id ? 'Replace' : 'Add video'} onPress={() => void chooseVideo()} variant="outline" size="sm" />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text>
          <View style={styles.chips}>
            <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
            <Chip label="Review" selected={status === 'review'} onPress={() => setStatus('review')} />
            {editingSermon ? <Chip label="Archived" selected={status === 'archived'} onPress={() => setStatus('archived')} /> : null}
            {canPublish ? <Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} /> : null}
          </View>

          <Button label={editingSermon ? 'Save changes' : 'Save message'} onPress={() => void handleSaveSermon()} loading={creating} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.xl },
  flex: { flex: 1, minWidth: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 1 },
  listSection: { gap: spacing.sm },
  sermonWrap: { marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: -spacing.xs, paddingHorizontal: spacing.xs },
  statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  scopeText: { fontSize: 11, fontWeight: '600' },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadCard: { minHeight: 74, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  uploadTitle: { fontSize: 12, fontWeight: '800' },
  uploadHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  bannerPreview: { width: 92, aspectRatio: 16 / 9, borderRadius: radius.md },
});

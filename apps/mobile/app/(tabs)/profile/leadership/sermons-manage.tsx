import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, usePathname } from 'expo-router';
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
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  SermonCard,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';
import { putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';

type ContentUploadIntent = { uploadSession: { assetId: string; signedUploadUrl: string } };
type BannerUploadIntent = { signedUploadUrl: string; publicUrl: string };

export default function SermonsManageScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const expressionWorkspace = pathname.startsWith('/expressions/');
  const { api, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);
  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDescription] = useState('');
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [audioFile, setAudioFile] = useState<UploadFile | null>(null);
  const [status, setStatus] = useState<Sermon['status']>('draft');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canCreate = hasCapability('sermons.create');
  const canManage = hasCapability('sermons.manage');
  const canPublish = hasCapability('sermons.publish');
  const sermons = useResource<Sermon[]>(`leadership:sermons:${organizationId || 'none'}:${expression?.id ?? 'general'}`, (signal) =>
    api.request<Sermon[]>('sermons?view=manage', { signal })
  );

  const list = sermons.data ?? [];
  const publishedCount = useMemo(() => list.filter((sermon) => sermon.status === 'published').length, [list]);

  const resetComposer = () => {
    setEditingSermon(null);
    setTitle('');
    setPreacher('');
    setScripture('');
    setDescription('');
    setBannerFile(null);
    setAudioFile(null);
    setStatus('draft');
    setErrorMsg('');
  };

  const chooseBanner = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setErrorMsg('Allow photo-library access to choose a sermon banner.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return setErrorMsg('Choose a JPG, PNG, or WebP banner.');
    setBannerFile({ uri: asset.uri, name: asset.fileName || `sermon-banner-${Date.now()}.jpg`, mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const chooseAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav'], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || (asset.name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4');
    if ((asset.size ?? 0) > 200 * 1024 * 1024) return setErrorMsg('Choose an audio recording that is 200 MB or smaller.');
    setAudioFile({ uri: asset.uri, name: asset.name, mimeType, size: asset.size, file: (asset as any).file });
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
    setDescription(sermon.description ?? '');
    setStatus(sermon.status ?? 'draft');
    setErrorMsg('');
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const handleSaveSermon = async () => {
    if (editingSermon ? !canManage : !canCreate) return;
    if (!title.trim() || !preacher.trim()) {
      setErrorMsg('Enter both a sermon title and speaker.');
      return;
    }
    if (!bannerFile && !editingSermon?.thumbnail_url) return setErrorMsg('Choose a 16:9 banner for this sermon.');
    if (!description.trim() && !audioFile && !editingSermon?.audio_asset_id) return setErrorMsg('Add sermon text or attach an audio recording.');
    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const scriptures = scripture
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const isEditing = Boolean(editingSermon);
      if ((status === 'published' || status === 'scheduled') && !canPublish) {
        setErrorMsg('Publishing isn’t available for this account.');
        return;
      }
      let thumbnailUrl = editingSermon?.thumbnail_url ?? null;
      let audioAssetId = editingSermon?.audio_asset_id ?? null;
      if (bannerFile) {
        const intent = await api.request<BannerUploadIntent>('sermons', { method: 'POST', body: JSON.stringify({ action: 'create_banner_upload', mimeType: bannerFile.mimeType }) });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        thumbnailUrl = intent.publicUrl;
      }
      if (audioFile) {
        const audioBody = await readUploadFile(audioFile);
        const intent = await api.request<ContentUploadIntent>('content-media', { method: 'POST', body: JSON.stringify({ action: 'create_upload_intent', mediaType: 'audio', mimeType: audioFile.mimeType, expressionId: expression?.id ?? null, fileSizeBytes: audioBody.size, fileName: audioFile.name }) });
        await putSignedUpload(intent.uploadSession.signedUploadUrl, { ...audioFile, file: audioBody });
        await api.request('content-media', { method: 'POST', body: JSON.stringify({ action: 'complete_upload', assetId: intent.uploadSession.assetId }) });
        audioAssetId = intent.uploadSession.assetId;
      }
      const basePayload = {
        title: title.trim(),
        preacher: preacher.trim(),
        scriptures,
        description: description.trim(),
        thumbnailUrl,
        audioAssetId,
      };
      await api.request('sermons', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(
          isEditing
            ? {
                id: editingSermon!.id,
                ...basePayload,
                ...(status !== editingSermon!.status ? { status } : {}),
              }
            : { ...basePayload, status },
        ),
      });
      setComposerOpen(false);
      resetComposer();
      setSuccessMsg(
        isEditing
          ? 'Sermon updated.'
          : status === 'published'
            ? `Sermon published${expression?.name ? ` inside ${expression.name}` : ''}.`
            : status === 'review'
              ? 'Sermon saved for review.'
              : 'Sermon draft created.',
      );
      sermons.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create sermon.');
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
          { paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm, paddingBottom: expressionWorkspace ? insets.bottom + spacing.xl : insets.bottom + 120 },
        ]}
      >
        {!expressionWorkspace ? (
          <ScreenHeader
            title="Sermons"
            kicker="LEADERSHIP"
            subtitle={expression?.name ? `Sermon library for ${expression.name}.` : 'Church sermon library and publishing.'}
            showBack
            rightAction={canCreate ? <Button label="New sermon" onPress={openCreate} size="sm" /> : undefined}
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
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Published here</Text>
            </View>
{canCreate ? <Button label="Create" onPress={openCreate} variant="secondary" size="sm" /> : null}
          </View>

          <View style={styles.listSection}>
            <SectionHeader title="Sermon library" badge={list.length} subtitle={expression?.name ? 'Teachings in this Expression' : 'Church-wide teachings'} />
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
                    onPress={() => router.push((expression?.id ? `/expressions/${expression.id}/sermons/${sermon.id}` : `/sermon/${sermon.id}`) as any)}
                  />
                  <View style={styles.statusRow}>
                    <View style={styles.statusMeta}>
                      <Badge
                        label={(sermon.status || 'draft').toUpperCase()}
                        variant={sermon.status === 'published' ? 'success' : 'neutral'}
                      />
                      <Text style={[styles.scopeText, { color: colors.textMuted }]}>
                        {sermon.visibility === 'public' ? 'Public' : expression?.name || 'Expression'}
                      </Text>
                    </View>
                    {canManage ? <Button label="Edit" onPress={() => openEdit(sermon)} variant="outline" size="sm" /> : null}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No sermons yet"
                message={canCreate ? 'Create a sermon draft and add its banner, audio or video.' : 'Sermons created here will appear in this library.'}
                iconName="book-outline"
                actionLabel={canCreate ? 'Create sermon' : undefined}
                onAction={canCreate ? openCreate : undefined}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={composerOpen}
        onClose={() => {
          if (!creating) {
            setComposerOpen(false);
            resetComposer();
          }
        }}
        title={editingSermon ? 'Edit sermon' : 'Create sermon'}
        subtitle={editingSermon ? editingSermon.title : expression?.name ? `Inside ${expression.name}` : 'Church-wide sermon'}
        maxHeightPercent={94}
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
          <InputField label="Notes / summary" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Add sermon notes or a short summary…" />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SERMON BANNER (REQUIRED)</Text>
          <Pressable onPress={() => void chooseBanner()} style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            {bannerFile?.uri || editingSermon?.thumbnail_url ? <Image source={{ uri: bannerFile?.uri || editingSermon?.thumbnail_url! }} style={styles.bannerPreview} /> : <Icon name="image-outline" size={28} color={colors.interactive} />}
            <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>Choose 16:9 banner</Text><Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Shown on sermon cards and sermon playback</Text></View>
          </Pressable>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SERMON CONTENT</Text>
          <View style={[styles.uploadCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name={audioFile || editingSermon?.audio_asset_id ? 'checkmark-circle' : 'document-text-outline'} size={24} color={colors.interactive} />
            <View style={styles.flex}><Text style={[styles.uploadTitle, { color: colors.text }]}>{audioFile?.name || (editingSermon?.audio_asset_id ? 'Audio recording attached' : 'Text sermon')}</Text><Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Notes are readable text; audio is an optional recording of this sermon.</Text></View>
            <Button label={audioFile || editingSermon?.audio_asset_id ? 'Replace' : 'Add audio'} onPress={() => void chooseAudio()} variant="outline" size="sm" />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text>
          <View style={styles.chips}>
            <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
            <Chip label="Review" selected={status === 'review'} onPress={() => setStatus('review')} />
            {editingSermon ? <Chip label="Archived" selected={status === 'archived'} onPress={() => setStatus('archived')} /> : null}
            {canPublish ? <Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} /> : null}
          </View>
          {!canPublish ? (
            <View style={[styles.infoCard, { backgroundColor: colors.primarySoft }]}>
              <Icon name="lock-closed-outline" size={16} color={colors.interactive} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>The Publish button appears for people who can publish church teachings.</Text>
            </View>
          ) : null}

          <Button
            label={editingSermon ? 'Save changes' : status === 'published' ? 'Publish sermon' : status === 'review' ? 'Save for review' : 'Save sermon draft'}
            onPress={() => void handleSaveSermon()}
            loading={creating}
            size="lg"
            fullWidth
          />
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 1 },
  listSection: { gap: spacing.sm },
  sermonWrap: { marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.xs, marginTop: -spacing.xs },
  statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  scopeText: { fontSize: 11, fontWeight: '600' },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  uploadCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  bannerPreview: { width: 104, height: 59, borderRadius: radius.md },
  uploadTitle: { fontSize: 13, fontWeight: '700' },
  uploadHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});

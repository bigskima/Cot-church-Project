import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { buildBibleShareCardPng } from '@/features/bible/bible-share-card-runtime';
import { SvgPngRenderer, type SvgPngRendererHandle } from '@/features/bible/SvgPngRenderer';
import { putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { PLATFORM_KEYBOARD_BEHAVIOR, PLATFORM_KEYBOARD_DISMISS_MODE, PLATFORM_KEYBOARD_VERTICAL_OFFSET } from '@/utils/keyboard';

type ComposerMode = 'post' | 'audio';
type MediaAttachment = {
  uploadId: string;
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  url: string;
  fileName?: string | null;
  sizeBytes: number;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
};
type UploadIntent = MediaAttachment & { signedUploadUrl: string };
type UploadableMedia = {
  uri: string;
  fileName?: string | null;
  mimeType: string;
  reportedSize?: number | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  webFile?: Blob | null;
};

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function inferImagePickerMime(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.mp4')) return 'video/mp4';
  return asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
}

function inferAudioMime(name: string, supplied?: string | null) {
  if (supplied?.startsWith('audio/')) return supplied.toLowerCase();
  const value = name.toLowerCase();
  if (value.endsWith('.m4a') || value.endsWith('.mp4')) return 'audio/mp4';
  if (value.endsWith('.aac')) return 'audio/aac';
  if (value.endsWith('.webm')) return 'audio/webm';
  if (value.endsWith('.ogg') || value.endsWith('.oga')) return 'audio/ogg';
  if (value.endsWith('.wav')) return 'audio/wav';
  return 'audio/mpeg';
}

type ScriptureShare = { reference: string; text: string; version?: string };

export default function GeneralComposerExperience({ mode: composerMode = 'post', initialScripture }: { mode?: ComposerMode; initialScripture?: ScriptureShare }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, context, mode, hasOrganizationCapability } = useSession();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const elevatedPublisher = hasOrganizationCapability('feed.post');
  const attachmentLimit = elevatedPublisher ? 10 : 4;
  const postTextLimit = elevatedPublisher ? 10000 : 2200;
  const [text, setText] = useState(() => initialScripture ? '“' + initialScripture.text + '”\n— ' + initialScripture.reference + ' ' + (initialScripture.version || '') : '');
  const scripturePreparedRef = useRef(false);
  const cardRendererRef = useRef<SvgPngRendererHandle>(null);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [recordingAction, setRecordingAction] = useState(false);
  const [error, setError] = useState('');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);

  const cleanupAttachments = async (items = attachments) => {
    if (!items.length) return;
    await Promise.allSettled(items.map((item) => api.request('community-media', {
      method: 'DELETE',
      context: 'public',
      body: JSON.stringify({ uploadId: item.uploadId }),
    })));
  };

  const finishRecordingSession = async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  };

  const uploadMedia = async (media: UploadableMedia) => {
    const uploadFile: UploadFile = {
      uri: media.uri,
      name: media.fileName || `general-upload-${Date.now()}`,
      mimeType: media.mimeType,
      size: media.reportedSize,
      file: media.webFile ?? undefined,
    };
    const binary = await readUploadFile(uploadFile);
    const sizeBytes = Number(binary.size || media.reportedSize || 0);
    if (!sizeBytes || sizeBytes > MAX_MEDIA_BYTES) throw new Error('Each attachment must be 50 MB or smaller.');
    const intent = await api.request<UploadIntent>('community-media', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({
        action: 'create_upload',
        organizationId,
        mimeType: media.mimeType,
        fileName: media.fileName ?? undefined,
        sizeBytes,
        durationSeconds: media.durationSeconds ?? undefined,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
      }),
    });
    try {
      await putSignedUpload(intent.signedUploadUrl, { ...uploadFile, size: sizeBytes, file: binary });
      return await api.request<MediaAttachment>('community-media', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ action: 'complete_upload', uploadId: intent.uploadId }),
      });
    } catch (value) {
      await api.request('community-media', { method: 'DELETE', context: 'public', body: JSON.stringify({ uploadId: intent.uploadId }) }).catch(() => undefined);
      throw value;
    }
  };

  useEffect(() => {
    if (!initialScripture || scripturePreparedRef.current || mode !== 'authenticated') return;
    scripturePreparedRef.current = true;
    let disposed = false;
    const attachCard = async () => {
      try {
        const uri = await buildBibleShareCardPng(
          {
            reference: initialScripture.reference,
            text: initialScripture.text,
            version: initialScripture.version,
          },
          (svgDataUri) => {
            const renderer = cardRendererRef.current;
            if (!renderer) return Promise.reject(new Error('The Scripture card renderer is still preparing.'));
            return renderer.render(svgDataUri);
          },
        );
        if (disposed) return;
        setUploading(true);
        const uploaded = await uploadMedia({
          uri,
          fileName: 'cot-scripture-' + Date.now() + '.png',
          mimeType: 'image/png',
        });
        if (!disposed) setAttachments((current) => current.some((item) => item.uploadId === uploaded.uploadId) ? current : [...current, uploaded].slice(0, attachmentLimit));
      } catch (value) {
        if (!disposed) setError(value instanceof Error ? value.message : 'The Scripture card could not be attached. The verse text is still ready to post.');
      } finally {
        if (!disposed) setUploading(false);
      }
    };
    void attachCard();
    return () => { disposed = true; };
  }, [initialScripture, mode]);

  const appendUploads = async (selected: UploadableMedia[]) => {
    if (!selected.length || uploading) return;
    setUploading(true);
    setError('');
    const uploaded: MediaAttachment[] = [];
    try {
      for (const media of selected.slice(0, Math.max(0, attachmentLimit - attachments.length))) uploaded.push(await uploadMedia(media));
      setAttachments((current) => [...current, ...uploaded].slice(0, attachmentLimit));
    } catch (value) {
      if (uploaded.length) await cleanupAttachments(uploaded);
      setError(value instanceof Error ? value.message : 'Unable to upload selected media.');
    } finally {
      setUploading(false);
    }
  };

  const choosePhotoOrVideo = async () => {
    if (uploading || attachments.length >= attachmentLimit) return;
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo-library access to attach images or videos.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, attachmentLimit - attachments.length),
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: inferImagePickerMime(asset),
        reportedSize: asset.fileSize,
        durationSeconds: asset.type === 'video' && asset.duration ? Math.max(1, Math.round(asset.duration / 1000)) : null,
        width: asset.width || null,
        height: asset.height || null,
        webFile: ((asset as any).file as Blob | undefined) ?? null,
      })));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to choose media.');
    }
  };

  const chooseAudio = async () => {
    if (uploading || attachments.length >= attachmentLimit) return;
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.name,
        mimeType: inferAudioMime(asset.name, asset.mimeType),
        reportedSize: asset.size,
        webFile: ((asset as any).file as Blob | undefined) ?? null,
      })));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to choose audio.');
    }
  };

  const startRecording = async () => {
    if (recordingAction || recorderState.isRecording || uploading || attachments.length >= attachmentLimit) return;
    setRecordingAction(true);
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access is needed to record a voice post.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start recording.');
      await finishRecordingSession();
    } finally {
      setRecordingAction(false);
    }
  };

  const stopRecording = async (attach = true) => {
    if (!recorderState.isRecording || recordingAction) return;
    setRecordingAction(true);
    setError('');
    const durationSeconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      await finishRecordingSession();
      if (!attach) return;
      if (!uri) throw new Error('The recording could not be prepared.');
      const web = Platform.OS === 'web';
      await appendUploads([{
        uri,
        fileName: `voice-note-${Date.now()}.${web ? 'webm' : 'm4a'}`,
        mimeType: web ? 'audio/webm' : 'audio/mp4',
        durationSeconds,
      }]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to finish recording.');
      await finishRecordingSession();
    } finally {
      setRecordingAction(false);
    }
  };

  const removeAttachment = async (item: MediaAttachment) => {
    setAttachments((current) => current.filter((candidate) => candidate.uploadId !== item.uploadId));
    await api.request('community-media', { method: 'DELETE', context: 'public', body: JSON.stringify({ uploadId: item.uploadId }) }).catch(() => undefined);
  };

  const cancel = async () => {
    if (posting || uploading || recordingAction) return;
    if (recorderState.isRecording) await stopRecording(false);
    const pending = attachments;
    setAttachments([]);
    if (pending.length) void cleanupAttachments(pending);
    router.replace('/general');
  };

  const publish = async () => {
    if (mode !== 'authenticated' || posting || uploading || (!text.trim() && !attachments.length)) return;
    setPosting(true);
    setError('');
    try {
      await api.request('social-feed', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          organizationId,
          body: text.trim(),
          visibility: 'public',
          mediaUploadIds: attachments.map((item) => item.uploadId),
        }),
      });
      setAttachments([]);
      router.replace('/general');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to share your post.');
    } finally {
      setPosting(false);
    }
  };

  const canPublish = mode === 'authenticated' && Boolean(text.trim() || attachments.length) && !posting && !uploading && !recordingAction && !recorderState.isRecording;

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <Icon name="lock-closed-outline" size={28} color={colors.interactive} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Sign in to create</Text>
          <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>General COT stays public to browse, while publishing is available to signed-in members.</Text>
          <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general' } } as any)} fullWidth />
          <Button label="Back to Home" onPress={() => router.replace('/general')} variant="outline" fullWidth />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={PLATFORM_KEYBOARD_BEHAVIOR} keyboardVerticalOffset={PLATFORM_KEYBOARD_VERTICAL_OFFSET}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }]}>
        <Pressable onPress={() => void cancel()} style={({ pressed }) => [styles.backButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Cancel creating post">
          <Icon name="close" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={[styles.topKicker, { color: colors.interactive }]}>GENERAL COT</Text>
          <Text style={[styles.topTitle, { color: colors.text }]}>{composerMode === 'audio' ? 'Voice update' : 'Create post'}</Text>
        </View>
        <Pressable onPress={() => void publish()} disabled={!canPublish} style={[styles.publishButton, { backgroundColor: colors.interactive, opacity: canPublish ? 1 : 0.45 }]} accessibilityRole="button">
          <Text style={styles.publishText}>{posting ? 'Posting…' : 'Post'}</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <View style={styles.identityRow}>
            <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'COT member'} size="md" />
            <View style={styles.flex}>
              <Text style={[styles.identityName, { color: colors.text }]}>{context?.profile?.display_name || 'COT member'}</Text>
              <View style={styles.scopeRow}><Icon name="globe-outline" size={12} color={colors.interactive} /><Text style={[styles.scopeText, { color: colors.interactive }]}>General COT · Public</Text></View>
            </View>
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={composerMode === 'audio' ? 'Add a note to your voice update…' : 'What would you like to share?'}
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus={composerMode !== 'audio'}
            maxLength={postTextLimit}
            style={[styles.input, { color: colors.text }]}
          />

          {error ? <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={17} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{error}</Text></View> : null}

          {recorderState.isRecording ? (
            <View style={[styles.recordingCard, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <View style={styles.recordingInfo}><View style={[styles.recordingDot, { backgroundColor: colors.live }]} /><View><Text style={[styles.recordingTitle, { color: colors.text }]}>Recording voice</Text><Text style={[styles.recordingTime, { color: colors.live }]}>{Math.floor(recorderState.durationMillis / 60000).toString().padStart(2, '0')}:{Math.floor((recorderState.durationMillis % 60000) / 1000).toString().padStart(2, '0')}</Text></View></View>
              <View style={styles.recordingActions}><Button label="Discard" onPress={() => void stopRecording(false)} variant="outline" size="sm" /><Button label="Stop & attach" onPress={() => void stopRecording(true)} size="sm" /></View>
            </View>
          ) : null}

          {attachments.length ? (
            <View style={styles.attachments}>
              {attachments.map((item) => (
                <View key={item.uploadId} style={[styles.attachmentCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                  {item.type === 'image' ? <Image source={{ uri: item.url }} style={styles.attachmentImage} resizeMode="cover" /> : <View style={[styles.attachmentIcon, { backgroundColor: colors.primarySoft }]}><Icon name={item.type === 'video' ? 'videocam-outline' : 'musical-notes-outline'} size={22} color={colors.interactive} /></View>}
                  <View style={styles.flex}><Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>{item.fileName || item.type}</Text><Text style={[styles.attachmentMeta, { color: colors.textMuted }]}>{(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB</Text></View>
                  <Pressable onPress={() => void removeAttachment(item)} hitSlop={8}><Icon name="close-circle" size={20} color={colors.live} /></Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.toolBar, { borderTopColor: colors.borderSubtle }]}>
            <Pressable onPress={() => void choosePhotoOrVideo()} disabled={uploading || attachments.length >= attachmentLimit} style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}><Icon name="images-outline" size={19} color={colors.interactive} /><Text style={[styles.toolText, { color: colors.textSecondary }]}>Photo / video</Text></Pressable>
            <Pressable onPress={() => void startRecording()} disabled={uploading || recordingAction || recorderState.isRecording || attachments.length >= attachmentLimit} style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}><Icon name="mic-outline" size={19} color={colors.interactive} /><Text style={[styles.toolText, { color: colors.textSecondary }]}>Record</Text></Pressable>
            <Pressable onPress={() => void chooseAudio()} disabled={uploading || recorderState.isRecording || attachments.length >= attachmentLimit} style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}><Icon name="musical-notes-outline" size={19} color={colors.interactive} /><Text style={[styles.toolText, { color: colors.textSecondary }]}>Audio</Text></Pressable>
          </View>
          <Text style={[styles.counter, { color: colors.textMuted }]}>{uploading ? 'Uploading media… · ' : ''}{text.length.toLocaleString()} / {postTextLimit.toLocaleString()} · {attachments.length}/{attachmentLimit} media</Text>
        </View>

        <View style={styles.formatGrid}>
          <Pressable onPress={() => router.push('/general/studio/reel' as any)} style={({ pressed }) => [styles.formatCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><View style={[styles.formatIcon, { backgroundColor: colors.primarySoft }]}><Icon name="flash-outline" size={20} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.formatTitle, { color: colors.text }]}>Create Reel</Text><Text style={[styles.formatCopy, { color: colors.textMuted }]}>Short vertical video</Text></View><Icon name="chevron-forward" size={16} color={colors.textMuted} /></Pressable>
          <Pressable onPress={() => router.push('/general/studio/video' as any)} style={({ pressed }) => [styles.formatCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><View style={[styles.formatIcon, { backgroundColor: colors.primarySoft }]}><Icon name="videocam-outline" size={20} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.formatTitle, { color: colors.text }]}>Create Video</Text><Text style={[styles.formatCopy, { color: colors.textMuted }]}>Long-form public video</Text></View><Icon name="chevron-forward" size={16} color={colors.textMuted} /></Pressable>
        </View>
      </ScrollView>
      <SvgPngRenderer ref={cardRendererRef} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1, minWidth: 0 },
  topBar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: { width: 40, height: 40, borderWidth: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1, minWidth: 0 }, topKicker: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 }, topTitle: { fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3 },
  publishButton: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' }, publishText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  composerCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, identityName: { fontSize: 14, fontWeight: '900' }, scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }, scopeText: { fontSize: 10.5, fontWeight: '700' },
  input: { minHeight: 150, fontSize: 17, lineHeight: 25, textAlignVertical: 'top', paddingVertical: spacing.sm },
  errorBanner: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, errorText: { flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  recordingCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, recordingDot: { width: 9, height: 9, borderRadius: 5 }, recordingTitle: { fontSize: 12, fontWeight: '800' }, recordingTime: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 2 }, recordingActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  attachments: { gap: spacing.sm }, attachmentCard: { minHeight: 64, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, attachmentImage: { width: 48, height: 48, borderRadius: radius.md }, attachmentIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, attachmentName: { fontSize: 12.5, fontWeight: '800' }, attachmentMeta: { fontSize: 10, marginTop: 2 },
  toolBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, toolButton: { minHeight: 38, borderRadius: radius.pill, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }, toolText: { fontSize: 10.5, fontWeight: '800' }, counter: { fontSize: 9.5, lineHeight: 14 },
  formatGrid: { gap: spacing.sm }, formatCard: { minHeight: 68, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, formatIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, formatTitle: { fontSize: 13.5, fontWeight: '900' }, formatCopy: { fontSize: 10.5, marginTop: 2 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }, stateCard: { width: '100%', maxWidth: 430, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm }, stateTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center' }, stateCopy: { fontSize: 12.5, lineHeight: 19, textAlign: 'center' }, pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

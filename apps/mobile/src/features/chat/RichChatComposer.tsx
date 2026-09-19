import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { ChatAttachment, ChatReply, ChatSendPayload } from './rich-chat-types';

type ChatEndpoint = 'chat' | 'group-chat' | 'expression-chat';
type ChatScope = { conversationId?: string; groupId?: string; sectionId?: string | null; branchId?: string };
type UploadIntent = ChatAttachment & { signedUploadUrl: string };
type UploadableMedia = UploadFile & { durationSeconds?: number | null };

const MAX_CHAT_MEDIA_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const COMPOSER_EMOJIS = ['🙏', '❤️', '😊', '😂', '👍', '🔥', '🎉', '🙌', '😢', '💯'];

function normalizePickerMime(asset: ImagePicker.ImagePickerAsset) {
  const supplied = asset.mimeType?.toLowerCase();
  if (supplied === 'image/jpg') return 'image/jpeg';
  if (supplied === 'audio/x-m4a') return 'audio/mp4';
  if (supplied) return supplied;
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webm')) return asset.type === 'video' ? 'video/webm' : 'image/webp';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
}

function normalizeDocumentMime(name: string, supplied?: string | null) {
  const mime = supplied?.toLowerCase();
  if (mime === 'audio/x-m4a' || mime === 'audio/m4a') return 'audio/mp4';
  if (mime === 'audio/x-wav') return 'audio/wav';
  if (mime?.startsWith('image/') || mime?.startsWith('audio/')) return mime;
  const value = name.toLowerCase();
  if (value.endsWith('.gif')) return 'image/gif';
  if (value.endsWith('.m4a') || value.endsWith('.mp4')) return 'audio/mp4';
  if (value.endsWith('.aac')) return 'audio/aac';
  if (value.endsWith('.webm')) return 'audio/webm';
  if (value.endsWith('.ogg') || value.endsWith('.oga')) return 'audio/ogg';
  if (value.endsWith('.wav')) return 'audio/wav';
  return 'audio/mpeg';
}

function attachmentLabel(type: ChatAttachment['type']) {
  if (type === 'gif') return 'GIF';
  if (type === 'image') return 'Photo';
  if (type === 'video') return 'Video';
  return 'Audio';
}

function formatDuration(milliseconds: number) {
  const total = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function RichChatComposer({
  endpoint,
  requestContext,
  scope,
  replyTo,
  disabledReason,
  bottomInset = 10,
  onCancelReply,
  onSend,
  initialText = '',
}: {
  endpoint: ChatEndpoint;
  requestContext: 'public' | 'current';
  scope: ChatScope;
  replyTo?: ChatReply | null;
  disabledReason?: string | null;
  bottomInset?: number;
  onCancelReply: () => void;
  onSend: (payload: ChatSendPayload) => Promise<unknown>;
}) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const appliedInitialText = useRef('');

  useEffect(() => {
    const value = initialText.trim();
    if (!value || appliedInitialText.current === value) return;
    appliedInitialText.current = value;
    setDraft((current) => current.trim() ? current : value);
  }, [initialText]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [emojisOpen, setEmojisOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recordingAction, setRecordingAction] = useState(false);
  const [error, setError] = useState('');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  attachmentsRef.current = attachments;
  const scopeKey = `${endpoint}:${scope.conversationId ?? scope.groupId ?? scope.branchId ?? ''}:${scope.sectionId ?? 'main'}`;

  const requestBody = (action: string, values: Record<string, unknown> = {}) => ({ action, ...scope, ...values });

  const deleteAttachments = async (items: ChatAttachment[]) => {
    await Promise.allSettled(items.map((attachment) => api.request(endpoint, {
      method: 'POST',
      context: requestContext,
      body: JSON.stringify(requestBody('delete_upload', { uploadId: attachment.uploadId })),
    })));
  };

  useEffect(() => () => {
    const pending = attachmentsRef.current;
    if (pending.length) void deleteAttachments(pending);
  }, [scopeKey]);

  const finishRecordingMode = async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  };

  const uploadMedia = async (media: UploadableMedia) => {
    const binary = await readUploadFile(media);
    const sizeBytes = Number(binary.size || media.size || 0);
    if (!sizeBytes || sizeBytes > MAX_CHAT_MEDIA_BYTES) throw new Error('Each chat attachment must be 100 MB or smaller.');
    const intent = await api.request<UploadIntent>(endpoint, {
      method: 'POST',
      context: requestContext,
      body: JSON.stringify(requestBody('create_upload', {
        mimeType: media.mimeType,
        fileName: media.name,
        sizeBytes,
        durationSeconds: media.durationSeconds ?? undefined,
      })),
    });
    try {
      await putSignedUpload(intent.signedUploadUrl, { ...media, size: sizeBytes, file: binary });
      const completed = await api.request<ChatAttachment>(endpoint, {
        method: 'POST',
        context: requestContext,
        body: JSON.stringify(requestBody('complete_upload', { uploadId: intent.uploadId })),
      });
      return { ...completed, url: media.uri };
    } catch (value) {
      await api.request(endpoint, { method: 'POST', context: requestContext, body: JSON.stringify(requestBody('delete_upload', { uploadId: intent.uploadId })) }).catch(() => undefined);
      throw value;
    }
  };

  const appendUploads = async (selected: UploadableMedia[]) => {
    if (!selected.length || uploading || disabledReason) return;
    setUploading(true);
    setError('');
    const uploaded: ChatAttachment[] = [];
    try {
      for (const media of selected.slice(0, Math.max(0, MAX_ATTACHMENTS - attachments.length))) uploaded.push(await uploadMedia(media));
      setAttachments((current) => [...current, ...uploaded].slice(0, MAX_ATTACHMENTS));
      setToolsOpen(false);
    } catch (value) {
      if (uploaded.length) await deleteAttachments(uploaded);
      setError(value instanceof Error ? value.message : 'Unable to upload that attachment.');
    } finally {
      setUploading(false);
    }
  };

  const chooseLibraryMedia = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Allow photo-library access to attach photos or videos.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: Math.max(1, MAX_ATTACHMENTS - attachments.length), quality: 1 });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || `chat-media-${Date.now()}`,
        mimeType: normalizePickerMime(asset),
        size: asset.fileSize,
        file: (asset as any).file as Blob | undefined,
        durationSeconds: asset.type === 'video' && asset.duration ? Math.max(1, Math.round(asset.duration / 1000)) : null,
      })));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to open your media library.');
    }
  };

  const takePhotoOrVideo = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Allow camera access to take a photo or video.');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      await appendUploads([{
        uri: asset.uri,
        name: asset.fileName || `camera-${Date.now()}`,
        mimeType: normalizePickerMime(asset),
        size: asset.fileSize,
        file: (asset as any).file as Blob | undefined,
        durationSeconds: asset.type === 'video' && asset.duration ? Math.max(1, Math.round(asset.duration / 1000)) : null,
      }]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to open the camera.');
    }
  };

  const chooseGif = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/gif'], multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: normalizeDocumentMime(asset.name, asset.mimeType), size: asset.size, file: (asset as any).file as Blob | undefined })));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to choose a GIF.');
    }
  };

  const chooseAudio = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/*'], multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: normalizeDocumentMime(asset.name, asset.mimeType), size: asset.size, file: (asset as any).file as Blob | undefined })));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to choose an audio file.');
    }
  };

  const startRecording = async () => {
    if (recordingAction || uploading || disabledReason || attachments.length >= MAX_ATTACHMENTS) return;
    setRecordingAction(true);
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Allow microphone access to record a voice note.');
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start a voice note.');
      await finishRecordingMode();
    } finally {
      setRecordingAction(false);
    }
  };

  const stopRecording = async (attach = true) => {
    if (!recorderState.isRecording || recordingAction) return;
    setRecordingAction(true);
    setError('');
    try {
      const durationSeconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      await finishRecordingMode();
      if (!attach) return;
      if (!uri) throw new Error('The voice note could not be prepared.');
      const web = Platform.OS === 'web';
      await appendUploads([{ uri, name: `voice-note.${web ? 'webm' : 'm4a'}`, mimeType: web ? 'audio/webm' : 'audio/mp4', durationSeconds }]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to finish the voice note.');
      await finishRecordingMode();
    } finally {
      setRecordingAction(false);
    }
  };

  const removeAttachment = async (attachment: ChatAttachment) => {
    setAttachments((current) => current.filter((item) => item.uploadId !== attachment.uploadId));
    await deleteAttachments([attachment]);
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !attachments.length) || sending || uploading || disabledReason || recorderState.isRecording) return;
    setSending(true);
    setError('');
    try {
      await onSend({ body, replyToId: replyTo?.id ?? null, attachments });
      attachmentsRef.current = [];
      setDraft('');
      setAttachments([]);
      onCancelReply();
      setToolsOpen(false);
      setEmojisOpen(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Message was not sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.shell, { backgroundColor: colors.card, borderTopColor: colors.borderSubtle, paddingBottom: Math.max(bottomInset, 8) }]}>
      {disabledReason ? <View style={[styles.disabled, { backgroundColor: colors.liveSoft }]}><Icon name="lock-closed-outline" size={15} color={colors.live} /><Text style={[styles.disabledText, { color: colors.live }]}>{disabledReason}</Text></View> : null}
      {replyTo ? <View style={[styles.reply, { backgroundColor: colors.bgSecondary, borderLeftColor: colors.interactive }]}><View style={styles.flex}><Text style={[styles.replyTitle, { color: colors.interactive }]}>Replying to {replyTo.sender?.display_name || replyTo.sender?.username || 'message'}</Text><Text style={[styles.replyCopy, { color: colors.textSecondary }]} numberOfLines={1}>{replyTo.body || 'Media attachment'}</Text></View><Pressable onPress={onCancelReply} hitSlop={8}><Icon name="close" size={19} color={colors.textMuted} /></Pressable></View> : null}

      {attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.previews}>
          {attachments.map((attachment) => (
            <View key={attachment.uploadId} style={[styles.preview, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              {attachment.type === 'image' || attachment.type === 'gif' ? <Image source={{ uri: attachment.url ?? '' }} style={styles.previewImage} /> : <Icon name={attachment.type === 'video' ? 'videocam' : 'mic'} size={22} color={colors.interactive} />}
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]} numberOfLines={1}>{attachmentLabel(attachment.type)}</Text>
              <Pressable onPress={() => void removeAttachment(attachment)} style={[styles.remove, { backgroundColor: colors.live }]}><Icon name="close" size={12} color="#FFFFFF" /></Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {toolsOpen ? <View style={styles.tools}><Pressable onPress={() => void chooseLibraryMedia()} style={styles.toolButton}><Icon name="images-outline" size={20} color={colors.interactive} /><Text style={[styles.toolLabel, { color: colors.textSecondary }]}>Photo/video</Text></Pressable><Pressable onPress={() => void takePhotoOrVideo()} style={styles.toolButton}><Icon name="camera-outline" size={20} color={colors.interactive} /><Text style={[styles.toolLabel, { color: colors.textSecondary }]}>Camera</Text></Pressable><Pressable onPress={() => void chooseGif()} style={styles.toolButton}><Icon name="sparkles-outline" size={20} color={colors.interactive} /><Text style={[styles.toolLabel, { color: colors.textSecondary }]}>GIF</Text></Pressable><Pressable onPress={() => void chooseAudio()} style={styles.toolButton}><Icon name="musical-notes-outline" size={20} color={colors.interactive} /><Text style={[styles.toolLabel, { color: colors.textSecondary }]}>Audio</Text></Pressable></View> : null}
      {emojisOpen ? <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiTray}>{COMPOSER_EMOJIS.map((emoji) => <Pressable key={emoji} onPress={() => setDraft((value) => `${value}${emoji}`)} style={[styles.composerEmoji, { backgroundColor: colors.bgSecondary }]}><Text style={styles.composerEmojiText}>{emoji}</Text></Pressable>)}</ScrollView> : null}
      {recorderState.isRecording ? <View style={[styles.recording, { backgroundColor: colors.liveSoft }]}><View style={[styles.recordingDot, { backgroundColor: colors.live }]} /><Text style={[styles.recordingText, { color: colors.live }]}>Recording {formatDuration(recorderState.durationMillis)}</Text><Pressable onPress={() => void stopRecording(false)}><Text style={[styles.recordingAction, { color: colors.textSecondary }]}>Discard</Text></Pressable><Pressable onPress={() => void stopRecording(true)}><Text style={[styles.recordingAction, { color: colors.interactive }]}>Attach</Text></Pressable></View> : null}
      {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}

      <View style={styles.composerRow}>
        <Pressable onPress={() => { setToolsOpen((value) => !value); setEmojisOpen(false); }} disabled={Boolean(disabledReason) || uploading} style={[styles.roundButton, { backgroundColor: colors.bgSecondary }]} accessibilityLabel="Add attachment">{uploading ? <ActivityIndicator size="small" color={colors.interactive} /> : <Icon name={toolsOpen ? 'close' : 'add'} size={22} color={colors.interactive} />}</Pressable>
        <View style={[styles.inputShell, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={disabledReason ? 'Discussion access restricted' : 'Message…'}
            placeholderTextColor={colors.textMuted}
            editable={!disabledReason}
            multiline
            maxLength={4000}
            blurOnSubmit={false}
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable onPress={() => { setEmojisOpen((value) => !value); setToolsOpen(false); }} disabled={Boolean(disabledReason)} hitSlop={6}><Icon name="happy-outline" size={21} color={colors.textMuted} /></Pressable>
        </View>
        {!draft.trim() && !attachments.length ? <Pressable onPress={() => void startRecording()} disabled={Boolean(disabledReason) || recordingAction || uploading} style={[styles.roundButton, { backgroundColor: recorderState.isRecording ? colors.liveSoft : colors.bgSecondary }]} accessibilityLabel="Record voice note"><Icon name="mic" size={21} color={recorderState.isRecording ? colors.live : colors.interactive} /></Pressable> : <Pressable onPress={() => void send()} disabled={sending || uploading || Boolean(disabledReason)} style={[styles.roundButton, { backgroundColor: colors.interactive, opacity: sending || uploading ? 0.55 : 1 }]} accessibilityLabel="Send message">{sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="send" size={20} color="#FFFFFF" />}</Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, paddingTop: 7, gap: 6 }, flex: { flex: 1, minWidth: 0 }, composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, roundButton: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  inputShell: { flex: 1, minHeight: 43, maxHeight: 126, borderWidth: 1, borderRadius: 22, flexDirection: 'row', alignItems: 'flex-end', paddingRight: 11 }, input: { flex: 1, minHeight: 41, maxHeight: 122, paddingHorizontal: 13, paddingVertical: 9, fontSize: 15 },
  tools: { flexDirection: 'row', justifyContent: 'space-around', gap: 4, paddingVertical: 3 }, toolButton: { minWidth: 68, alignItems: 'center', gap: 3, paddingVertical: 4 }, toolLabel: { fontSize: 9, fontWeight: '700' }, emojiTray: { gap: 6, paddingVertical: 3 }, composerEmoji: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, composerEmojiText: { fontSize: 20 },
  previews: { gap: 7, paddingVertical: 2 }, preview: { width: 98, height: 66, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 5 }, previewImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }, previewLabel: { fontSize: 9, fontWeight: '700', maxWidth: 78, marginTop: 3 }, remove: { position: 'absolute', right: 3, top: 3, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reply: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 6 }, replyTitle: { fontSize: 10, fontWeight: '800' }, replyCopy: { fontSize: 11, marginTop: 1 }, recording: { minHeight: 39, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 }, recordingDot: { width: 8, height: 8, borderRadius: 4 }, recordingText: { flex: 1, fontSize: 12, fontWeight: '800' }, recordingAction: { fontSize: 11, fontWeight: '800', paddingVertical: 7 }, disabled: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 7 }, disabledText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '700' }, error: { fontSize: 11, lineHeight: 15, paddingHorizontal: 4 },
});

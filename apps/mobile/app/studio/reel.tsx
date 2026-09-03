import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Button, Chip, Icon, InputField, ScreenHeader, VideoPlayer } from '@/components';
import { radius, spacing } from '@/design-system/tokens';

type ReelScope = 'public' | 'branch';
type SelectedVideo = { uri: string; fileName: string; mimeType: string; sizeBytes: number; durationSeconds?: number; body: Blob };
type UploadIntent = { asset: { id: string }; uploadSession: { assetId: string; signedUploadUrl: string; storagePath: string } };
const MAX_BYTES = 200 * 1024 * 1024;

function inferVideoMime(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType?.startsWith('video/')) return asset.mimeType.toLowerCase();
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

export default function ReelCreatorScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const [scope, setScope] = useState<ReelScope>('public');
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [caption, setCaption] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [audioArtist, setAudioArtist] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState('');

  const allowed = mode === 'authenticated' && Boolean(expression?.id) && hasCapability('media.upload') && hasCapability('reels.publish');
  const canPublish = useMemo(() => allowed && Boolean(video) && Boolean(caption.trim()) && !working, [allowed, video, caption, working]);

  const chooseVideo = async () => {
    if (!allowed || working) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Media access required', 'Allow photo-library access to choose a Reel video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false, quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const webFile = (asset as any).file as Blob | undefined;
      let body: Blob;
      if (webFile) {
        body = webFile;
      } else {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error('Unable to read the selected video.');
        body = await response.blob();
      }
      const sizeBytes = Number(body.size || asset.fileSize || 0);
      if (!sizeBytes || sizeBytes > MAX_BYTES) {
        Alert.alert('Video too large', 'Choose a Reel video that is 200 MB or smaller.');
        return;
      }
      setVideo({
        uri: asset.uri,
        fileName: asset.fileName || `reel-${Date.now()}.mp4`,
        mimeType: inferVideoMime(asset),
        sizeBytes,
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
        body,
      });
    } catch (error) {
      Alert.alert('Video unavailable', error instanceof Error ? error.message : 'Unable to choose this video.');
    }
  };

  const cancelAsset = async (assetId: string) => {
    await api.request('content-media', { method: 'POST', body: JSON.stringify({ action: 'cancel_upload', assetId }) }).catch(() => undefined);
  };

  const publishReel = async () => {
    if (!canPublish || !video || !expression?.id) return;
    setWorking(true);
    let assetId: string | null = null;
    try {
      setStage('Preparing secure upload…');
      const intent = await api.request<UploadIntent>('content-media', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_upload_intent', mediaType: 'video', mimeType: video.mimeType,
          expressionId: expression.id, durationSeconds: video.durationSeconds, aspectRatio: '9:16',
          fileSizeBytes: video.sizeBytes, fileName: video.fileName,
        }),
      });
      assetId = intent.uploadSession.assetId;
      setStage('Uploading video…');
      const uploaded = await fetch(intent.uploadSession.signedUploadUrl, { method: 'PUT', headers: { 'Content-Type': video.mimeType }, body: video.body });
      if (!uploaded.ok) throw new Error(`Video upload failed (${uploaded.status}).`);
      setStage('Verifying upload…');
      await api.request('content-media', { method: 'POST', body: JSON.stringify({ action: 'complete_upload', assetId }) });
      setStage('Publishing Reel…');
      await api.request('creator-studio', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish_reel', expressionId: expression.id, visibility: scope, mediaAssetId: assetId,
          caption: caption.trim(), audioTitle: audioTitle.trim() || undefined, audioArtist: audioArtist.trim() || undefined,
        }),
      });
      assetId = null;
      setStage('Published');
      router.replace('/reels');
    } catch (error) {
      if (assetId) await cancelAsset(assetId);
      setStage('');
      Alert.alert('Reel not published', error instanceof Error ? error.message : 'Unable to publish this Reel.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }]}>
        <ScreenHeader title="Create Reel" subtitle="Publish short vertical video through your Expression's media permissions." showBack />
        <View style={styles.body}>
          {!allowed ? (
            <View style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Icon name="shield-outline" size={22} color={colors.textMuted} />
              <View style={styles.noticeCopy}>
                <Text style={[styles.noticeTitle, { color: colors.text }]}>Reel publishing is role-scoped</Text>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>Your selected Expression must grant both media upload and Reel publishing capabilities.</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.scopeBlock}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PUBLISHING SCOPE</Text>
                <View style={styles.chipRow}>
                  <Chip label="Public Reels" selected={scope === 'public'} onPress={() => setScope('public')} />
                  <Chip label={expression?.name || 'Expression'} selected={scope === 'branch'} onPress={() => setScope('branch')} />
                </View>
                <Text style={[styles.helper, { color: colors.textMuted }]}>Public Reels can appear in public discovery. Expression Reels remain inside {expression?.name || 'the selected Expression'}.</Text>
              </View>

              {video ? (
                <View style={[styles.videoCard, { borderColor: colors.border }]}>
                  <VideoPlayer title={video.fileName} sourceUrl={video.uri} durationSeconds={video.durationSeconds} />
                  <View style={styles.videoMeta}>
                    <View style={styles.videoMetaCopy}>
                      <Text style={[styles.videoName, { color: colors.text }]} numberOfLines={1}>{video.fileName}</Text>
                      <Text style={[styles.helper, { color: colors.textMuted }]}>{(video.sizeBytes / (1024 * 1024)).toFixed(1)} MB</Text>
                    </View>
                    <Pressable onPress={() => !working && setVideo(null)} hitSlop={8}><Icon name="trash-outline" size={20} color={colors.live} /></Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => void chooseVideo()} style={[styles.videoPicker, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                  <Icon name="videocam-outline" size={32} color={colors.interactive} />
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>Choose Reel Video</Text>
                  <Text style={[styles.helper, { color: colors.textMuted }]}>Vertical video recommended · up to 200 MB</Text>
                </Pressable>
              )}

              <InputField label="Caption" value={caption} onChangeText={setCaption} multiline numberOfLines={4} placeholder="Write the Reel caption…" />
              <InputField label="Audio / Track title (optional)" value={audioTitle} onChangeText={setAudioTitle} placeholder="Original audio, song or track name" />
              <InputField label="Audio artist / source (optional)" value={audioArtist} onChangeText={setAudioArtist} placeholder="Artist or source" />
              {stage ? <View style={[styles.progressNotice, { backgroundColor: colors.primarySoft }]}><Icon name="cloud-upload-outline" size={18} color={colors.interactive} /><Text style={[styles.progressText, { color: colors.textSecondary }]}>{stage}</Text></View> : null}
              <Button label="Publish Reel" onPress={publishReel} loading={working} disabled={!canPublish} variant="primary" size="lg" />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }, scopeBlock: { gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, helper: { fontSize: 11, lineHeight: 16 },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderRadius: radius.lg },
  noticeCopy: { flex: 1, gap: 4 }, noticeTitle: { fontSize: 15, fontWeight: '800' }, noticeText: { fontSize: 12, lineHeight: 18 },
  videoPicker: { minHeight: 190, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.lg },
  pickerTitle: { fontSize: 16, fontWeight: '800' }, videoCard: { overflow: 'hidden', borderWidth: 1, borderRadius: radius.lg },
  videoMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }, videoMetaCopy: { flex: 1 }, videoName: { fontSize: 13, fontWeight: '700' },
  progressNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md }, progressText: { fontSize: 12, fontWeight: '700' },
});
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Button, Chip, Icon, InputField, ScreenHeader, VideoPlayer } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

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
  const [scope, setScope] = useState<ReelScope>(expression?.id ? 'branch' : 'public');
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [caption, setCaption] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [audioArtist, setAudioArtist] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const allowed = mode === 'authenticated' && hasCapability('media.upload') && hasCapability('reels.publish');
  const selectedExpressionId = scope === 'branch' ? expression?.id ?? null : null;
  const canPublish = useMemo(
    () => allowed && (scope !== 'branch' || Boolean(expression?.id)) && Boolean(video) && Boolean(caption.trim()) && !working,
    [allowed, scope, expression?.id, video, caption, working],
  );

  useEffect(() => {
    if (!expression?.id && scope === 'branch') setScope('public');
  }, [expression?.id, scope]);

  const chooseVideo = async () => {
    if (!allowed || working) return;
    try {
      setErrorMsg('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg('Photo-library access is required to choose a Reel video. Allow access in your device settings and try again.');
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
        setErrorMsg('Choose a Reel video that is 200 MB or smaller.');
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
      setErrorMsg(error instanceof Error ? error.message : 'Unable to choose this video.');
    }
  };

  const cancelAsset = async (assetId: string) => {
    await api.request('content-media', { method: 'POST', body: JSON.stringify({ action: 'cancel_upload', assetId }) }).catch(() => undefined);
  };

  const publishReel = async () => {
    if (!canPublish || !video) return;
    setWorking(true);
    setErrorMsg('');
    let assetId: string | null = null;
    try {
      setStage('Preparing secure upload…');
      const intent = await api.request<UploadIntent>('content-media', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_upload_intent', mediaType: 'video', mimeType: video.mimeType,
          expressionId: selectedExpressionId, durationSeconds: video.durationSeconds, aspectRatio: '9:16',
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
          action: 'publish_reel', expressionId: selectedExpressionId, visibility: scope, mediaAssetId: assetId,
          caption: caption.trim(), audioTitle: audioTitle.trim() || undefined, audioArtist: audioArtist.trim() || undefined,
        }),
      });
      assetId = null;
      setStage('Published');
      router.replace('/reels');
    } catch (error) {
      if (assetId) await cancelAsset(assetId);
      setStage('');
      setErrorMsg(error instanceof Error ? error.message : 'Unable to publish this Reel.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 130 }]}>
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader title="Create Reel" kicker="MEDIA STUDIO" subtitle="Upload a vertical video and choose exactly where it should appear." showBack />
        </View>
        <View style={styles.body}>
          {errorMsg ? (
            <Pressable
              onPress={() => setErrorMsg('')}
              style={[styles.errorBanner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss Reel error"
            >
              <Icon name="alert-circle-outline" size={17} color={colors.live} />
              <Text style={[styles.errorText, { color: colors.live }]}>{errorMsg}</Text>
              <Icon name="close" size={14} color={colors.live} />
            </Pressable>
          ) : null}
          {!allowed ? (
            <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <Icon name="shield-outline" size={22} color={colors.textMuted} />
              <View style={styles.noticeCopy}>
                <Text style={[styles.noticeTitle, { color: colors.text }]}>Reel publishing is role-scoped</Text>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>Your role must grant both media upload and Reel publishing capabilities in the current church scope.</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.scopeBlock}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PUBLISHING SCOPE</Text>
                <View style={styles.chipRow}>
                  <Chip label="Public Reels" selected={scope === 'public'} onPress={() => setScope('public')} />
                  {expression?.id ? <Chip label={expression.name} selected={scope === 'branch'} onPress={() => setScope('branch')} /> : null}
                </View>
                <Text style={[styles.helper, { color: colors.textMuted }]}>
                  {scope === 'public'
                    ? 'This Reel can appear in public discovery.'
                    : `This Reel stays inside ${expression?.name || 'the selected Expression'}.`}
                </Text>
              </View>

              {video ? (
                <View style={[styles.videoCard, { borderColor: colors.borderSubtle }, shadows.md]}>
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
                <Pressable onPress={() => void chooseVideo()} style={[styles.videoPicker, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
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
  screen: { flex: 1 }, content: { flexGrow: 1 }, headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' }, body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }, scopeBlock: { gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, helper: { fontSize: 11, lineHeight: 16 },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderRadius: radius.xl },
  noticeCopy: { flex: 1, gap: 4 }, noticeTitle: { fontSize: 15, fontWeight: '800' }, noticeText: { fontSize: 12, lineHeight: 18 },
  videoPicker: { minHeight: 190, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.lg },
  pickerTitle: { fontSize: 16, fontWeight: '800' }, videoCard: { overflow: 'hidden', borderWidth: 1, borderRadius: radius.xl },
  videoMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }, videoMetaCopy: { flex: 1 }, videoName: { fontSize: 13, fontWeight: '700' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  progressNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md }, progressText: { fontSize: 12, fontWeight: '700' },
});
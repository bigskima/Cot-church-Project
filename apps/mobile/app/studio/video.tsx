import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Button, Chip, Icon, InputField, ScreenHeader, VideoPlayer } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type VideoScope = 'public' | 'branch';
type VideoCategory = 'general' | 'teaching' | 'worship' | 'testimony' | 'interview' | 'highlights';
type SelectedVideo = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  body: Blob;
};
type UploadIntent = {
  asset: { id: string };
  uploadSession: { assetId: string; signedUploadUrl: string; storagePath: string };
};

const MAX_BYTES = 200 * 1024 * 1024;

function inferVideoMime(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType?.startsWith('video/')) return asset.mimeType.toLowerCase();
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

export default function WatchVideoCreatorScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;

  const [scope, setScope] = useState<VideoScope>(expression?.id ? 'branch' : 'public');
  const [category, setCategory] = useState<VideoCategory>('general');
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const allowed =
    mode === 'authenticated' &&
    hasCapability('media.upload') &&
    hasCapability('videos.publish');
  const selectedExpressionId = scope === 'branch' ? expression?.id ?? null : null;
  const canPublish = useMemo(
    () =>
      allowed &&
      (scope !== 'branch' || Boolean(expression?.id)) &&
      Boolean(video) &&
      Boolean(title.trim()) &&
      !working,
    [allowed, scope, expression?.id, video, title, working],
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
        setErrorMsg('Photo-library access is required to choose a Watch video. Allow access in your device settings and try again.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });
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
        setErrorMsg('Choose a Watch video that is 200 MB or smaller.');
        return;
      }

      setVideo({
        uri: asset.uri,
        fileName: asset.fileName || `watch-${Date.now()}.mp4`,
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
    await api.request('content-media', {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel_upload', assetId }),
    }).catch(() => undefined);
  };

  const publishVideo = async () => {
    if (!canPublish || !video) return;
    setWorking(true);
    setErrorMsg('');
    let assetId: string | null = null;

    try {
      setStage('Preparing secure upload…');
      const intent = await api.request<UploadIntent>('content-media', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_upload_intent',
          mediaType: 'video',
          mimeType: video.mimeType,
          expressionId: selectedExpressionId,
          durationSeconds: video.durationSeconds,
          aspectRatio: '16:9',
          fileSizeBytes: video.sizeBytes,
          fileName: video.fileName,
        }),
      });
      assetId = intent.uploadSession.assetId;

      setStage('Uploading video…');
      const uploaded = await fetch(intent.uploadSession.signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': video.mimeType },
        body: video.body,
      });
      if (!uploaded.ok) throw new Error(`Video upload failed (${uploaded.status}).`);

      setStage('Verifying upload…');
      await api.request('content-media', {
        method: 'POST',
        body: JSON.stringify({ action: 'complete_upload', assetId }),
      });

      setStage('Publishing Watch video…');
      await api.request('creator-studio', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish_video',
          expressionId: selectedExpressionId,
          visibility: scope,
          mediaAssetId: assetId,
          title: title.trim(),
          description: description.trim(),
          category,
          chapters: [],
        }),
      });

      assetId = null;
      setStage('Published');
      router.replace('/watch');
    } catch (error) {
      if (assetId) await cancelAsset(assetId);
      setStage('');
      setErrorMsg(error instanceof Error ? error.message : 'Unable to publish this Watch video.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 130 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Create Watch Video"
            kicker="MEDIA STUDIO"
            subtitle="Upload a long-form video and choose exactly where it should appear."
            showBack
          />
        </View>

        <View style={styles.body}>
          {errorMsg ? (
            <Pressable
              onPress={() => setErrorMsg('')}
              style={[styles.errorBanner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss Watch video error"
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
                <Text style={[styles.noticeTitle, { color: colors.text }]}>Watch publishing is role-scoped</Text>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  Your role must grant both media upload and Watch-video publishing authority in this church scope.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.scopeBlock}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PUBLISHING SCOPE</Text>
                <View style={styles.chipRow}>
                  <Chip label="Public Watch" selected={scope === 'public'} onPress={() => setScope('public')} />
                  {expression?.id ? (
                    <Chip label={expression.name} selected={scope === 'branch'} onPress={() => setScope('branch')} />
                  ) : null}
                </View>
                <Text style={[styles.helper, { color: colors.textMuted }]}>
                  {scope === 'public'
                    ? 'This video can appear in public Watch and discovery.'
                    : `This video stays inside ${expression?.name || 'the selected Expression'}.`}
                </Text>
              </View>

              {video ? (
                <View style={[styles.videoCard, { borderColor: colors.borderSubtle }, shadows.md]}>
                  <VideoPlayer title={video.fileName} sourceUrl={video.uri} durationSeconds={video.durationSeconds} />
                  <View style={styles.videoMeta}>
                    <View style={styles.videoMetaCopy}>
                      <Text style={[styles.videoName, { color: colors.text }]} numberOfLines={1}>{video.fileName}</Text>
                      <Text style={[styles.helper, { color: colors.textMuted }]}>
                        {(video.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </Text>
                    </View>
                    <Pressable onPress={() => !working && setVideo(null)} hitSlop={8}>
                      <Icon name="trash-outline" size={20} color={colors.live} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => void chooseVideo()}
                  style={[styles.videoPicker, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}
                >
                  <Icon name="videocam-outline" size={32} color={colors.interactive} />
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>Choose Watch Video</Text>
                  <Text style={[styles.helper, { color: colors.textMuted }]}>
                    Landscape video recommended · up to 200 MB
                  </Text>
                </Pressable>
              )}

              <InputField
                label="Title"
                value={title}
                onChangeText={setTitle}
                placeholder="Video title"
              />
              <InputField
                label="Description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                placeholder="Tell viewers what this video is about…"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
              <View style={styles.chipRow}>
                {(['general', 'teaching', 'worship', 'testimony', 'interview', 'highlights'] as VideoCategory[]).map((item) => (
                  <Chip
                    key={item}
                    label={item.charAt(0).toUpperCase() + item.slice(1)}
                    selected={category === item}
                    onPress={() => setCategory(item)}
                  />
                ))}
              </View>

              {stage ? (
                <View style={[styles.progressNotice, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="cloud-upload-outline" size={18} color={colors.interactive} />
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>{stage}</Text>
                </View>
              ) : null}

              <Button
                label="Publish Watch Video"
                onPress={publishVideo}
                loading={working}
                disabled={!canPublish}
                variant="primary"
                size="lg"
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  scopeBlock: { gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helper: { fontSize: 11, lineHeight: 16 },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderRadius: radius.xl },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '800' },
  noticeText: { fontSize: 12, lineHeight: 18 },
  videoPicker: { minHeight: 190, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.lg },
  pickerTitle: { fontSize: 16, fontWeight: '800' },
  videoCard: { overflow: 'hidden', borderWidth: 1, borderRadius: radius.xl },
  videoMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  videoMetaCopy: { flex: 1 },
  videoName: { fontSize: 13, fontWeight: '700' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  progressNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  progressText: { fontSize: 12, fontWeight: '700' },
});

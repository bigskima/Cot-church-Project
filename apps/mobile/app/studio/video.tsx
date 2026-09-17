import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useLocalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { putSignedUpload, readUploadFile } from '@/services/uploads';
import { Button, Chip, Icon, InputField, ScreenHeader, VideoPlayer } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { PLATFORM_KEYBOARD_BEHAVIOR, PLATFORM_KEYBOARD_DISMISS_MODE, PLATFORM_KEYBOARD_VERTICAL_OFFSET } from '@/utils/keyboard';

type VideoScope = 'public' | 'branch';
type CategoryOption = { category: string; label: string; aliases?: string[]; description?: string; display_order?: number };
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
  const pathname = usePathname();
  const expressionWorkspace = pathname.startsWith('/expressions/');
  const generalWorkspace = pathname.startsWith('/general/');
  const insets = useSafeAreaInsets();
  const { api, auth, context, mode, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const { scope: requestedScope } = useLocalSearchParams<{ scope?: string }>();
  const canPublishPublic = generalWorkspace && mode === 'authenticated';
  const canPublishExpression = !generalWorkspace && mode === 'authenticated' && Boolean(expression?.id) && hasCapability('media.upload') && hasCapability('videos.publish');
  const allowed = canPublishPublic || canPublishExpression;

  const categories = useResource<CategoryOption[]>(
    `watch:category-options:${organizationId || 'none'}`,
    async () => {
      if (!organizationId) return [{ category: 'general', label: 'General' }];
      try {
        const supabase = await getRuntimeSupabase(accessToken);
        const { data, error } = await supabase.rpc('get_video_category_options', { target_organization_id: organizationId });
        if (error) throw error;
        const rows = Array.isArray(data) ? data as CategoryOption[] : [];
        return rows.length ? rows : [{ category: 'general', label: 'General' }];
      } catch {
        return [{ category: 'general', label: 'General' }];
      }
    },
  );

  const [scope, setScope] = useState<VideoScope>(
    requestedScope === 'public' && canPublishPublic
      ? 'public'
      : requestedScope === 'branch' && canPublishExpression
        ? 'branch'
        : canPublishExpression
          ? 'branch'
          : 'public',
  );
  const [category, setCategory] = useState('general');
  const [categorySearch, setCategorySearch] = useState('');
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedExpressionId = scope === 'branch' ? expression?.id ?? null : null;
  const canPublishInScope = scope === 'public' ? canPublishPublic : canPublishExpression;
  const canPublish = useMemo(() => canPublishInScope && Boolean(video) && Boolean(title.trim()) && Boolean(category) && !working, [canPublishInScope, video, title, category, working]);
  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const options = categories.data ?? [];
    if (!query) return options;
    return options.filter((item) => [item.category, item.label, ...(item.aliases ?? [])].some((value) => value?.toLowerCase().includes(query)));
  }, [categories.data, categorySearch]);

  useEffect(() => {
    if (scope === 'branch' && !canPublishExpression && canPublishPublic) setScope('public');
    if (scope === 'public' && !canPublishPublic && canPublishExpression) setScope('branch');
  }, [scope, canPublishExpression, canPublishPublic]);

  useEffect(() => {
    const options = categories.data ?? [];
    if (options.length && !options.some((item) => item.category === category)) setCategory(options[0].category);
  }, [categories.data, category]);

  if (!generalWorkspace && !expressionWorkspace) {
    return <Redirect href={(expression?.id ? `/expressions/${expression.id}/manage/video` : '/general/studio/video') as any} />;
  }

  const chooseVideo = async () => {
    if (!allowed || working) return;
    try {
      setErrorMsg('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg('Photo-library access is required to choose a Watch video. Allow access in your device settings and try again.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false, quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mimeType = inferVideoMime(asset);
      const body = await readUploadFile({
        uri: asset.uri,
        name: asset.fileName || `watch-${Date.now()}.mp4`,
        mimeType,
        size: asset.fileSize,
        file: (asset as any).file,
      });
      const sizeBytes = Number(body.size || asset.fileSize || 0);
      if (!sizeBytes || sizeBytes > MAX_BYTES) {
        setErrorMsg('Choose a Watch video that is 200 MB or smaller.');
        return;
      }
      setVideo({
        uri: asset.uri,
        fileName: asset.fileName || `watch-${Date.now()}.mp4`,
        mimeType,
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
      context: generalWorkspace ? 'public' : 'current',
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
        context: generalWorkspace ? 'public' : 'current',
        body: JSON.stringify({
          action: 'create_upload_intent',
          organizationId: generalWorkspace ? organizationId || undefined : undefined,
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
      await putSignedUpload(intent.uploadSession.signedUploadUrl, {
        uri: video.uri,
        name: video.fileName,
        mimeType: video.mimeType,
        size: video.sizeBytes,
        file: video.body,
      });

      setStage('Verifying upload…');
      await api.request('content-media', {
        method: 'POST',
        context: generalWorkspace ? 'public' : 'current',
        body: JSON.stringify({ action: 'complete_upload', assetId }),
      });

      setStage('Publishing Watch video…');
      await api.request('creator-studio', {
        method: 'POST',
        context: generalWorkspace ? 'public' : 'current',
        body: JSON.stringify({
          action: 'publish_video',
          organizationId: generalWorkspace ? organizationId || undefined : undefined,
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
      router.replace((expressionWorkspace && expression?.id ? `/expressions/${expression.id}/videos` : generalWorkspace ? '/general/watch' : '/watch') as any);
    } catch (error) {
      if (assetId) await cancelAsset(assetId);
      setStage('');
      setErrorMsg(error instanceof Error ? error.message : 'Unable to publish this Watch video. Your selected video is still available to retry.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={PLATFORM_KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={PLATFORM_KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE}
        contentContainerStyle={[styles.content, { paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm, paddingBottom: expressionWorkspace ? insets.bottom + spacing.xl : insets.bottom + 130 }]}
      >
        {!expressionWorkspace ? (
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <ScreenHeader title="Create Watch Video" kicker={generalWorkspace ? 'GENERAL COT' : 'MEDIA STUDIO'} subtitle={expressionWorkspace ? `Publish a long-form video inside ${expression?.name ?? 'this Expression'}.` : generalWorkspace ? 'Publish a long-form video to General COT.' : 'Upload a long-form video and choose exactly where it should appear.'} showBack />
          </View>
        ) : null}

        <View style={styles.body}>
          {errorMsg ? <Pressable onPress={() => setErrorMsg('')} style={[styles.errorBanner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]} accessibilityRole="button" accessibilityLabel="Dismiss Watch video error"><Icon name="alert-circle-outline" size={17} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{errorMsg}</Text><Icon name="close" size={14} color={colors.live} /></Pressable> : null}

          {!allowed ? (
            <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Icon name="shield-outline" size={22} color={colors.textMuted} /><View style={styles.noticeCopy}><Text style={[styles.noticeTitle, { color: colors.text }]}>Video publishing isn’t available here</Text><Text style={[styles.noticeText, { color: colors.textSecondary }]}>Video publishing is available only in church spaces where you’ve been added to the content team.</Text></View></View>
          ) : (
            <>
              <View style={styles.scopeBlock}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PUBLISH TO</Text>
                <View style={styles.chipRow}>{canPublishPublic ? <Chip label="Public Watch" selected={scope === 'public'} onPress={() => setScope('public')} /> : null}{canPublishExpression && expression?.id ? <Chip label={expression.name} selected={scope === 'branch'} onPress={() => setScope('branch')} /> : null}</View>
                <Text style={[styles.helper, { color: colors.textMuted }]}>{scope === 'public' ? 'This video can appear in public Watch and discovery.' : `This video stays inside ${expression?.name || 'the selected Expression'}.`}</Text>
              </View>

              {video ? (
                <View style={[styles.videoCard, { borderColor: colors.borderSubtle }, shadows.md]}><VideoPlayer title={video.fileName} sourceUrl={video.uri} durationSeconds={video.durationSeconds} /><View style={styles.videoMeta}><View style={styles.videoMetaCopy}><Text style={[styles.videoName, { color: colors.text }]} numberOfLines={1}>{video.fileName}</Text><Text style={[styles.helper, { color: colors.textMuted }]}>{(video.sizeBytes / (1024 * 1024)).toFixed(1)} MB</Text></View><Pressable onPress={() => !working && setVideo(null)} hitSlop={8}><Icon name="trash-outline" size={20} color={colors.live} /></Pressable></View></View>
              ) : (
                <Pressable onPress={() => void chooseVideo()} style={[styles.videoPicker, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Icon name="videocam-outline" size={32} color={colors.interactive} /><Text style={[styles.pickerTitle, { color: colors.text }]}>Choose Watch Video</Text><Text style={[styles.helper, { color: colors.textMuted }]}>Landscape video recommended · up to 200 MB</Text></Pressable>
              )}

              <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Video title" />
              <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={5} placeholder="Tell viewers what this video is about…" />

              <View style={styles.categoryBlock}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
                <InputField label="Search categories" value={categorySearch} onChangeText={setCategorySearch} placeholder="Search teaching, worship, documentary…" autoCapitalize="none" />
                {categories.loading && !categories.data ? <Text style={[styles.helper, { color: colors.textMuted }]}>Loading categories…</Text> : filteredCategories.length ? (
                  <View style={styles.chipRow}>{filteredCategories.map((item) => <Chip key={item.category} label={item.label} selected={category === item.category} onPress={() => setCategory(item.category)} />)}</View>
                ) : (
                  <View style={[styles.categoryEmpty, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="search-outline" size={17} color={colors.textMuted} /><Text style={[styles.helper, { color: colors.textMuted }]}>No enabled category matches that search. Clear the search or ask an administrator to update Watch categories.</Text></View>
                )}
                <Text style={[styles.helper, { color: colors.textMuted }]}>Category names and availability come from COT database settings, not this app build.</Text>
              </View>

              {stage ? <View style={[styles.progressNotice, { backgroundColor: colors.primarySoft }]}><Icon name="cloud-upload-outline" size={18} color={colors.interactive} /><Text style={[styles.progressText, { color: colors.textSecondary }]}>{stage}</Text></View> : null}
              <Button label="Publish Watch Video" onPress={publishVideo} loading={working} disabled={!canPublish} variant="primary" size="lg" />
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
  categoryBlock: { gap: spacing.sm },
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
  categoryEmpty: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  progressNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  progressText: { fontSize: 12, fontWeight: '700' },
});
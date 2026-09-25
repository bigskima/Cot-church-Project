import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioPlayer,
  Button,
  Chip,
  ContentReportSheet,
  Icon,
  MediaPreviewModal,
  ResourceError,
  ScreenHeader,
  SermonSkeleton,
  VideoPlayer,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';
import { ProgressiveSermonReader } from './ProgressiveSermonReader';
import { ScripturePreviewCard } from '@/components/bible/ScriptureReferenceText';

type SermonPlayback = {
  ready: boolean;
  source: 'direct' | 'livestream_recording';
  status?: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  posterUrl?: string | null;
  durationSeconds?: number | null;
  expiresAt?: string | null;
};

const publicOrganizationId = process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

export function EnhancedSermonDetailExperience({ sermonId: id, scope = 'general', pastorMessage = false }: { sermonId: string; scope?: 'general' | 'expression'; pastorMessage?: boolean }) {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [mediaFormat, setMediaFormat] = useState<'video' | 'audio'>('video');
  const [bannerPreviewOpen, setBannerPreviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const lastSyncedSecond = useRef(0);
  const expressionMode = scope === 'expression';

  const activeOrganizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? publicOrganizationId;
  const activeExpressionId = context?.expression?.id;

  const resource = useResource<Sermon>(
    `sermon:detail:${expressionMode ? `expression:${activeExpressionId ?? 'none'}` : 'public'}:${id}`,
    async (signal) => {
      if (!id) throw new Error('This sermon is unavailable.');
      if (!expressionMode) {
        const organizationSuffix = activeOrganizationId
          ? `&organizationId=${encodeURIComponent(activeOrganizationId)}`
          : '';
        return api.request<Sermon>(
          `public-content?type=${pastorMessage ? 'pastor-message' : 'sermon'}&id=${encodeURIComponent(id)}${organizationSuffix}`,
          { signal, context: 'public' },
        );
      }
      if (!activeExpressionId) throw new Error('Enter this Expression to view its internal sermon.');
      const sermon = await api.request<Sermon>(`sermons?id=${encodeURIComponent(id)}${pastorMessage ? '&pastorMessages=true' : ''}`, { signal });
      if (!sermon || sermon.expression_id !== activeExpressionId || (pastorMessage && sermon.is_pastor_message !== true)) throw new Error(pastorMessage ? 'This Pastor’s Message is not part of this Expression.' : 'This sermon is not part of this Expression.');
      return sermon;
    },
  );

  const sermon = resource.data;
  const playbackOrganizationId = activeOrganizationId || sermon?.organization_id || '';

  const playback = useResource<SermonPlayback>(
    `sermon:playback:${expressionMode ? `expression:${activeExpressionId ?? 'none'}` : `public:${playbackOrganizationId || 'pending'}`}:${id}:${sermon?.content_item_id ?? 'pending'}`,
    (signal) => {
      if (sermon?.content_item_id) {
        try {
          const media = await api.request<any>(
            `content-media?action=playback&contentId=${encodeURIComponent(sermon.content_item_id)}`,
            { signal, context: expressionMode ? 'current' : 'public' },
          );
          const renditions = media?.renditions ?? [];
          const videoRendition = renditions.find((item: any) => item.renditionKind === 'video_stream' || item.rendition_kind === 'video_stream');
          const audioRendition = renditions.find((item: any) => item.renditionKind === 'audio_stream' || item.rendition_kind === 'audio_stream');
          if (media?.available || videoRendition || audioRendition) {
            return {
              ready: true,
              source: 'direct' as const,
              status: 'ready',
              videoUrl: videoRendition?.playbackUrl ?? null,
              audioUrl: audioRendition?.playbackUrl ?? null,
              posterUrl: null,
              durationSeconds: media?.durationSeconds ?? sermon.duration_seconds ?? null,
              expiresAt: media?.expiresAt ?? null,
            };
          }
        } catch {
          // Fall through to the legacy sermon playback path for livestream recordings.
        }
      }
      if (!expressionMode) {
        if (!playbackOrganizationId) {
          return Promise.resolve({
            ready: false,
            source: 'direct' as const,
            status: 'awaiting-sermon-context',
            videoUrl: null,
            audioUrl: null,
            posterUrl: null,
            durationSeconds: null,
            expiresAt: null,
          });
        }
        return api.request<SermonPlayback>(
          `sermon-playback?id=${encodeURIComponent(id)}&organizationId=${encodeURIComponent(playbackOrganizationId)}`,
          { signal, context: 'public' },
        );
      }
      if (!activeExpressionId) return Promise.reject(new Error('Enter this Expression to play its internal sermon.'));
      return api.request<SermonPlayback>(`sermon-playback?id=${encodeURIComponent(id)}`, { signal });
    },
  );

  const contentId = sermon?.content_item_id;

  const engagement = useResource<{ progress: { progress_seconds: number; completed: boolean } | null }>(
    `sermon:engagement:${mode}:${contentId ?? id}`,
    (signal) => mode === 'authenticated' && contentId
      ? api.request(`engagement?contentId=${contentId}&view=state`, { signal, context: expressionMode ? 'current' : 'public' })
      : Promise.resolve({ progress: null }),
  );

  const directVideoUrl = sermon?.video_url
    || sermon?.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream')?.playbackUrl
    || sermon?.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream')?.storage_path
    || (sermon?.media_assets?.media_type === 'video' ? sermon.media_assets.url : undefined);
  const directAudioUrl = sermon?.audio_url
    || sermon?.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'audio_stream')?.playbackUrl
    || sermon?.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'audio_stream')?.storage_path
    || (sermon?.media_assets?.media_type === 'audio' ? sermon.media_assets.url : undefined);

  const videoUrl = playback.data?.videoUrl || directVideoUrl;
  const audioUrl = playback.data?.audioUrl || directAudioUrl;
  const posterUrl = playback.data?.posterUrl || sermon?.thumbnail_url || sermon?.media_assets?.thumbnailUrl || sermon?.media_assets?.url;
  const durationSeconds = playback.data?.durationSeconds || sermon?.duration_seconds || sermon?.media_assets?.duration_seconds;
  const hasVideo = Boolean(videoUrl);
  const hasAudio = Boolean(audioUrl);

  useEffect(() => {
    if (hasVideo && !hasAudio) setMediaFormat('video');
    if (hasAudio && !hasVideo) setMediaFormat('audio');
  }, [hasAudio, hasVideo]);

  const syncProgress = useCallback((seconds: number, duration: number) => {
    if (mode !== 'authenticated' || !contentId || duration <= 0) return;
    const wholeSecond = Math.floor(seconds);
    if (wholeSecond - lastSyncedSecond.current < 15 && seconds < duration * 0.9) return;
    lastSyncedSecond.current = wholeSecond;
    void api.request('engagement', {
      method: 'POST',
      context: expressionMode ? 'current' : 'public',
      body: JSON.stringify({ action: 'sync_playback', contentId, progressSeconds: wholeSecond, durationSeconds: Math.floor(duration) }),
    }).catch(() => {});
  }, [api, contentId, expressionMode, mode]);

  const handleReport = () => {
    if (mode === 'visitor') {
      router.push({
        pathname: '/(auth)/login',
        params: { returnTo: expressionMode && activeExpressionId ? `${pastorMessage ? `/expressions/${activeExpressionId}/pastor-messages` : `/expressions/${activeExpressionId}/sermons`}/${id}` : `${pastorMessage ? '/general/pastor-messages' : '/general/sermon'}/${id}` },
      } as any);
      return;
    }
    if (contentId) setReportOpen(true);
  };

  const mediaPending = Boolean(sermon?.recording_id && playback.data && !playback.data.ready && playback.data.status !== 'awaiting-sermon-context');

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <ScreenHeader
          title={sermon?.title ?? (pastorMessage ? 'Pastor’s Message' : 'Sermon')}
          kicker={pastorMessage ? 'PASTOR’S MESSAGE' : 'SERMON'}
          subtitle={sermon?.preacher ? `By ${sermon.preacher}` : sermon?.sermon_date ? new Date(sermon.sermon_date).toLocaleDateString() : undefined}
          showBack
        />

        {resource.loading ? (
          <SermonSkeleton />
        ) : resource.error && !sermon ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : sermon ? (
          <View style={styles.body}>
            {posterUrl ? (
              <Pressable onPress={() => setBannerPreviewOpen(true)} accessibilityRole="button" accessibilityLabel={`View full ${sermon.title} banner`}>
                <Image source={{ uri: posterUrl }} style={styles.sermonBanner} resizeMode="cover" />
              </Pressable>
            ) : null}

            <View style={[styles.readingIntro, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={[styles.readingIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="book-outline" size={22} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.readingTitle, { color: colors.text }]}>Read without the wall of text</Text>
                <Text style={[styles.readingCopy, { color: colors.textSecondary }]}>COT reveals long sermons progressively so you can read, reflect and continue at your pace.</Text>
              </View>
            </View>

            {hasVideo || hasAudio || playback.loading || mediaPending || playback.error ? (
              <View style={styles.mediaSection}>
                {hasVideo && hasAudio ? (
                  <View style={[styles.formatRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                    <Chip label="Watch" selected={mediaFormat === 'video'} onPress={() => setMediaFormat('video')} />
                    <Chip label="Original audio" selected={mediaFormat === 'audio'} onPress={() => setMediaFormat('audio')} />
                  </View>
                ) : null}

                {playback.loading && !hasVideo && !hasAudio ? (
                  <View style={[styles.mediaState, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.mediaStateTitle, { color: colors.text }]}>Preparing sermon media…</Text>
                  </View>
                ) : mediaPending ? (
                  <View style={[styles.mediaState, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                    <Icon name="time-outline" size={20} color={colors.interactive} />
                    <Text style={[styles.mediaStateTitle, { color: colors.text }]}>Recording is still processing</Text>
                    <Text style={[styles.mediaStateText, { color: colors.textSecondary }]}>The written sermon is available now. Playback will appear automatically when the recording is ready.</Text>
                  </View>
                ) : playback.error && !hasVideo && !hasAudio ? (
                  <ResourceError message={playback.error} retry={playback.refresh} />
                ) : mediaFormat === 'video' && hasVideo ? (
                  <VideoPlayer
                    title={sermon.title}
                    sourceUrl={videoUrl}
                    posterUrl={posterUrl}
                    durationSeconds={durationSeconds}
                    chapters={sermon.chapters}
                    initialPositionSeconds={engagement.data?.progress?.completed ? 0 : engagement.data?.progress?.progress_seconds ?? 0}
                    onProgress={syncProgress}
                  />
                ) : mediaFormat === 'audio' && hasAudio ? (
                  <AudioPlayer
                    title={sermon.title}
                    speaker={sermon.preacher}
                    sourceUrl={audioUrl}
                    durationSeconds={durationSeconds}
                    initialPositionSeconds={engagement.data?.progress?.completed ? 0 : engagement.data?.progress?.progress_seconds ?? 0}
                    onProgress={syncProgress}
                  />
                ) : hasAudio ? (
                  <AudioPlayer
                    title={sermon.title}
                    speaker={sermon.preacher}
                    sourceUrl={audioUrl}
                    durationSeconds={durationSeconds}
                    initialPositionSeconds={engagement.data?.progress?.completed ? 0 : engagement.data?.progress?.progress_seconds ?? 0}
                    onProgress={syncProgress}
                  />
                ) : hasVideo ? (
                  <VideoPlayer
                    title={sermon.title}
                    sourceUrl={videoUrl}
                    posterUrl={posterUrl}
                    durationSeconds={durationSeconds}
                    chapters={sermon.chapters}
                    initialPositionSeconds={engagement.data?.progress?.completed ? 0 : engagement.data?.progress?.progress_seconds ?? 0}
                    onProgress={syncProgress}
                  />
                ) : null}
              </View>
            ) : null}

            {sermon.scripture_references?.length ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>SCRIPTURE PASSAGES</Text>
                <View style={styles.scripturePills}>
                  {sermon.scripture_references.map((reference, index) => (
                    <View key={`${reference}-${index}`} style={[styles.scripturePill, { backgroundColor: colors.bgSecondary }]}>
                      <Icon name="book-outline" size={12} color={colors.interactive} />
                      <Text style={[styles.scriptureText, { color: colors.text }]}>{reference}</Text>
                    </View>
                  ))}
                </View>
                <ScripturePreviewCard text={sermon.scripture_references.join(', ')} compact />
              </View>
            ) : null}

            <ProgressiveSermonReader sermon={sermon} />

            {contentId ? (
              <View style={[styles.safetyRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <View style={styles.safetyCopy}>
                  <Icon name="shield-outline" size={17} color={colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={[styles.safetyTitle, { color: colors.text }]}>Safety</Text>
                    <Text style={[styles.safetyText, { color: colors.textMuted }]}>Report this sermon if something needs moderation review.</Text>
                  </View>
                </View>
                <Button label="Report" onPress={handleReport} variant="outline" size="sm" />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <MediaPreviewModal
        media={posterUrl ? { url: posterUrl, type: 'image', title: `${sermon?.title || 'Sermon'} banner` } : null}
        visible={bannerPreviewOpen}
        onClose={() => setBannerPreviewOpen(false)}
      />
      <ContentReportSheet
        target={reportOpen && contentId ? {
          contentId,
          context: expressionMode ? 'current' : 'public',
          label: sermon?.title ? `Report sermon: ${sermon.title}` : 'Report this sermon',
        } : null}
        onClose={() => setReportOpen(false)}
      />
    </View>
  );
}

export default EnhancedSermonDetailExperience;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  sermonBanner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.xl, backgroundColor: '#111827' },
  readingIntro: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  readingIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  readingTitle: { fontSize: 13.5, fontWeight: '900' },
  readingCopy: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  mediaSection: { gap: spacing.md },
  formatRow: { flexDirection: 'row', gap: spacing.xs, padding: 5, borderWidth: 1, borderRadius: radius.xl, alignSelf: 'flex-start' },
  mediaState: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.xs, alignItems: 'flex-start' },
  mediaStateTitle: { fontSize: 15, fontWeight: '800' },
  mediaStateText: { fontSize: 12.5, lineHeight: 18 },
  card: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.sm },
  cardKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  scripturePills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  scripturePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  scriptureText: { fontSize: 12.5, fontWeight: '700' },
  safetyRow: { minHeight: 64, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  safetyCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  safetyTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  safetyText: { fontSize: 11, lineHeight: 16, marginTop: 1 },
});

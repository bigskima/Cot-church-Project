import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  AudioPlayer,
  Chip,
  Icon,
  ResourceError,
  ScreenHeader,
  SermonSkeleton,
  VideoPlayer,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

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

export default function SermonDetailScreen() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [mediaFormat, setMediaFormat] = useState<'video' | 'audio'>('video');
  const lastSyncedSecond = useRef(0);
  const expressionMode = requestedContext === 'expression';

  const activeOrganizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? publicOrganizationId;
  const activeExpressionId = context?.expression?.id;
  const resource = useResource<Sermon>(`sermon:detail:${expressionMode ? `expression:${activeExpressionId ?? 'none'}` : 'public'}:${id}`, (signal) => {
    if (!expressionMode) {
      if (!activeOrganizationId) return Promise.reject(new Error('Choose a church to view this sermon.'));
      return api
        .request<Sermon>(`public-content?type=sermon&id=${encodeURIComponent(id)}&organizationId=${encodeURIComponent(activeOrganizationId)}`, { signal, context: 'public' });
    }
    if (!activeExpressionId) return Promise.reject(new Error('Enter this Expression to view its internal sermon.'));
    return api.request<Sermon>(`sermons?id=${id}`, { signal });
  });

  const playback = useResource<SermonPlayback>(`sermon:playback:${expressionMode ? `expression:${activeExpressionId ?? 'none'}` : 'public'}:${id}`, (signal) => {
    if (!expressionMode) {
      if (!activeOrganizationId) return Promise.reject(new Error('Choose a church to play this sermon.'));
      return api.request<SermonPlayback>(
        `sermon-playback?id=${id}&organizationId=${encodeURIComponent(activeOrganizationId)}`,
        { signal, context: 'public' },
      );
    }
    if (!activeExpressionId) return Promise.reject(new Error('Enter this Expression to play its internal sermon.'));
    return api.request<SermonPlayback>(`sermon-playback?id=${id}`, { signal });
  });

  const sermon = resource.data;
  const contentId = sermon?.content_item_id;
  const engagement = useResource<{ progress: { progress_seconds: number; completed: boolean } | null }>(`sermon:engagement:${mode}:${contentId ?? id}`, (signal) => mode === 'authenticated' && contentId
    ? api.request(`engagement?contentId=${contentId}&view=state`, { signal, context: expressionMode ? 'current' : 'public' })
    : Promise.resolve({ progress: null }));
  const directVideoUrl =
    sermon?.video_url ||
    sermon?.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream')?.storage_path ||
    (sermon?.media_assets?.media_type === 'video' ? sermon.media_assets?.url : undefined);
  const directAudioUrl =
    sermon?.audio_url ||
    sermon?.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'audio_stream')?.storage_path ||
    (sermon?.media_assets?.media_type === 'audio' ? sermon.media_assets?.url : undefined);

  const videoUrl = playback.data?.videoUrl || directVideoUrl;
  const audioUrl = playback.data?.audioUrl || directAudioUrl;
  const posterUrl = playback.data?.posterUrl || sermon?.thumbnail_url || sermon?.media_assets?.thumbnailUrl || sermon?.media_assets?.url;
  const durationSeconds = playback.data?.durationSeconds || sermon?.duration_seconds || sermon?.media_assets?.duration_seconds;
  const hasVideo = Boolean(videoUrl);
  const hasAudio = Boolean(audioUrl);

  useEffect(() => {
    if (hasVideo && !hasAudio) setMediaFormat('video');
    if (hasAudio && !hasVideo) setMediaFormat('audio');
  }, [hasVideo, hasAudio]);

  const mediaPending = sermon?.recording_id && playback.data && !playback.data.ready;
  const syncProgress = useCallback((seconds: number, duration: number) => {
    if (mode !== 'authenticated' || !contentId || duration <= 0) return;
    const wholeSecond = Math.floor(seconds);
    if (wholeSecond - lastSyncedSecond.current < 15 && seconds < duration * 0.9) return;
    lastSyncedSecond.current = wholeSecond;
    void api.request('engagement', { method: 'POST', context: expressionMode ? 'current' : 'public', body: JSON.stringify({ action: 'sync_playback', contentId, progressSeconds: wholeSecond, durationSeconds: Math.floor(duration) }) }).catch(() => {});
  }, [api, contentId, expressionMode, mode]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
      >
        <ScreenHeader
          title={sermon?.title ?? 'Sermon'}
          kicker="SERMON"
          subtitle={sermon?.preacher ? `By ${sermon.preacher}` : sermon?.sermon_date ? new Date(sermon.sermon_date).toLocaleDateString() : undefined}
          showBack
        />

        {resource.loading ? (
          <SermonSkeleton />
        ) : resource.error && !sermon ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : sermon ? (
          <View style={styles.body}>
            {hasVideo && hasAudio ? (
              <View style={[styles.formatRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <Chip
                  label="Watch"
                  selected={mediaFormat === 'video'}
                  onPress={() => setMediaFormat('video')}
                  icon={<Icon name="videocam-outline" size={14} color={mediaFormat === 'video' ? '#FFFFFF' : colors.textSecondary} />}
                />
                <Chip
                  label="Listen"
                  selected={mediaFormat === 'audio'}
                  onPress={() => setMediaFormat('audio')}
                  icon={<Icon name="headset-outline" size={14} color={mediaFormat === 'audio' ? '#FFFFFF' : colors.textSecondary} />}
                />
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
                <Text style={[styles.mediaStateText, { color: colors.textSecondary }]}>Playback will become available automatically when the recording is ready.</Text>
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
            ) : (
              <View style={[styles.mediaState, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.mediaStateTitle, { color: colors.text }]}>Media is not available yet</Text>
                <Text style={[styles.mediaStateText, { color: colors.textSecondary }]}>This sermon can still be read below while its media is being prepared.</Text>
              </View>
            )}

            {sermon.scripture_references?.length ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>SCRIPTURE PASSAGES</Text>
                <View style={styles.scripturePills}>
                  {sermon.scripture_references.map((reference, index) => (
                    <View key={`${reference}-${index}`} style={[styles.scripturePill, { backgroundColor: colors.bgSecondary }]}>
                      <Icon name="book-outline" size={12} color={colors.interactive} />
                      <Text style={[styles.scriptureText, { color: colors.text }]}>{reference}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {sermon.description ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>SERMON NOTES</Text>
                <Text style={[styles.descriptionText, { color: colors.text }]}>{sermon.description}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  formatRow: { flexDirection: 'row', gap: spacing.xs, padding: 5, borderWidth: 1, borderRadius: radius.xl, alignSelf: 'flex-start' },
  mediaState: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.xs, alignItems: 'flex-start' },
  mediaStateTitle: { fontSize: 15, fontWeight: '700' },
  mediaStateText: { fontSize: 13, lineHeight: 19 },
  card: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.sm },
  cardKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  scripturePills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  scripturePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  scriptureText: { fontSize: 13, fontWeight: '600' },
  descriptionText: { fontSize: 14, lineHeight: 22 },
});

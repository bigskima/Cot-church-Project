import React, { useEffect, useState } from 'react';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode } = useSession();
  const { colors } = useTheme();
  const [mediaFormat, setMediaFormat] = useState<'video' | 'audio'>('video');

  const resource = useResource<Sermon>(`sermon:detail:${mode}:${id}`, (signal) => {
    if (mode === 'visitor') {
      if (!publicOrganizationId) return Promise.reject(new Error('Church configuration is unavailable.'));
      return api
        .request<Sermon[]>(`public-content?type=sermons&organizationId=${encodeURIComponent(publicOrganizationId)}`, { signal })
        .then((list) => {
          const found = list.find((sermon) => sermon.id === id);
          if (!found) throw new Error('Sermon not found.');
          return found;
        });
    }
    return api.request<Sermon>(`sermons?id=${id}`, { signal });
  });

  const playback = useResource<SermonPlayback>(`sermon:playback:${mode}:${id}`, (signal) => {
    if (mode === 'visitor') {
      if (!publicOrganizationId) return Promise.reject(new Error('Church configuration is unavailable.'));
      return api.request<SermonPlayback>(
        `sermon-playback?id=${id}&organizationId=${encodeURIComponent(publicOrganizationId)}`,
        { signal },
      );
    }
    return api.request<SermonPlayback>(`sermon-playback?id=${id}`, { signal });
  });

  const sermon = resource.data;
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
      >
        <ScreenHeader
          title={sermon?.title ?? 'Sermon'}
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
              <View style={styles.formatRow}>
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
              <View style={[styles.mediaState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.mediaStateTitle, { color: colors.text }]}>Preparing sermon media…</Text>
              </View>
            ) : mediaPending ? (
              <View style={[styles.mediaState, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              />
            ) : mediaFormat === 'audio' && hasAudio ? (
              <AudioPlayer
                title={sermon.title}
                speaker={sermon.preacher}
                sourceUrl={audioUrl}
                durationSeconds={durationSeconds}
              />
            ) : (
              <View style={[styles.mediaState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.mediaStateTitle, { color: colors.text }]}>Media is not available yet</Text>
                <Text style={[styles.mediaStateText, { color: colors.textSecondary }]}>This sermon can still be read below while its media is being prepared.</Text>
              </View>
            )}

            {sermon.scripture_references?.length ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
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
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
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
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  formatRow: { flexDirection: 'row', gap: spacing.xs },
  mediaState: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, alignItems: 'flex-start' },
  mediaStateTitle: { fontSize: 15, fontWeight: '700' },
  mediaStateText: { fontSize: 13, lineHeight: 19 },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  cardKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  scripturePills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  scripturePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  scriptureText: { fontSize: 13, fontWeight: '600' },
  descriptionText: { fontSize: 14, lineHeight: 22 },
});

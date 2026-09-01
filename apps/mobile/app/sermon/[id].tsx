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

export default function SermonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode } = useSession();
  const { colors } = useTheme();
  const [mediaFormat, setMediaFormat] = useState<'video' | 'audio'>('video');

  const resource = useResource<Sermon>(`sermon:detail:${id}`, (signal) => {
    if (mode === 'visitor') {
      return api
        .request<Sermon[]>(`public-content?type=sermons`, { signal })
        .then((list) => {
          const found = list.find((s) => s.id === id);
          if (!found) throw new Error('Sermon not found.');
          return found;
        });
    }
    return api.request<Sermon>(`sermons?id=${id}`, { signal });
  });

  const sermon = resource.data;

  const videoUrl =
    sermon?.video_url ||
    sermon?.media_assets?.renditions?.find((r: any) => r.rendition_kind === 'video_stream')?.storage_path ||
    sermon?.media_assets?.url;
  const audioUrl =
    sermon?.audio_url ||
    sermon?.media_assets?.renditions?.find((r: any) => r.rendition_kind === 'audio_stream')?.storage_path ||
    sermon?.media_assets?.url;
  const posterUrl = sermon?.thumbnail_url || sermon?.media_assets?.thumbnailUrl || sermon?.media_assets?.url;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
      >
        <ScreenHeader
          title={sermon?.title ?? 'Sermon Teaching'}
          subtitle={sermon?.preacher ? `By ${sermon.preacher}` : 'Expository preaching archive'}
          showBack
        />

        {resource.loading ? (
          <SermonSkeleton />
        ) : resource.error && !sermon ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : sermon ? (
          <View style={styles.body}>
            {/* Format Switcher (Video vs Audio) */}
            <View style={styles.formatRow}>
              <Chip
                label="Video Teaching"
                selected={mediaFormat === 'video'}
                onPress={() => setMediaFormat('video')}
                icon={<Icon name="videocam-outline" size={14} color={mediaFormat === 'video' ? '#FFFFFF' : colors.textSecondary} />}
              />
              <Chip
                label="Audio Podcast"
                selected={mediaFormat === 'audio'}
                onPress={() => setMediaFormat('audio')}
                icon={<Icon name="headset-outline" size={14} color={mediaFormat === 'audio' ? '#FFFFFF' : colors.textSecondary} />}
              />
            </View>

            {/* Media Player Surface */}
            {mediaFormat === 'video' ? (
              <VideoPlayer
                title={sermon.title}
                sourceUrl={videoUrl}
                posterUrl={posterUrl}
                durationSeconds={sermon.duration_seconds || sermon.media_assets?.duration_seconds}
              />
            ) : (
              <AudioPlayer
                title={sermon.title}
                speaker={sermon.preacher}
                sourceUrl={audioUrl}
                durationSeconds={sermon.duration_seconds || sermon.media_assets?.duration_seconds}
              />
            )}

            {/* Scripture References */}
            {sermon.scripture_references && sermon.scripture_references.length > 0 ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>SCRIPTURE PASSAGES</Text>
                <View style={styles.scripturePills}>
                  {sermon.scripture_references.map((ref, idx) => (
                    <View key={idx} style={[styles.scripturePill, { backgroundColor: colors.bgSecondary }]}>
                      <Icon name="book-outline" size={12} color={colors.interactive} />
                      <Text style={[styles.scriptureText, { color: colors.text }]}>{ref}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Sermon Description & Expository Notes */}
            {sermon.description ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <Text style={[styles.cardKicker, { color: colors.interactive }]}>SERMON NOTES & SUMMARY</Text>
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
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scripturePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  scripturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  scriptureText: {
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

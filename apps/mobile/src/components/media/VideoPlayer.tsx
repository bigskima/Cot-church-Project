import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

export interface VideoPlayerProps {
  title: string;
  sourceUrl?: string | null;
  posterUrl?: string | null;
  durationSeconds?: number | null;
  onSeek?: (seconds: number) => void;
  onProgress?: (seconds: number, durationSeconds: number) => void;
  initialPositionSeconds?: number;
  chapters?: { title: string; timestamp_seconds: number }[];
  style?: StyleProp<ViewStyle>;
}

export function VideoPlayer({
  title,
  sourceUrl,
  posterUrl,
  durationSeconds = 0,
  onSeek,
  onProgress,
  initialPositionSeconds = 0,
  chapters = [],
  style,
}: VideoPlayerProps) {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [restoredPosition, setRestoredPosition] = useState(false);

  const player = useVideoPlayer(sourceUrl || '', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    if (!player) return;

    const playingSub = player.addListener('playingChange', (status) => {
      setIsPlaying(status.isPlaying);
    });

    const statusSub = player.addListener('statusChange', (status) => {
      setIsBuffering(status.status === 'loading');
      if (player.duration) {
        setDuration(player.duration);
      }
      if (status.status === 'readyToPlay' && !restoredPosition && initialPositionSeconds > 0) {
        player.currentTime = Math.min(initialPositionSeconds, Math.max(0, player.duration - 1));
        setRestoredPosition(true);
      }
    });

    const timeSub = player.addListener('timeUpdate', (event) => {
      setCurrentTime(event.currentTime);
      onProgress?.(event.currentTime, player.duration || durationSeconds || 0);
      if (player.duration && player.duration > 0) {
        setDuration(player.duration);
      }
    });

    return () => {
      playingSub.remove();
      statusSub.remove();
      timeSub.remove();
    };
  }, [player, restoredPosition, initialPositionSeconds, onProgress, durationSeconds]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const skip = (secs: number) => {
    if (!player) return;
    player.seekBy(secs);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md, style]}>
      {/* 16:9 Video Canvas Frame */}
      <View style={[styles.videoFrame, { backgroundColor: '#000000' }]}>
        {sourceUrl && player ? (
          <VideoView
            player={player}
            style={styles.videoView}
          />
        ) : posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="play-circle-outline" size={48} color={colors.interactive} />
          </View>
        )}

        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Scrubber & Progress Bar */}
      <View style={[styles.progressBarBg, { backgroundColor: colors.borderSubtle }]}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progressPercent}%`, backgroundColor: colors.interactive },
          ]}
        />
      </View>

      {/* Playback Controls Row */}
      <View style={[styles.controlsRow, { backgroundColor: colors.card }]}>
        <View style={styles.timeGroup}>
          <Text style={[styles.timeText, { color: colors.text }]}>{formatTime(currentTime)}</Text>
          <Text style={[styles.timeText, { color: colors.textMuted }]}> / {formatTime(duration)}</Text>
        </View>

        <View style={styles.btnGroup}>
          <Pressable onPress={() => skip(-15)} hitSlop={8} style={styles.controlBtn}>
            <Icon name="play-back-outline" size={20} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={togglePlay}
            style={[styles.playBtn, { backgroundColor: colors.interactive }]}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color="#FFFFFF"
              style={!isPlaying ? { marginLeft: 2 } : undefined}
            />
          </Pressable>

          <Pressable onPress={() => skip(15)} hitSlop={8} style={styles.controlBtn}>
            <Icon name="play-forward-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Chapters Carousel if present */}
      {chapters.length > 0 ? (
        <View style={styles.chaptersSection}>
          <Text style={[styles.chaptersTitle, { color: colors.textSecondary }]}>CHAPTERS</Text>
          <View style={styles.chapterChips}>
            {chapters.map((ch, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  if (player) player.currentTime = ch.timestamp_seconds;
                  onSeek?.(ch.timestamp_seconds);
                }}
                style={[
                  styles.chapterPill,
                  { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                ]}
              >
                <Text style={[styles.chapterPillText, { color: colors.text }]}>
                  {formatTime(ch.timestamp_seconds)} {ch.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFill as any,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  progressBarBg: {
    width: '100%',
    height: 4,
  },
  progressBarFill: {
    height: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  btnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  controlBtn: {
    padding: 6,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaptersSection: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  chaptersTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chapterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chapterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chapterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

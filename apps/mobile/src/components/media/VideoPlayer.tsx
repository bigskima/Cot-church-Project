import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

export interface VideoPlayerProps {
  title: string;
  posterUrl?: string | null;
  durationSeconds?: number | null;
  currentSeconds?: number;
  onSeek?: (seconds: number) => void;
  chapters?: { title: string; timestamp_seconds: number }[];
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function VideoPlayer({
  title,
  posterUrl,
  durationSeconds = 2400,
  currentSeconds: initialSeconds = 0,
  onSeek,
  chapters = [],
  style,
}: VideoPlayerProps) {
  const { colors } = useTheme();

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(initialSeconds);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  const total = durationSeconds && durationSeconds > 0 ? durationSeconds : 2400;
  const progressPercent = Math.min(100, Math.max(0, (position / total) * 100));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const seekTo = (secs: number, chapterTitle?: string) => {
    setPosition(secs);
    if (chapterTitle) setActiveChapter(chapterTitle);
    onSeek?.(secs);
  };

  return (
    <View style={[styles.container, style]}>
      {/* 16:9 Video Canvas Frame */}
      <View style={[styles.videoFrame, { backgroundColor: '#061426' }]}>
        {posterUrl && !isPlaying ? (
          <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
        ) : null}

        {/* Play Overlay */}
        <Pressable
          onPress={togglePlay}
          style={styles.playOverlay}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <View style={[styles.playCircle, { backgroundColor: 'rgba(13, 41, 75, 0.85)' }]}>
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color="#FFFFFF"
              style={isPlaying ? undefined : { marginLeft: 3 }}
            />
          </View>
        </Pressable>

        {/* Video Scrubber & Overlays */}
        <View style={styles.controlsOverlay}>
          {activeChapter ? (
            <View style={styles.chapterPill}>
              <Icon name="bookmark" size={11} color="#8FB4F8" style={{ marginRight: 4 }} />
              <Text style={styles.chapterText}>{activeChapter}</Text>
            </View>
          ) : null}

          {/* Scrubber Track */}
          <View style={styles.scrubberContainer}>
            <View style={styles.scrubberTrack}>
              <View style={[styles.scrubberFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(total)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chapters List if available */}
      {chapters.length > 0 ? (
        <View style={styles.chaptersSection}>
          <Text style={[styles.chaptersKicker, { color: colors.interactive }]}>
            CHAPTER TIMESTAMPS
          </Text>
          <View style={styles.chaptersList}>
            {chapters.map((ch, idx) => (
              <Pressable
                key={idx}
                onPress={() => seekTo(ch.timestamp_seconds, ch.title)}
                style={({ pressed }) => [
                  styles.chapterItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.chapterTimeTag, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.chapterTimeText, { color: colors.interactive }]}>
                    {formatTime(ch.timestamp_seconds)}
                  </Text>
                </View>
                <Text
                  style={[styles.chapterItemTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {ch.title}
                </Text>
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
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
    gap: spacing.md,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  posterImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(6, 20, 38, 0.75)',
    gap: 6,
  },
  chapterPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 111, 237, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chapterText: {
    color: '#8FB4F8',
    fontSize: 11,
    fontWeight: '700',
  },
  scrubberContainer: {
    gap: 4,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: '#2F6FED',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  chaptersSection: {
    gap: spacing.xs,
  },
  chaptersKicker: {
    ...typography.kicker,
  },
  chaptersList: {
    gap: spacing.xs,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  chapterTimeTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  chapterTimeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chapterItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});

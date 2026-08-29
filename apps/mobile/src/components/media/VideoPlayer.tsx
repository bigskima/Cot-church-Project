import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

interface VideoPlayerProps {
  title: string;
  posterUrl?: string | null;
  durationSeconds?: number | null;
  currentSeconds?: number;
  onSeek?: (seconds: number) => void;
  chapters?: { title: string; timestamp_seconds: number }[];
  dark?: boolean;
}

export function VideoPlayer({
  title,
  posterUrl,
  durationSeconds = 2400,
  currentSeconds: initialSeconds = 0,
  onSeek,
  chapters = [],
  dark: forceDark,
}: VideoPlayerProps) {
  const { colors, isDark: themeDark } = useTheme();
  const isDark = forceDark !== undefined ? forceDark : themeDark;

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
    <View style={styles.container as any}>
      {/* 16:9 Video Canvas Frame */}
      <View
        style={[
          styles.videoFrame,
          { backgroundColor: isDark ? '#0D0805' : '#140C07' },
        ] as any}
      >
        {/* Play Overlay */}
        <Pressable
          onPress={togglePlay}
          style={({ pressed }) => [
            styles.playOverlay,
            pressed ? styles.pressed : null,
          ] as any}
        >
          <View style={styles.playCircle as any}>
            <Text style={styles.playIcon as any}>{isPlaying ? '❚❚' : '▶'}</Text>
          </View>
        </Pressable>

        {/* Video Scrubber & Overlays */}
        <View style={styles.controlsOverlay as any}>
          {/* Active Chapter Pill if set */}
          {activeChapter ? (
            <View style={styles.chapterPill as any}>
              <Text style={styles.chapterText as any}>📍 {activeChapter}</Text>
            </View>
          ) : null}

          {/* Scrubber Track */}
          <View style={styles.scrubberContainer as any}>
            <View style={styles.scrubberTrack as any}>
              <View style={[styles.scrubberFill, { width: `${progressPercent}%` }] as any} />
            </View>
            <View style={styles.timeRow as any}>
              <Text style={styles.timeText as any}>{formatTime(position)}</Text>
              <Text style={styles.timeText as any}>{formatTime(total)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chapters Carousel if available */}
      {chapters.length > 0 ? (
        <View style={styles.chaptersSection as any}>
          <Text style={[styles.chaptersKicker, { color: palette.gold }] as any}>
            CHAPTER TIMESTAMPS
          </Text>
          <View style={styles.chaptersList as any}>
            {chapters.map((ch, idx) => (
              <Pressable
                key={idx}
                onPress={() => seekTo(ch.timestamp_seconds, ch.title)}
                style={[
                  styles.chapterItem,
                  {
                    backgroundColor: isDark ? '#1C1008' : '#FFFDF9',
                    borderColor: isDark ? '#3D2415' : palette.line,
                  },
                ] as any}
              >
                <Text style={styles.chapterTimeTag as any}>
                  {formatTime(ch.timestamp_seconds)}
                </Text>
                <Text
                  style={[styles.chapterItemTitle, { color: colors.text }] as any}
                  numberOfLines={1}
                >
                  {ch.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
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
    ...shadows.lg,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  playIcon: {
    fontSize: 24,
    color: '#140C07',
    fontWeight: '900',
    marginLeft: 2,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(20, 12, 7, 0.75)',
    gap: 8,
  },
  chapterPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chapterText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: palette.gold,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#FFFDF9',
    fontSize: 11,
    fontWeight: '700',
  },
  chaptersSection: {
    gap: 6,
  },
  chaptersKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  chaptersList: {
    gap: 6,
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
    backgroundColor: '#2E1C11',
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chapterItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});

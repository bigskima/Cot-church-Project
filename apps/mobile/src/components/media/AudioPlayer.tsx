import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

interface AudioPlayerProps {
  title: string;
  preacherOrArtist?: string;
  durationSeconds?: number | null;
  currentSeconds?: number;
  onSeek?: (seconds: number) => void;
  scriptureReferences?: string[];
  dark?: boolean;
}

export function AudioPlayer({
  title,
  preacherOrArtist,
  durationSeconds = 1800,
  currentSeconds: initialSeconds = 0,
  onSeek,
  scriptureReferences = [],
  dark: forceDark,
}: AudioPlayerProps) {
  const { colors, isDark: themeDark } = useTheme();
  const isDark = forceDark !== undefined ? forceDark : themeDark;

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(initialSeconds);
  const [speedIndex, setSpeedIndex] = useState(0);
  const speeds = ['1.0x', '1.25x', '1.5x', '2.0x'];

  const total = durationSeconds && durationSeconds > 0 ? durationSeconds : 1800;
  const progressPercent = Math.min(100, Math.max(0, (position / total) * 100));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const skip = (delta: number) => {
    const next = Math.max(0, Math.min(total, position + delta));
    setPosition(next);
    onSeek?.(next);
  };

  const cycleSpeed = () => {
    setSpeedIndex((speedIndex + 1) % speeds.length);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1C1008' : '#FFFDF9',
          borderColor: isDark ? '#3D2415' : palette.line,
        },
        shadows.md,
      ] as any}
    >
      {/* Audio Waveform Banner */}
      <View style={styles.headerRow as any}>
        <View style={styles.iconCircle as any}>
          <Text style={{ fontSize: 20 } as any}>🎙️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }] as any} numberOfLines={1}>
            {title}
          </Text>
          {preacherOrArtist ? (
            <Text style={[styles.subtitle, { color: palette.gold }] as any} numberOfLines={1}>
              {preacherOrArtist}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={cycleSpeed} style={styles.speedPill as any}>
          <Text style={styles.speedText as any}>{speeds[speedIndex]}</Text>
        </Pressable>
      </View>

      {/* Progress Track */}
      <View style={styles.progressContainer as any}>
        <View
          style={[
            styles.progressBarTrack,
            { backgroundColor: isDark ? '#2E1C11' : '#E8D5C4' },
          ] as any}
        >
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercent}%`, backgroundColor: palette.gold },
            ] as any}
          />
        </View>
        <View style={styles.timeRow as any}>
          <Text style={[styles.timeText, { color: colors.textMuted }] as any}>
            {formatTime(position)}
          </Text>
          <Text style={[styles.timeText, { color: colors.textMuted }] as any}>
            -{formatTime(Math.max(0, total - position))}
          </Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlsRow as any}>
        <Pressable onPress={() => skip(-15)} style={styles.skipBtn as any}>
          <Text style={[styles.skipText, { color: colors.textMuted }] as any}>⟲ 15s</Text>
        </Pressable>

        <Pressable
          onPress={togglePlay}
          style={({ pressed }) => [
            styles.playBtn,
            { backgroundColor: palette.gold },
            pressed ? styles.pressed : null,
          ] as any}
        >
          <Text style={styles.playIcon as any}>{isPlaying ? '❚❚' : '▶'}</Text>
        </Pressable>

        <Pressable onPress={() => skip(15)} style={styles.skipBtn as any}>
          <Text style={[styles.skipText, { color: colors.textMuted }] as any}>15s ⟳</Text>
        </Pressable>
      </View>

      {/* Scripture Reference Badges if provided */}
      {scriptureReferences.length > 0 ? (
        <View style={styles.scripturesRow as any}>
          {scriptureReferences.map((ref, idx) => (
            <View key={idx} style={styles.scriptureBadge as any}>
              <Text style={styles.scriptureText as any}>📖 {ref}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#2E1C11',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  speedText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  progressContainer: {
    gap: 4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  playIcon: {
    fontSize: 20,
    color: '#140C07',
    fontWeight: '900',
  },
  scripturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  scriptureBadge: {
    backgroundColor: '#2E1C11',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  scriptureText: {
    color: palette.yellow,
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

export interface AudioPlayerProps {
  title: string;
  preacherOrArtist?: string;
  durationSeconds?: number | null;
  currentSeconds?: number;
  onSeek?: (seconds: number) => void;
  scriptureReferences?: string[];
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function AudioPlayer({
  title,
  preacherOrArtist,
  durationSeconds = 1800,
  currentSeconds: initialSeconds = 0,
  onSeek,
  scriptureReferences = [],
  style,
}: AudioPlayerProps) {
  const { colors, isDark } = useTheme();

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
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        shadows.sm,
        style,
      ]}
    >
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon name="headset-outline" size={20} color={colors.interactive} />
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {preacherOrArtist ? (
            <Text style={[styles.subtitle, { color: colors.interactive }]} numberOfLines={1}>
              {preacherOrArtist}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={cycleSpeed}
          hitSlop={6}
          style={[styles.speedPill, { backgroundColor: colors.bgSecondary }]}
        >
          <Text style={[styles.speedText, { color: colors.textSecondary }]}>
            {speeds[speedIndex]}
          </Text>
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBarTrack, { backgroundColor: colors.bgSecondary }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercent}%`, backgroundColor: colors.interactive },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(position)}</Text>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(total)}</Text>
        </View>
      </View>

      {/* Player Controls */}
      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => skip(-15)}
          hitSlop={8}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip backward 15 seconds"
        >
          <Icon name="play-back-outline" size={22} color={colors.text} />
          <Text style={[styles.skipLabel, { color: colors.textMuted }]}>15s</Text>
        </Pressable>

        <Pressable
          onPress={togglePlay}
          style={[
            styles.playButton,
            { backgroundColor: isDark ? '#FFFFFF' : '#0D294B' },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={isDark ? '#0D294B' : '#FFFFFF'}
          />
        </Pressable>

        <Pressable
          onPress={() => skip(15)}
          hitSlop={8}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip forward 15 seconds"
        >
          <Icon name="play-forward-outline" size={22} color={colors.text} />
          <Text style={[styles.skipLabel, { color: colors.textMuted }]}>15s</Text>
        </Pressable>
      </View>

      {/* Scripture Pills */}
      {scriptureReferences && scriptureReferences.length > 0 ? (
        <View style={[styles.scriptureRow, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.scriptureLabel, { color: colors.textMuted }]}>Scripture:</Text>
          {scriptureReferences.map((ref, idx) => (
            <View key={idx} style={[styles.scripturePill, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.scripturePillText, { color: colors.textSecondary }]}>
                {ref}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: spacing.xs,
    gap: 4,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginVertical: spacing.xs,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  skipLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scriptureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  scriptureLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scripturePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  scripturePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

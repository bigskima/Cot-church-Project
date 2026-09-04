import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

export interface AudioPlayerProps {
  title: string;
  speaker?: string;
  preacherOrArtist?: string;
  sourceUrl?: string | null;
  durationSeconds?: number | null;
  scriptureReferences?: string[];
  onSeek?: (seconds: number) => void;
  onProgress?: (seconds: number, durationSeconds: number) => void;
  initialPositionSeconds?: number;
  style?: StyleProp<ViewStyle>;
}

export function AudioPlayer({
  title,
  speaker,
  preacherOrArtist,
  sourceUrl,
  durationSeconds = 0,
  scriptureReferences,
  onSeek,
  onProgress,
  initialPositionSeconds = 0,
  style,
}: AudioPlayerProps) {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [restoredPosition, setRestoredPosition] = useState(false);

  const displaySpeaker = speaker || preacherOrArtist;

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
      if (player.duration && player.duration > 0) {
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
    onSeek?.(currentTime + secs);
  };

  const toggleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    if (player) {
      player.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.discIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="musical-notes" size={24} color={colors.interactive} />
        </View>
        <View style={styles.titleInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {displaySpeaker ? (
            <Text style={[styles.speaker, { color: colors.interactive }]} numberOfLines={1}>
              {displaySpeaker}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Progress Track (Real Track - Zero Fabricated Waveforms) */}
      <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressPercent}%`, backgroundColor: colors.interactive },
          ]}
        />
      </View>

      {/* Time indicators */}
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(currentTime)}</Text>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(duration)}</Text>
      </View>

      {/* Controls Bar */}
      <View style={styles.controlsBar}>
        <Pressable
          onPress={toggleSpeed}
          style={[styles.speedBtn, { backgroundColor: colors.bgSecondary }]}
        >
          <Text style={[styles.speedText, { color: colors.text }]}>{speed}x</Text>
        </Pressable>

        <View style={styles.playbackBtns}>
          <Pressable onPress={() => skip(-15)} hitSlop={8} style={styles.skipBtn}>
            <Icon name="play-back-outline" size={22} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={togglePlay}
            style={[styles.playBtn, { backgroundColor: colors.interactive }]}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#FFFFFF"
              style={!isPlaying ? { marginLeft: 2 } : undefined}
            />
          </Pressable>

          <Pressable onPress={() => skip(15)} hitSlop={8} style={styles.skipBtn}>
            <Icon name="play-forward-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  discIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfo: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  speaker: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playbackBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  skipBtn: {
    padding: 6,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

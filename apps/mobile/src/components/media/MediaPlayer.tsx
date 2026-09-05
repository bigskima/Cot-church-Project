import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

export interface MediaPlayerProps {
  title: string;
  preacherOrArtist?: string;
  posterUrl?: string | null;
  audioSourceUrl?: string | null;
  videoSourceUrl?: string | null;
  hasAudio: boolean;
  hasVideo: boolean;
  durationSeconds?: number | null;
  chapters?: { title: string; timestamp_seconds: number }[];
  scriptureReferences?: string[];
  initialMode?: 'watch' | 'listen';
  initialPositionSeconds?: number;
  onSeek?: (seconds: number) => void;
  onProgress?: (seconds: number, durationSeconds: number) => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function MediaPlayer({
  title,
  preacherOrArtist,
  posterUrl,
  audioSourceUrl,
  videoSourceUrl,
  hasAudio,
  hasVideo,
  durationSeconds,
  chapters = [],
  scriptureReferences = [],
  initialMode = 'watch',
  initialPositionSeconds = 0,
  onSeek,
  onProgress,
  style,
}: MediaPlayerProps) {
  const { colors } = useTheme();

  const canChoose = hasAudio && hasVideo;
  const [activeFormat, setActiveFormat] = useState<'watch' | 'listen'>(
    hasVideo ? initialMode : 'listen',
  );
  const [sharedPosition, setSharedPosition] = useState(initialPositionSeconds);

  const handleProgress = (seconds: number, duration: number) => {
    setSharedPosition(seconds);
    onProgress?.(seconds, duration);
  };

  const handleSeek = (seconds: number) => {
    setSharedPosition(seconds);
    onSeek?.(seconds);
  };

  return (
    <View style={[styles.container, style]}>
      {canChoose ? (
        <View style={[styles.modeSelector, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <Pressable
            onPress={() => setActiveFormat('watch')}
            style={({ pressed }) => [
              styles.modePill,
              activeFormat === 'watch' && { backgroundColor: colors.primarySoft },
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="videocam-outline"
              size={15}
              color={activeFormat === 'watch' ? colors.interactive : colors.textMuted}
            />
            <Text
              style={[
                styles.modePillText,
                { color: activeFormat === 'watch' ? colors.interactive : colors.textMuted },
              ]}
            >
              Watch
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFormat('listen')}
            style={({ pressed }) => [
              styles.modePill,
              activeFormat === 'listen' && { backgroundColor: colors.primarySoft },
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="headset-outline"
              size={15}
              color={activeFormat === 'listen' ? colors.interactive : colors.textMuted}
            />
            <Text
              style={[
                styles.modePillText,
                { color: activeFormat === 'listen' ? colors.interactive : colors.textMuted },
              ]}
            >
              Listen
            </Text>
          </Pressable>
        </View>
      ) : null}

      {activeFormat === 'watch' && hasVideo ? (
        <VideoPlayer
          title={title}
          sourceUrl={videoSourceUrl}
          posterUrl={posterUrl}
          durationSeconds={durationSeconds}
          chapters={chapters}
          initialPositionSeconds={sharedPosition}
          onSeek={handleSeek}
          onProgress={handleProgress}
        />
      ) : hasAudio ? (
        <AudioPlayer
          title={title}
          preacherOrArtist={preacherOrArtist}
          sourceUrl={audioSourceUrl}
          durationSeconds={durationSeconds}
          scriptureReferences={scriptureReferences}
          initialPositionSeconds={sharedPosition}
          onSeek={handleSeek}
          onProgress={handleProgress}
        />
      ) : (
        <View style={[styles.unavailable, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Icon name="hourglass-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.unavailableText, { color: colors.textSecondary }]}>Media is not available yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    padding: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    gap: 4,
  },
  modePill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  unavailable: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  unavailableText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
});

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
  hasAudio: boolean;
  hasVideo: boolean;
  durationSeconds?: number | null;
  chapters?: { title: string; timestamp_seconds: number }[];
  scriptureReferences?: string[];
  initialMode?: 'watch' | 'listen';
  onSeek?: (seconds: number) => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function MediaPlayer({
  title,
  preacherOrArtist,
  posterUrl,
  hasAudio,
  hasVideo,
  durationSeconds,
  chapters = [],
  scriptureReferences = [],
  initialMode = 'watch',
  onSeek,
  style,
}: MediaPlayerProps) {
  const { colors } = useTheme();

  const canChoose = hasAudio && hasVideo;
  const [activeFormat, setActiveFormat] = useState<'watch' | 'listen'>(
    hasVideo ? initialMode : 'listen'
  );

  return (
    <View style={[styles.container, style]}>
      {/* Format Toggle Pill if dual format exists */}
      {canChoose ? (
        <View style={[styles.modeSelector, { backgroundColor: colors.bgSecondary }]}>
          <Pressable
            onPress={() => setActiveFormat('watch')}
            style={[
              styles.modePill,
              activeFormat === 'watch' && {
                backgroundColor: colors.card,
                ...shadows.sm,
              },
            ]}
          >
            <Icon
              name="videocam-outline"
              size={15}
              color={activeFormat === 'watch' ? colors.interactive : colors.textMuted}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.modePillText,
                { color: activeFormat === 'watch' ? colors.text : colors.textMuted },
              ]}
            >
              Watch Video
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFormat('listen')}
            style={[
              styles.modePill,
              activeFormat === 'listen' && {
                backgroundColor: colors.card,
                ...shadows.sm,
              },
            ]}
          >
            <Icon
              name="headset-outline"
              size={15}
              color={activeFormat === 'listen' ? colors.interactive : colors.textMuted}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.modePillText,
                { color: activeFormat === 'listen' ? colors.text : colors.textMuted },
              ]}
            >
              Listen Audio
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Render Active Player */}
      {activeFormat === 'watch' && hasVideo ? (
        <VideoPlayer
          title={title}
          posterUrl={posterUrl}
          durationSeconds={durationSeconds}
          chapters={chapters}
          onSeek={onSeek}
        />
      ) : (
        <AudioPlayer
          title={title}
          preacherOrArtist={preacherOrArtist}
          durationSeconds={durationSeconds}
          scriptureReferences={scriptureReferences}
          onSeek={onSeek}
        />
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
    borderRadius: radius.pill,
    padding: 3,
    alignSelf: 'flex-start',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

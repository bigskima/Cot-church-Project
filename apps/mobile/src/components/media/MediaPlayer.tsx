import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';
import { useTheme } from '@/state/theme';
import { palette, radius, spacing } from '@/design-system/tokens';

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
  dark?: boolean;
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
  dark,
}: MediaPlayerProps) {
  const { colors, isDark: themeDark } = useTheme();
  const isDark = dark !== undefined ? dark : themeDark;

  // Decide active format
  const canChoose = hasAudio && hasVideo;
  const [activeFormat, setActiveFormat] = useState<'watch' | 'listen'>(
    hasVideo ? initialMode : 'listen'
  );

  return (
    <View style={styles.container as any}>
      {/* Format Toggle Pill if dual format exists */}
      {canChoose ? (
        <View
          style={[
            styles.modeSelector,
            { backgroundColor: isDark ? '#1C1008' : '#E8D5C4' },
          ] as any}
        >
          <Pressable
            onPress={() => setActiveFormat('watch')}
            style={[
              styles.modePill,
              activeFormat === 'watch' ? {
                backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
              } : null,
            ] as any}
          >
            <Text
              style={[
                styles.modePillText,
                { color: activeFormat === 'watch' ? palette.gold : colors.textMuted },
              ] as any}
            >
              ▶ Watch Video
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFormat('listen')}
            style={[
              styles.modePill,
              activeFormat === 'listen' ? {
                backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
              } : null,
            ] as any}
          >
            <Text
              style={[
                styles.modePillText,
                { color: activeFormat === 'listen' ? palette.gold : colors.textMuted },
              ] as any}
            >
              🎙️ Listen Audio
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
          dark={isDark}
        />
      ) : (
        <AudioPlayer
          title={title}
          preacherOrArtist={preacherOrArtist}
          durationSeconds={durationSeconds}
          scriptureReferences={scriptureReferences}
          onSeek={onSeek}
          dark={isDark}
        />
      )}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    alignSelf: 'flex-start',
  },
  modePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '900',
  },
});

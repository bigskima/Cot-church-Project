import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
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
  onSeek,
  onProgress,
  initialPositionSeconds = 0,
  style,
}: AudioPlayerProps) {
  const { colors } = useTheme();
  const [speed, setSpeed] = useState(1);
  const [restoredSource, setRestoredSource] = useState<string | null>(null);
  const displaySpeaker = speaker || preacherOrArtist;

  // expo-audio is the playback primitive used by the app for audio. Using the
  // video player for MP3/voice attachments caused web and Android playback to
  // remain at 0:00 even when the media URL was valid.
  const player = useAudioPlayer(sourceUrl || null, { updateInterval: 500, downloadFirst: false });
  const status = useAudioPlayerStatus(player);
  const currentTime = Number.isFinite(status.currentTime) ? status.currentTime : 0;
  const duration = status.duration > 0 ? status.duration : durationSeconds || 0;
  const isPlaying = status.playing;
  const canPlay = Boolean(sourceUrl) && !status.error;

  useEffect(() => {
    if (!sourceUrl || !status.isLoaded || restoredSource === sourceUrl || initialPositionSeconds <= 0) return;
    const target = Math.min(initialPositionSeconds, Math.max(0, (status.duration || durationSeconds || initialPositionSeconds + 1) - 0.25));
    void player.seekTo(target).then(() => setRestoredSource(sourceUrl)).catch(() => setRestoredSource(sourceUrl));
  }, [durationSeconds, initialPositionSeconds, player, restoredSource, sourceUrl, status.duration, status.isLoaded]);

  useEffect(() => {
    if (!sourceUrl) setRestoredSource(null);
  }, [sourceUrl]);

  useEffect(() => {
    onProgress?.(currentTime, duration);
  }, [currentTime, duration, onProgress]);

  const togglePlay = async () => {
    if (!canPlay) return;
    if (isPlaying) {
      player.pause();
      return;
    }
    if (status.didJustFinish && duration > 0) await player.seekTo(0);
    player.play();
  };

  const skip = async (seconds: number) => {
    if (!canPlay) return;
    const next = Math.max(0, duration > 0 ? Math.min(duration, currentTime + seconds) : currentTime + seconds);
    await player.seekTo(next);
    onSeek?.(next);
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(nextSpeed);
    player.playbackRate = nextSpeed;
  };

  const formatTime = (seconds: number) => {
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const minutes = Math.floor(safe / 60);
    const remainder = Math.floor(safe % 60);
    return `${minutes}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: status.error ? colors.live : colors.borderSubtle }, shadows.md, style]}>
      <View style={styles.header}>
        <View style={[styles.discIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="musical-notes" size={24} color={colors.interactive} />
        </View>
        <View style={styles.titleInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          {displaySpeaker ? <Text style={[styles.speaker, { color: colors.interactive }]} numberOfLines={1}>{displaySpeaker}</Text> : null}
          {status.error ? <Text style={[styles.statusText, { color: colors.live }]} numberOfLines={2}>Audio could not be loaded. Check the attachment and try again.</Text> : status.isBuffering ? <Text style={[styles.statusText, { color: colors.textMuted }]}>Loading audio…</Text> : null}
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
        <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: colors.interactive }]} />
      </View>

      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(currentTime)}</Text>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controlsBar}>
        <Pressable onPress={toggleSpeed} disabled={!canPlay} style={[styles.speedBtn, { backgroundColor: colors.bgSecondary, opacity: canPlay ? 1 : 0.5 }]} accessibilityRole="button" accessibilityLabel={`Playback speed ${speed} times`}>
          <Text style={[styles.speedText, { color: colors.text }]}>{speed}x</Text>
        </Pressable>

        <View style={styles.playbackBtns}>
          <Pressable onPress={() => void skip(-15)} disabled={!canPlay} hitSlop={8} style={[styles.skipBtn, !canPlay && styles.disabled]} accessibilityRole="button" accessibilityLabel="Skip back 15 seconds">
            <Icon name="play-back-outline" size={22} color={colors.text} />
          </Pressable>

          <Pressable onPress={() => void togglePlay()} disabled={!canPlay} style={[styles.playBtn, { backgroundColor: colors.interactive, opacity: canPlay ? 1 : 0.45 }]} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={24} color="#FFFFFF" style={!isPlaying ? { marginLeft: 2 } : undefined} />
          </Pressable>

          <Pressable onPress={() => void skip(15)} disabled={!canPlay} hitSlop={8} style={[styles.skipBtn, !canPlay && styles.disabled]} accessibilityRole="button" accessibilityLabel="Skip forward 15 seconds">
            <Icon name="play-forward-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  discIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  titleInfo: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '800' },
  speaker: { fontSize: 13, fontWeight: '600' },
  statusText: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.xs },
  timeText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  controlsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speedBtn: { minWidth: 44, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill },
  speedText: { fontSize: 12, fontWeight: '700' },
  playbackBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  skipBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  playBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});

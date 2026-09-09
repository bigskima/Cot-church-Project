import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import type { Reel } from '@/types/content';

export interface ReelCardProps {
  reel: Reel;
  onPress?: () => void;
  width?: number;
}

export function ReelCard({ reel, onPress, width = 150 }: ReelCardProps) {
  const { colors } = useTheme();
  const videoUrl =
    reel.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream')?.storage_path ||
    reel.media_assets?.url ||
    '';
  const posterUrl = reel.media_assets?.thumbnailUrl || '';
  const player = useVideoPlayer(videoUrl, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return `${views}`;
  };

  return (
    <View style={[styles.card, { width, backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
      <View style={styles.frame}>
        {videoUrl && player ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="cover"
            nativeControls
          />
        ) : posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.media} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.cardElevated }]}>
            <View style={[styles.placeholderIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="play" size={22} color={colors.interactive} />
            </View>
          </View>
        )}

        <View pointerEvents="none" style={styles.playChip}>
          <Icon name="play" size={10} color="#FFFFFF" />
          <Text style={styles.viewsText}>{formatViews(reel.views_count)}</Text>
        </View>

        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.58, 1]}
          style={styles.captionGradient}
        />

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.captionOverlay, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open reel: ${reel.caption || 'Reel'}`}
        >
          <Text style={styles.captionText} numberOfLines={2}>{reel.caption || 'Reel'}</Text>
          {reel.audio_title ? (
            <View style={styles.audioRow}>
              <View style={styles.audioIcon}><Icon name="musical-notes" size={10} color="#FFFFFF" /></View>
              <Text style={styles.audioText} numberOfLines={1}>{reel.audio_title}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.md,
  },
  frame: {
    width: '100%',
    aspectRatio: 9 / 16,
    position: 'relative',
    backgroundColor: '#050B14',
  },
  media: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playChip: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    height: 27,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.56)',
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  viewsText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  captionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
  },
  captionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  audioIcon: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  pressed: { opacity: 0.9 },
});

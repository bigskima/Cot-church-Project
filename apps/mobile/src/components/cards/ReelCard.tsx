import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, shadows } from '@/design-system/tokens';
import type { Reel } from '@/types/content';

interface ReelCardProps {
  reel: Reel;
  onPress?: () => void;
  width?: number;
}

export function ReelCard({ reel, onPress, width = 130 }: ReelCardProps) {
  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return `${views}`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width },
        shadows.sm,
        pressed ? styles.pressed : null,
      ] as any}
    >
      {/* 9:16 Background Frame */}
      <View style={styles.frame as any}>
        <Text style={{ fontSize: 28 } as any}>🎬</Text>

        {/* Top Views Badge */}
        <View style={styles.viewsBadge as any}>
          <Text style={styles.viewsText as any}>▶ {formatViews(reel.views_count)}</Text>
        </View>

        {/* Bottom Caption Overlay */}
        <View style={styles.captionOverlay as any}>
          <Text style={styles.captionText as any} numberOfLines={2}>
            {reel.caption}
          </Text>
          {reel.audio_title ? (
            <Text style={styles.audioText as any} numberOfLines={1}>
              🎵 {reel.audio_title}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3D2415',
    backgroundColor: '#1C1008',
  },
  frame: {
    width: '100%',
    aspectRatio: 9 / 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#22140C',
  },
  viewsBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(20, 12, 7, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  viewsText: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(13, 8, 5, 0.85)',
    gap: 2,
  },
  captionText: {
    color: '#FFFDF9',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  audioText: {
    color: palette.yellow,
    fontSize: 9,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

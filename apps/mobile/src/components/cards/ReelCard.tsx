import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import type { Reel } from '@/types/content';

export interface ReelCardProps {
  reel: Reel;
  onPress?: () => void;
  width?: number;
}

export function ReelCard({ reel, onPress, width = 130 }: ReelCardProps) {
  const { colors } = useTheme();

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return `${views}`;
  };

  const thumbnailUrl = reel.media_assets?.thumbnailUrl || reel.media_assets?.url;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.card, borderColor: colors.border },
        shadows.sm,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Reel: ${reel.caption}`}
    >
      <View style={styles.frame}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: '#091B33' }]}>
            <Icon name="film-outline" size={24} color="#5C8FF5" />
          </View>
        )}

        {/* Top Views Badge */}
        <View style={styles.viewsBadge}>
          <Icon name="play" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.viewsText}>{formatViews(reel.views_count)}</Text>
        </View>

        {/* Bottom Caption Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(6, 20, 38, 0.85)', 'rgba(6, 20, 38, 0.98)']}
          style={styles.captionOverlay}
        >
          <Text style={styles.captionText} numberOfLines={2}>
            {reel.caption}
          </Text>
          {reel.audio_title ? (
            <View style={styles.audioRow}>
              <Icon name="musical-notes" size={10} color="#8FB4F8" style={{ marginRight: 3 }} />
              <Text style={styles.audioText} numberOfLines={1}>
                {reel.audio_title}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  frame: {
    width: '100%',
    aspectRatio: 9 / 16,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewsBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 20, 38, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  viewsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 2,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioText: {
    color: '#8FB4F8',
    fontSize: 9,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

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

export function ReelCard({ reel, onPress, width = 150 }: ReelCardProps) {
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
        { width, backgroundColor: colors.card, borderColor: colors.borderSubtle },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Reel: ${reel.caption}`}
    >
      <View style={styles.frame}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.cardElevated }]}>
            <View style={[styles.placeholderIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="play" size={22} color={colors.interactive} />
            </View>
          </View>
        )}

        <View style={styles.playChip}>
          <Icon name="play" size={10} color="#FFFFFF" />
          <Text style={styles.viewsText}>{formatViews(reel.views_count)}</Text>
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.48, 1]}
          style={styles.captionOverlay}
        >
          <Text style={styles.captionText} numberOfLines={2}>
            {reel.caption || 'Reel'}
          </Text>
          {reel.audio_title ? (
            <View style={styles.audioRow}>
              <View style={styles.audioIcon}>
                <Icon name="musical-notes" size={10} color="#FFFFFF" />
              </View>
              <Text style={styles.audioText} numberOfLines={1}>{reel.audio_title}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    </Pressable>
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
  },
  thumbnail: { width: '100%', height: '100%' },
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
  viewsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: '43%',
    justifyContent: 'flex-end',
    padding: spacing.md,
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
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Video } from '@/types/content';

interface VideoCardProps {
  video: Video;
  expressionName?: string;
  onPress?: () => void;
  onBookmark?: () => void;
  dark?: boolean;
}

export function VideoCard({
  video,
  expressionName = 'Sanctuary Expression',
  onPress,
  onBookmark,
  dark: forceDark,
}: VideoCardProps) {
  const { colors, isDark: themeDark } = useTheme();
  const isDark = forceDark !== undefined ? forceDark : themeDark;

  const formatDuration = (secs?: number | null) => {
    if (!secs || secs <= 0) return 'Watch';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? '#1C1008' : '#FFFDF9',
          borderColor: isDark ? '#3D2415' : palette.line,
        },
        shadows.sm,
        pressed ? styles.pressed : null,
      ] as any}
    >
      {/* 16:9 Thumbnail Banner */}
      <View
        style={[
          styles.thumbnailFrame,
          { backgroundColor: isDark ? '#0D0805' : '#22140C' },
        ] as any}
      >
        <Text style={{ fontSize: 32 } as any}>🎬</Text>
        {/* Duration Pill */}
        <View style={styles.durationPill as any}>
          <Text style={styles.durationText as any}>
            {formatDuration(video.media_assets?.duration_seconds)}
          </Text>
        </View>
        {/* Category Pill */}
        <View style={styles.categoryPill as any}>
          <Text style={styles.categoryText as any}>{video.category.toUpperCase()}</Text>
        </View>
      </View>

      {/* Video Details Body */}
      <View style={styles.body as any}>
        <View style={styles.avatarCircle as any}>
          <Text style={{ fontSize: 14 } as any}>🏛️</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, { color: colors.text }] as any} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={[styles.expressionText, { color: palette.gold }] as any} numberOfLines={1}>
            {expressionName}
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }] as any}>
            {formatViews(video.views_count)} • {new Date(video.created_at).toLocaleDateString()}
          </Text>
        </View>
        {onBookmark ? (
          <Pressable onPress={onBookmark} style={styles.bookmarkBtn as any}>
            <Text style={{ fontSize: 16 } as any}>🔖</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  thumbnailFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  durationPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(20, 12, 7, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFDF9',
    fontSize: 11,
    fontWeight: '800',
  },
  categoryPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(120, 53, 15, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  categoryText: {
    color: palette.yellow,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  body: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: 12,
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  expressionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bookmarkBtn: {
    padding: 6,
  },
  pressed: {
    opacity: 0.9,
  },
});

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Badge } from '../Badge';
import type { Video } from '@/types/content';

export interface VideoCardProps {
  video: Video;
  expressionName?: string;
  onPress?: () => void;
  onBookmark?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function VideoCard({
  video,
  expressionName,
  onPress,
  onBookmark,
  style,
}: VideoCardProps) {
  const { colors } = useTheme();

  const formatDuration = (secs?: number | null) => {
    if (!secs || secs <= 0) return null;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  const thumbnailUrl = video.media_assets?.thumbnailUrl || video.media_assets?.url;
  const duration = formatDuration(video.media_assets?.duration_seconds);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        shadows.sm,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Video: ${video.title}`}
    >
      {/* 16:9 Thumbnail Banner */}
      <View style={[styles.thumbnailFrame, { backgroundColor: '#091B33' }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="play-circle-outline" size={40} color="#5C8FF5" />
          </View>
        )}

        {/* Category Badge */}
        {video.category ? (
          <View style={styles.categoryBadge}>
            <Badge label={video.category} variant="primary" />
          </View>
        ) : null}

        {/* Duration Pill */}
        {duration ? (
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>

      {/* Video Details Body */}
      <View style={styles.body}>
        <View style={styles.contentColumn}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {video.title}
          </Text>
          {expressionName ? (
            <Text style={[styles.expressionText, { color: colors.interactive }]} numberOfLines={1}>
              {expressionName}
            </Text>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {formatViews(video.views_count)} • {new Date(video.created_at).toLocaleDateString()}
          </Text>
        </View>

        {onBookmark ? (
          <Pressable
            onPress={onBookmark}
            hitSlop={8}
            style={styles.bookmarkBtn}
            accessibilityRole="button"
            accessibilityLabel="Bookmark video"
          >
            <Icon name="bookmark-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  thumbnailFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  durationPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(6, 20, 38, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: 10,
    alignItems: 'flex-start',
  },
  contentColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h3,
    fontSize: 14,
    lineHeight: 19,
  },
  expressionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
  },
  bookmarkBtn: {
    padding: 4,
  },
  pressed: {
    opacity: 0.9,
  },
});

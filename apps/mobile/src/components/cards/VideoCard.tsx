import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing, typography } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
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

  const timeAgo = () => {
    const d = new Date(video.created_at);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Video: ${video.title}`}
    >
      {/* 16:9 Thumbnail Banner (YouTube style) */}
      <View style={[styles.thumbnailFrame, { backgroundColor: colors.cardBorder }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="play-circle-outline" size={44} color={colors.interactive} />
          </View>
        )}

        {/* Duration Badge Bottom Right */}
        {duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>

      {/* Video Details Row (Avatar + Title + Meta + Menu) */}
      <View style={styles.metaRow}>
        <Avatar name={expressionName || 'Church'} size="sm" />

        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {expressionName ? `${expressionName} · ` : ''}
            {formatViews(video.views_count)} · {timeAgo()}
          </Text>
        </View>

        <Pressable
          onPress={onBookmark}
          hitSlop={8}
          style={styles.moreBtn}
          accessibilityRole="button"
          accessibilityLabel="Options"
        >
          <Icon name="ellipsis-vertical" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  thumbnailFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: 2,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  moreBtn: {
    padding: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});

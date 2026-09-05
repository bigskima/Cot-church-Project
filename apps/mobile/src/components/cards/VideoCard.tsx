import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
import type { Video } from '@/types/content';

export interface VideoCardProps {
  video: Video;
  expressionName?: string;
  onPress?: () => void;
  onBookmark?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export function VideoCard({ video, expressionName, onPress, onBookmark, style }: VideoCardProps) {
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
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        pressed && { opacity: 0.94, transform: [{ scale: 0.992 }] },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Video: ${video.title}`}
    >
      <View style={[styles.thumbnailFrame, { backgroundColor: colors.cardElevated }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <View style={[styles.playButton, { backgroundColor: colors.primarySoftStrong }]}>
              <Icon name="play" size={24} color={colors.interactive} />
            </View>
          </View>
        )}

        {duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Avatar name={expressionName || 'Church'} size="sm" />

        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{video.title}</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {expressionName ? `${expressionName} · ` : ''}{formatViews(video.views_count)} · {timeAgo()}
          </Text>
        </View>

        <Pressable
          onPress={onBookmark}
          hitSlop={8}
          style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: colors.bgSecondary }]}
          accessibilityRole="button"
          accessibilityLabel="Video options"
        >
          <Icon name="ellipsis-horizontal" size={19} color={colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  thumbnailFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  thumbnail: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  textColumn: { flex: 1, gap: 3, minWidth: 0 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.18,
  },
  metaText: { fontSize: 12, lineHeight: 16 },
  moreBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

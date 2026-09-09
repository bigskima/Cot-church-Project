import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
import { InlineCommentsSheet, type InlineCommentsContext } from '../engagement/InlineCommentsSheet';
import type { Video } from '@/types/content';

export interface VideoCardProps {
  video: Video;
  expressionName?: string;
  onPress?: () => void;
  onBookmark?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  commentContext?: InlineCommentsContext;
  onOpenComments?: () => void;
}

export function VideoCard({ video, expressionName, onPress, onBookmark, style, commentContext, onOpenComments }: VideoCardProps) {
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const contentId = video.content_items?.id;
  const resolvedCommentContext = commentContext ?? (video.content_items?.expression_id ? 'current' : 'public');
  const streamRendition = video.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream');
  const sourceUrl =
    video.media_assets?.url ||
    streamRendition?.playbackUrl ||
    streamRendition?.storage_path ||
    '';
  const posterUrl = video.media_assets?.thumbnailUrl || '';
  const player = useVideoPlayer(sourceUrl, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

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

  const duration = formatDuration(video.media_assets?.duration_seconds);
  const sourceName = expressionName || video.content_items?.expression?.name || video.content_items?.organization?.name || null;
  const creatorName = video.content_items?.author?.display_name || sourceName || 'COT';
  const creatorAvatar = video.content_items?.author?.avatar_url ?? undefined;

  const timeAgo = () => {
    const d = new Date(video.created_at);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, style]}>
      <View style={[styles.thumbnailFrame, { backgroundColor: colors.cardElevated }]}>
        {sourceUrl && player ? (
          <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />
        ) : posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.media} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <View style={[styles.playButton, { backgroundColor: colors.primarySoftStrong }]}>
              <Icon name="play" size={24} color={colors.interactive} />
            </View>
          </View>
        )}
        {duration ? <View pointerEvents="none" style={styles.durationBadge}><Text style={styles.durationText}>{duration}</Text></View> : null}
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.metaRow, pressed && { opacity: 0.82 }]}
        accessibilityRole="button"
        accessibilityLabel={`Open video: ${video.title}`}
      >
        <Avatar url={creatorAvatar} name={creatorName} size="sm" />
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{video.title}</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {[sourceName, formatViews(video.views_count), timeAgo()].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {contentId ? (
          <Pressable
            onPress={(event) => { event.stopPropagation?.(); setCommentsOpen(true); }}
            hitSlop={8}
            style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: colors.bgSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Open video comments"
          >
            <Icon name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {onBookmark ? (
          <Pressable
            onPress={(event) => { event.stopPropagation?.(); onBookmark(); }}
            hitSlop={8}
            style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: colors.bgSecondary }]}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${video.title}`}
          >
            <Icon name="ellipsis-horizontal" size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
      <InlineCommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        contentId={contentId}
        context={resolvedCommentContext}
        title="Video comments"
        subtitle="Keep watching while the conversation stays with this video."
        onViewAll={onOpenComments}
      />
    </View>
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
    backgroundColor: '#000000',
  },
  media: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm,
  },
  durationText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  textColumn: { flex: 1, gap: 3, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20, letterSpacing: -0.18 },
  metaText: { fontSize: 12, lineHeight: 16 },
  moreBtn: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});

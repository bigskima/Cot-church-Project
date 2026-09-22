import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
import { CompactIdentityBadge } from '../identity/PublicIdentityBadge';
import { InlineCommentsSheet, type InlineCommentsContext } from '../engagement/InlineCommentsSheet';
import type { Video } from '@/types/content';

function assetAspectRatio(video: Video) {
  const asset = video.media_assets;
  if (asset?.width && asset?.height && asset.width > 0 && asset.height > 0) return asset.width / asset.height;
  const raw = asset?.aspect_ratio;
  if (typeof raw !== 'string') return 16 / 9;
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width > 0 && height > 0) return width / height;
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 16 / 9;
}

export interface VideoCardProps {
  video: Video;
  expressionName?: string;
  onPress?: () => void;
  onBookmark?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  commentContext?: InlineCommentsContext;
  onOpenComments?: () => void;
  onPressCreator?: () => void;
  variant?: 'card' | 'feed';
}

export function VideoCard({ video, expressionName, onPress, onBookmark, style, commentContext, onOpenComments, onPressCreator, variant = 'card' }: VideoCardProps) {
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const contentId = video.content_items?.id;
  const resolvedCommentContext = commentContext ?? (video.content_items?.expression_id ? 'current' : 'public');
  const streamRendition = video.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream');
  const sourceUrl = video.media_assets?.url || streamRendition?.playbackUrl || streamRendition?.storage_path || '';
  const posterUrl = video.media_assets?.thumbnailUrl || '';
  const player = useVideoPlayer(sourceUrl, (instance) => { instance.loop = false; instance.muted = true; });
  const mediaRatio = assetAspectRatio(video);

  const formatDuration = (secs?: number | null) => {
    if (!secs || secs <= 0) return null;
    const m = Math.floor(secs / 60); const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
  const formatViews = (views: number) => views >= 1000000 ? `${(views / 1000000).toFixed(1)}M views` : views >= 1000 ? `${(views / 1000).toFixed(1)}K views` : `${views} views`;
  const duration = formatDuration(video.media_assets?.duration_seconds);
  const sourceName = expressionName || video.content_items?.expression?.name || video.content_items?.organization?.name || null;
  const creatorName = video.content_items?.author?.display_name || sourceName || 'COT';
  const creatorAvatar = video.content_items?.author?.avatar_url ?? undefined;
  const creatorBadge = video.content_items?.author?.badges?.[0];
  const timeAgo = () => {
    const d = new Date(video.created_at); const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[styles.container, variant === 'feed' && styles.feedContainer, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, variant === 'card' ? shadows.sm : null, style]}>
      <View style={[styles.thumbnailFrame, variant === 'feed' && styles.feedThumbnail, { backgroundColor: colors.cardElevated, aspectRatio: mediaRatio }]}>
        {sourceUrl && player ? (
          variant === 'feed' ? (
            <View pointerEvents="none" style={styles.media}>
              <VideoView player={player} style={styles.media} contentFit="contain" nativeControls={false} />
            </View>
          ) : (
            <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />
          )
        ) : posterUrl ? <Image source={{ uri: posterUrl }} style={styles.media} resizeMode="cover" /> : <View style={styles.placeholder}><View style={[styles.playButton, { backgroundColor: colors.primarySoftStrong }]}><Icon name="play" size={24} color={colors.interactive} /></View></View>}
        {duration ? <View pointerEvents="none" style={styles.durationBadge}><Text style={styles.durationText}>{duration}</Text></View> : null}
        {variant === 'feed' ? <View pointerEvents="none" style={styles.typeBadge}><Icon name="videocam" size={11} color="#FFFFFF" /><Text style={styles.typeBadgeText}>VIDEO</Text></View> : null}
      </View>

      <Pressable onPress={onPress} style={({ pressed }) => [styles.metaRow, variant === 'feed' && styles.feedMetaRow, pressed && { opacity: 0.82 }]} accessibilityRole="button" accessibilityLabel={`Open video: ${video.title}`}>
        <Pressable onPress={(event) => { if (!onPressCreator) return; event.stopPropagation?.(); onPressCreator(); }} disabled={!onPressCreator} hitSlop={6} accessibilityRole={onPressCreator ? 'button' : undefined} accessibilityLabel={onPressCreator ? `Open ${creatorName} profile` : undefined}>
          <Avatar url={creatorAvatar} name={creatorName} size="sm" />
        </Pressable>
        <View style={styles.textColumn}>
          <Text style={[styles.title, variant === 'feed' && styles.feedTitle, { color: colors.text }]} numberOfLines={2}>{video.title}</Text>
          <View style={styles.creatorMetaRow}>
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{creatorName}</Text>
            {creatorBadge ? <CompactIdentityBadge badge={creatorBadge} size={14} /> : null}
          </View>
          <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>{[sourceName, formatViews(video.views_count), timeAgo()].filter(Boolean).join(' · ')}</Text>
        </View>
        {contentId ? <Pressable onPress={(event) => { event.stopPropagation?.(); setCommentsOpen(true); }} hitSlop={8} style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Open video comments"><Icon name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} /></Pressable> : null}
        {onBookmark ? (
          <Pressable onPress={(event) => { event.stopPropagation?.(); onBookmark(); }} hitSlop={8} style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel={`Options for ${video.title}`}>
            <Icon name="ellipsis-horizontal" size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
      <InlineCommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} contentId={contentId} context={resolvedCommentContext} title="Video comments" subtitle="Keep watching while the conversation stays with this video." onViewAll={onOpenComments} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', borderWidth: 1, borderRadius: radius.card, padding: spacing.sm, marginBottom: spacing.md },
  feedContainer: { borderRadius: radius.xxl, marginBottom: 0, padding: 7 },
  thumbnailFrame: { width: '100%', position: 'relative', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000000' },
  feedThumbnail: { borderRadius: radius.xl },
  media: { width: '100%', height: '100%' }, placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' }, playButton: { width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.78)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm }, durationText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  typeBadge: { position: 'absolute', top: 9, left: 9, minHeight: 25, borderRadius: radius.pill, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(5,11,20,0.72)' }, typeBadgeText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.xs },
  feedMetaRow: { paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  textColumn: { flex: 1, gap: 3, minWidth: 0 }, creatorMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }, title: { fontSize: 15, fontWeight: '700', lineHeight: 20, letterSpacing: -0.18 }, feedTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3 }, metaText: { fontSize: 11.5, lineHeight: 16 }, moreBtn: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});

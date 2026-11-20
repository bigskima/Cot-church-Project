import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
import { CompactIdentityBadge } from '../identity/PublicIdentityBadge';
import { InlineCommentsSheet, type InlineCommentsContext } from '../engagement/InlineCommentsSheet';
import type { Reel } from '@/types/content';

export interface ReelCardProps {
  reel: Reel;
  onPress?: () => void;
  width?: number;
  commentContext?: InlineCommentsContext;
  onOpenComments?: () => void;
  onPressCreator?: () => void;
  variant?: 'tile' | 'feed';
}

export function ReelCard({ reel, onPress, width = 150, commentContext, onOpenComments, onPressCreator, variant = 'tile' }: ReelCardProps) {
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const contentId = reel.content_items?.id;
  const resolvedCommentContext = commentContext ?? (reel.content_items?.expression_id ? 'current' : 'public');
  const streamRendition = reel.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream');
  const videoUrl = reel.media_assets?.url || streamRendition?.playbackUrl || streamRendition?.storage_path || '';
  const posterUrl = reel.media_assets?.thumbnailUrl || '';
  const player = useVideoPlayer(videoUrl, (instance) => { instance.loop = true; instance.muted = true; });
  const creator = reel.content_items?.author;
  const creatorName = creator?.display_name || reel.content_items?.expression?.name || reel.content_items?.organization?.name || 'COT';
  const creatorBadge = creator?.badges?.[0];
  const rawRatio = reel.media_assets?.aspect_ratio;
  const sourceRatio = typeof rawRatio === 'string'
    ? (() => {
        const match = rawRatio.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
        if (match) {
          const w = Number(match[1]);
          const h = Number(match[2]);
          return w > 0 && h > 0 ? w / h : undefined;
        }
        const numeric = Number(rawRatio);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
      })()
    : reel.media_assets?.width && reel.media_assets?.height
      ? reel.media_assets.width / reel.media_assets.height
      : undefined;
  const formatViews = (views: number) => views >= 1000000 ? `${(views / 1000000).toFixed(1)}M` : views >= 1000 ? `${(views / 1000).toFixed(1)}K` : `${views}`;

  return (
    <View style={[styles.card, variant === 'feed' && styles.feedCard, { width, backgroundColor: colors.card, borderColor: colors.borderSubtle }, variant === 'tile' ? shadows.md : shadows.sm]}>
      <View style={[styles.frame, { aspectRatio: sourceRatio ?? (variant === 'feed' ? 4 / 5 : 9 / 16) }]}>
        {videoUrl && player ? (
          variant === 'feed' ? (
            <View pointerEvents="none" style={styles.media}>
              <VideoView player={player} style={styles.media} contentFit="cover" nativeControls={false} />
            </View>
          ) : (
            <VideoView player={player} style={styles.media} contentFit="cover" nativeControls />
          )
        ) : posterUrl ? <Image source={{ uri: posterUrl }} style={styles.media} resizeMode="cover" /> : <View style={[styles.placeholder, { backgroundColor: colors.cardElevated }]}><View style={[styles.placeholderIcon, { backgroundColor: colors.primarySoft }]}><Icon name="play" size={22} color={colors.interactive} /></View></View>}
        <View pointerEvents="none" style={styles.reelLabel}><Icon name="flash" size={11} color="#FFFFFF" /><Text style={styles.reelLabelText}>REEL</Text></View>
        <View pointerEvents="none" style={styles.playChip}><Icon name="play" size={10} color="#FFFFFF" /><Text style={styles.viewsText}>{formatViews(reel.views_count)}</Text></View>
        {contentId ? <Pressable onPress={() => setCommentsOpen(true)} style={styles.commentChip} accessibilityRole="button" accessibilityLabel="Open Reel comments"><Icon name="chatbubble-ellipses-outline" size={14} color="#FFFFFF" /><Text style={styles.viewsText}>{reel.comments_count || 0}</Text></Pressable> : null}
        <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0.82)']} locations={[0, 0.52, 1]} style={styles.captionGradient} />
        <Pressable onPress={onPress} style={({ pressed }) => [styles.captionOverlay, variant === 'feed' && styles.feedCaptionOverlay, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open reel: ${reel.caption || 'Reel'}`}>
          {variant === 'feed' ? (
            <Pressable
              onPress={(event) => { event.stopPropagation?.(); onPressCreator?.(); }}
              disabled={!onPressCreator}
              style={styles.creatorRow}
              accessibilityRole={onPressCreator ? 'link' : undefined}
              accessibilityLabel={onPressCreator ? `Open ${creatorName} profile` : undefined}
            >
              <Avatar url={creator?.avatar_url ?? undefined} name={creatorName} size="xs" />
              <Text style={styles.creatorName} numberOfLines={1}>{creatorName}</Text>
              {creatorBadge ? <CompactIdentityBadge badge={creatorBadge} size={15} /> : null}
            </Pressable>
          ) : null}
          <Text style={[styles.captionText, variant === 'feed' && styles.feedCaptionText]} numberOfLines={variant === 'feed' ? 3 : 2}>{reel.caption || 'Reel'}</Text>
          {reel.audio_title ? <View style={styles.audioRow}><View style={styles.audioIcon}><Icon name="musical-notes" size={10} color="#FFFFFF" /></View><Text style={styles.audioText} numberOfLines={1}>{reel.audio_title}</Text></View> : null}
          {variant === 'feed' ? <View style={styles.openRow}><Text style={styles.openText}>Open Reel</Text><Icon name="arrow-forward" size={14} color="#FFFFFF" /></View> : null}
        </Pressable>
      </View>
      <InlineCommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} contentId={contentId} context={resolvedCommentContext} title="Reel comments" subtitle="Keep this Reel in place while you join the conversation." onViewAll={onOpenComments} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1 },
  feedCard: { borderRadius: radius.xxl },
  frame: { width: '100%', position: 'relative', backgroundColor: '#050B14' },
  media: { width: '100%', height: '100%' }, placeholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }, placeholderIcon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  reelLabel: { position: 'absolute', top: spacing.sm, left: spacing.sm, minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 8, borderRadius: radius.pill }, reelLabelText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  playChip: { position: 'absolute', top: spacing.sm, left: 66, height: 27, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.56)', paddingHorizontal: 8, borderRadius: radius.pill }, viewsText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  commentChip: { position: 'absolute', top: 8, right: 8, minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.56)', paddingHorizontal: 8, borderRadius: radius.pill, zIndex: 4 },
  captionGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%' },
  captionOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, paddingTop: spacing.xl, gap: spacing.xs }, feedCaptionOverlay: { padding: spacing.lg, paddingTop: spacing.xxl },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, alignSelf: 'flex-start', maxWidth: '88%' },
  creatorName: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '900', flexShrink: 1 },
  captionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 17, letterSpacing: -0.15 }, feedCaptionText: { fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, audioIcon: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }, audioText: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  openRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }, openText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.88 },
});

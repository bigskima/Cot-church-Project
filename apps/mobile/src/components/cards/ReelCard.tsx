import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { InlineCommentsSheet, type InlineCommentsContext } from '../engagement/InlineCommentsSheet';
import type { Reel } from '@/types/content';

export interface ReelCardProps {
  reel: Reel;
  onPress?: () => void;
  width?: number;
  commentContext?: InlineCommentsContext;
  onOpenComments?: () => void;
  variant?: 'tile' | 'feed';
}

export function ReelCard({ reel, onPress, width = 150, commentContext, onOpenComments, variant }: ReelCardProps) {
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const resolvedVariant = variant ?? (width >= 260 ? 'feed' : 'tile');
  const contentId = reel.content_items?.id;
  const resolvedCommentContext = commentContext ?? (reel.content_items?.expression_id ? 'current' : 'public');
  const streamRendition = reel.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream');
  const videoUrl = reel.media_assets?.url || streamRendition?.playbackUrl || streamRendition?.storage_path || '';
  const posterUrl = reel.media_assets?.thumbnailUrl || '';
  const player = useVideoPlayer(videoUrl, (instance) => { instance.loop = true; instance.muted = true; });
  const formatViews = (views: number) => views >= 1000000 ? `${(views / 1000000).toFixed(1)}M` : views >= 1000 ? `${(views / 1000).toFixed(1)}K` : `${views}`;

  return (
    <View style={[styles.card, resolvedVariant === 'feed' && styles.feedCard, { width, backgroundColor: colors.card, borderColor: colors.borderSubtle }, resolvedVariant === 'tile' ? shadows.md : shadows.sm]}>
      <View style={[styles.frame, resolvedVariant === 'feed' && styles.feedFrame]}>
        {videoUrl && player ? <VideoView player={player} style={styles.media} contentFit="cover" nativeControls /> : posterUrl ? <Image source={{ uri: posterUrl }} style={styles.media} resizeMode="cover" /> : <View style={[styles.placeholder, { backgroundColor: colors.cardElevated }]}><View style={[styles.placeholderIcon, { backgroundColor: colors.primarySoft }]}><Icon name="play" size={22} color={colors.interactive} /></View></View>}
        <View pointerEvents="none" style={styles.reelLabel}><Icon name="flash" size={11} color="#FFFFFF" /><Text style={styles.reelLabelText}>REEL</Text></View>
        <View pointerEvents="none" style={styles.playChip}><Icon name="play" size={10} color="#FFFFFF" /><Text style={styles.viewsText}>{formatViews(reel.views_count)}</Text></View>
        {contentId ? <Pressable onPress={() => setCommentsOpen(true)} style={styles.commentChip} accessibilityRole="button" accessibilityLabel="Open Reel comments"><Icon name="chatbubble-ellipses-outline" size={14} color="#FFFFFF" /><Text style={styles.viewsText}>{reel.comments_count || 0}</Text></Pressable> : null}
        <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0.82)']} locations={[0, 0.52, 1]} style={styles.captionGradient} />
        <Pressable onPress={onPress} style={({ pressed }) => [styles.captionOverlay, resolvedVariant === 'feed' && styles.feedCaptionOverlay, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open reel: ${reel.caption || 'Reel'}`}>
          <Text style={[styles.captionText, resolvedVariant === 'feed' && styles.feedCaptionText]} numberOfLines={resolvedVariant === 'feed' ? 3 : 2}>{reel.caption || 'Reel'}</Text>
          {reel.audio_title ? <View style={styles.audioRow}><View style={styles.audioIcon}><Icon name="musical-notes" size={10} color="#FFFFFF" /></View><Text style={styles.audioText} numberOfLines={1}>{reel.audio_title}</Text></View> : null}
          {resolvedVariant === 'feed' ? <View style={styles.openRow}><Text style={styles.openText}>Open Reel</Text><Icon name="arrow-forward" size={14} color="#FFFFFF" /></View> : null}
        </Pressable>
      </View>
      <InlineCommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} contentId={contentId} context={resolvedCommentContext} title="Reel comments" subtitle="Keep this Reel in place while you join the conversation." onViewAll={onOpenComments} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1 },
  feedCard: { borderRadius: radius.xxl },
  frame: { width: '100%', aspectRatio: 9 / 16, position: 'relative', backgroundColor: '#050B14' },
  feedFrame: { aspectRatio: 4 / 5 },
  media: { width: '100%', height: '100%' }, placeholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }, placeholderIcon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  reelLabel: { position: 'absolute', top: spacing.sm, left: spacing.sm, minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 8, borderRadius: radius.pill }, reelLabelText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  playChip: { position: 'absolute', top: spacing.sm, left: 66, height: 27, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.56)', paddingHorizontal: 8, borderRadius: radius.pill }, viewsText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  commentChip: { position: 'absolute', top: 8, right: 8, minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.56)', paddingHorizontal: 8, borderRadius: radius.pill, zIndex: 4 },
  captionGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%' },
  captionOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, paddingTop: spacing.xl, gap: spacing.xs }, feedCaptionOverlay: { padding: spacing.lg, paddingTop: spacing.xxl },
  captionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 17, letterSpacing: -0.15 }, feedCaptionText: { fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, audioIcon: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }, audioText: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  openRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }, openText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.88 },
});

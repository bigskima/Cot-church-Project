import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { shareContent } from '@/services/share';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import { AudioPlayer } from '../media/AudioPlayer';
import { VideoPlayer } from '../media/VideoPlayer';
import { MediaPreviewModal, type PreviewableMedia } from '../media/MediaPreviewModal';
import { ContentReportSheet } from '../engagement/ContentReportSheet';
import { InlineCommentsSheet } from '../engagement/InlineCommentsSheet';
import type { MediaAsset, Post, SocialPost } from '@/types/content';

type PublicIdentityBadge = {
  id?: string;
  code?: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  priority?: number;
};

export interface PostCardProps {
  post: Post | SocialPost;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string | null;
  expressionName?: string;
  canEngage?: boolean;
  onPress?: () => void;
  onPressAuthor?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onReply?: () => void;
  onReact?: (reaction: string | null) => void | boolean | Promise<boolean>;
  onBookmark?: (currentlySaved: boolean) => void | boolean | Promise<boolean>;
  onShare?: () => void;
  allowExternalShare?: boolean;
  onMore?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  variant?: 'card' | 'feed';
  showContext?: boolean;
}

function mediaKind(media: MediaAsset): string | undefined {
  return media.type ?? media.media_type;
}

/** Upload filenames are storage metadata, never presentation copy. */
function mediaTitle(_media: MediaAsset, fallback: string) {
  return fallback;
}

function mediaMime(media: MediaAsset) {
  const item = media as MediaAsset & { mimeType?: string | null; mime_type?: string | null };
  return item.mimeType || item.mime_type || null;
}

export function PostCard({
  post,
  authorName,
  authorHandle,
  authorAvatar,
  expressionName,
  canEngage = true,
  onPress,
  onPressAuthor,
  onLike,
  onComment,
  onReply,
  onReact,
  onBookmark,
  onShare,
  allowExternalShare = true,
  onMore,
  style,
  variant,
  showContext,
}: PostCardProps) {
  const { colors } = useTheme();
  const postAsAny = post as any;
  const author = postAsAny.author ?? {};
  const expressionLabel = expressionName || postAsAny.expression?.name || undefined;
  const isExpressionPost = post.visibility === 'branch' || postAsAny.scope === 'expression';
  const resolvedVariant = variant ?? 'card';
  const showContextRow = showContext ?? isExpressionPost;
  const postExpressionId = postAsAny.expression_id || postAsAny.branch_id || postAsAny.content_items?.expression_id || postAsAny.expression?.id || undefined;

  const displayName = authorName || author.displayName || author.display_name || postAsAny.author_name || 'Church Member';
  const handle = authorHandle || author.username || author.handle || postAsAny.author_handle || undefined;
  const avatarUrl = authorAvatar || author.avatarUrl || author.avatar_url || postAsAny.author_avatar;
  const isVerified = author.isVerified || author.is_verified || postAsAny.is_verified || false;
  const badges: PublicIdentityBadge[] = Array.isArray(author.badges) ? author.badges : [];

  const media = Array.isArray(post.media)
    ? post.media.filter((item) => Boolean(item?.url) || mediaKind(item) === 'reel_reference')
    : [];

  const [hasLiked, setHasLiked] = useState(Boolean(postAsAny.viewer_reaction));
  const [likeCount, setLikeCount] = useState(postAsAny.likes_count ?? (post.social_reactions?.length || 0));
  const [hasSaved, setHasSaved] = useState(Boolean(postAsAny.viewer_bookmarked));
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<PreviewableMedia | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const likePending = useRef(false);
  const savePending = useRef(false);

  useEffect(() => {
    if (!likePending.current) {
      setHasLiked(Boolean(postAsAny.viewer_reaction));
      setLikeCount(postAsAny.likes_count ?? (post.social_reactions?.length || 0));
    }
    if (!savePending.current) setHasSaved(Boolean(postAsAny.viewer_bookmarked));
  }, [post.id, postAsAny.viewer_reaction, postAsAny.viewer_bookmarked, postAsAny.likes_count, post.social_reactions]);

  const handleLike = async () => {
    if (!canEngage || (!onReact && !onLike) || likePending.current) return;
    const previousLiked = hasLiked;
    const previousCount = likeCount;
    const nextLiked = !hasLiked;
    if (!onReact && !nextLiked) return;
    likePending.current = true;
    setHasLiked(nextLiked);
    setLikeCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));
    try {
      if (onReact) {
        if (await onReact(nextLiked ? 'like' : null) === false) throw new Error('Reaction was not saved');
      } else onLike?.();
    } catch {
      setHasLiked(previousLiked);
      setLikeCount(previousCount);
    } finally { likePending.current = false; }
  };

  const handleSave = async () => {
    if (!canEngage || !onBookmark || savePending.current) return;
    const previous = hasSaved;
    savePending.current = true;
    setHasSaved(!previous);
    try {
      if (await onBookmark(previous) === false) setHasSaved(previous);
    } catch { setHasSaved(previous); }
    finally { savePending.current = false; }
  };

  const handleCopy = async () => {
    const text = post.body?.trim();
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const handleNativeShare = async () => {
    const text = post.body?.trim();
    const mediaCount = media.filter((item) => mediaKind(item) !== 'reel_reference').length;
    const message = text
      ? `${displayName} on COT: “${text}”`
      : `${displayName} shared ${mediaCount > 1 ? `${mediaCount} media items` : 'media'} on COT.`;
    const firstMedia = media.find((item) => Boolean(item.url) && mediaKind(item) !== 'reel_reference');
    try {
      await shareContent({
        title: `COT post by ${displayName}`,
        message,
        attachment: firstMedia?.url ? { url: firstMedia.url, mimeType: mediaMime(firstMedia) } : null,
      });
      onShare?.();
    } catch {
      // Closing the operating-system share sheet leaves the post unchanged.
    }
  };

  const formatTime = () => {
    const date = new Date(post.published_at || postAsAny.created_at || Date.now());
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const identityHeader = (
    <View style={styles.headerRow}>
      <Pressable onPress={onPressAuthor || onPress} hitSlop={4}>
        <Avatar name={displayName} url={avatarUrl} size="md" />
      </Pressable>
      <View style={styles.identityColumn}>
        <View style={styles.authorLine}>
          <Pressable onPress={onPressAuthor || onPress} style={styles.nameGroup}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            {isVerified ? <Icon name="checkmark-circle" size={15} color={colors.interactive} /> : null}
          </Pressable>
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>{formatTime()}</Text>
        </View>
        {handle ? <Text style={[styles.handleText, { color: colors.textMuted }]} numberOfLines={1}>@{handle}</Text> : null}
      </View>
      {onMore || canEngage ? (
        <Pressable
          onPress={onMore ?? (() => setReportOpen(true))}
          hitSlop={8}
          style={({ pressed }) => [styles.moreButton, pressed ? { backgroundColor: colors.bgSecondary } : null]}
          accessibilityRole="button"
          accessibilityLabel={onMore ? 'More post actions' : 'Report post'}
        >
          <Icon name="ellipsis-horizontal" size={19} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  const contextRow = showContextRow ? (
    <View style={styles.contextRow}>
      <View style={[styles.contextPill, { backgroundColor: isExpressionPost ? colors.primarySoft : colors.bgSecondary }]}>
        <Icon name={isExpressionPost ? 'people-outline' : 'globe-outline'} size={12} color={isExpressionPost ? colors.interactive : colors.textSecondary} />
        <Text style={[styles.contextText, { color: isExpressionPost ? colors.interactive : colors.textSecondary }]} numberOfLines={1}>
          {isExpressionPost ? expressionLabel || 'Expression' : 'General COT'}
        </Text>
      </View>
      {isExpressionPost ? (
        <View style={[styles.privatePill, { backgroundColor: colors.bgSecondary }]}>
          <Icon name="lock-closed-outline" size={11} color={colors.textMuted} />
          <Text style={[styles.privateText, { color: colors.textMuted }]}>Members</Text>
        </View>
      ) : null}
    </View>
  ) : null;

  const identityBadges = badges.length ? (
    <View style={styles.identityMetaRow}>
      {badges.map((badge, index) => (
        <View key={badge.id || badge.code || `${badge.label}-${index}`} style={[styles.identityBadge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.identityBadgeText, { color: badge.textColor }]}>{badge.label}</Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <>
      {resolvedVariant === 'feed' ? (
        <View style={styles.detachedIdentity}>
          {identityHeader}
          {contextRow}
          {identityBadges}
        </View>
      ) : null}

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          resolvedVariant === 'feed' ? styles.feedContainer : null,
          { backgroundColor: colors.card, borderColor: isExpressionPost ? colors.primarySoftStrong : colors.borderSubtle },
          isExpressionPost ? styles.expressionCard : resolvedVariant === 'card' ? styles.publicCard : null,
          pressed && onPress ? { backgroundColor: colors.pressed } : null,
          style,
        ]}
      >
        {resolvedVariant !== 'feed' ? (
          <>
            {contextRow}
            {identityHeader}
            {identityBadges}
          </>
        ) : null}

        {post.body?.trim() ? <Text style={[styles.bodyText, resolvedVariant === 'feed' && styles.feedBodyText, { color: colors.text }]}>{post.body}</Text> : null}

        {media.length ? (
          <View style={styles.mediaList}>
            {media.map((item, index) => {
              const kind = mediaKind(item);
              const key = item.id || (item as any).uploadId || `${kind || 'media'}-${index}-${item.url}`;
              if (kind === 'reel_reference') {
                const reference = item as MediaAsset & { reelId?: string; caption?: string | null };
                return <Pressable key={key} onPress={() => { if (!reference.reelId) return; router.push((isExpressionPost && postExpressionId ? { pathname: `/expressions/${postExpressionId}/reels`, params: { reelId: reference.reelId } } : { pathname: '/general/reels', params: { reelId: reference.reelId } }) as any); }} style={({ pressed }) => [styles.reelReference, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed ? { opacity: 0.88 } : null]} accessibilityRole="button" accessibilityLabel="Open shared Reel"><View style={[styles.reelReferenceIcon, { backgroundColor: colors.primarySoft }]}><Icon name="flash-outline" size={22} color={colors.interactive} /></View><View style={styles.reelReferenceCopy}><Text style={[styles.reelReferenceKicker, { color: colors.interactive }]}>SHARED REEL</Text><Text style={[styles.reelReferenceTitle, { color: colors.text }]} numberOfLines={2}>{reference.caption?.trim() || 'Open this Reel'}</Text><Text style={[styles.reelReferenceMeta, { color: colors.textMuted }]}>Tap to watch the original Reel</Text></View><Icon name="chevron-forward" size={18} color={colors.textMuted} /></Pressable>;
              }
              if (kind === 'video') {
                return <View key={key} style={[styles.richMediaFrame, { borderColor: colors.borderSubtle }]}><VideoPlayer title={mediaTitle(item, 'Video')} sourceUrl={item.url} posterUrl={item.thumbnailUrl} durationSeconds={item.duration_seconds} /><Pressable onPress={(event) => { event.stopPropagation(); setPreview({ url: item.url!, type: 'video', title: mediaTitle(item, 'Video'), posterUrl: item.thumbnailUrl, durationSeconds: item.duration_seconds }); }} style={styles.expandButton} accessibilityLabel="Open video full screen"><Icon name="expand-outline" size={19} color="#FFFFFF" /></Pressable></View>;
              }
              if (kind === 'audio') {
                return <View key={key} style={styles.audioWrap}><AudioPlayer title={mediaTitle(item, 'Audio')} speaker={displayName} sourceUrl={item.url} durationSeconds={item.duration_seconds} style={styles.audioPlayer} /><Pressable onPress={(event) => { event.stopPropagation(); setPreview({ url: item.url!, type: 'audio', title: mediaTitle(item, 'Audio'), durationSeconds: item.duration_seconds }); }} style={[styles.audioExpand, { backgroundColor: colors.primarySoft }]} accessibilityLabel="Open audio preview"><Icon name="expand-outline" size={17} color={colors.interactive} /></Pressable></View>;
              }
              if (kind === 'document' || kind === 'file') {
                return <Pressable key={key} onPress={(event) => { event.stopPropagation(); setPreview({ url: item.url!, type: 'document', title: mediaTitle(item, 'Attachment'), mimeType: mediaMime(item) || undefined }); }} style={[styles.fileCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]} accessibilityRole="button" accessibilityLabel="Open attached file"><View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}><Icon name="document-text-outline" size={22} color={colors.interactive} /></View><View style={styles.fileCopy}><Text numberOfLines={1} style={[styles.fileTitle, { color: colors.text }]}>Attachment</Text><Text style={[styles.fileHint, { color: colors.textMuted }]}>Preview or download attachment</Text></View><Icon name="expand-outline" size={18} color={colors.interactive} /></Pressable>;
              }
              return <Pressable key={key} onPress={(event) => { event.stopPropagation(); setPreview({ url: item.url!, type: 'image', title: mediaTitle(item, 'Photo') }); }} style={[styles.mediaFrame, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="View full image"><Image source={{ uri: item.url! }} style={styles.mediaImage} resizeMode="cover" accessibilityLabel={item.alt || 'Community post image'} /><View style={styles.expandButton}><Icon name="expand-outline" size={19} color="#FFFFFF" /></View></Pressable>;
            })}
          </View>
        ) : null}

        <View style={[styles.actionRail, { borderTopColor: colors.borderSubtle }]}>
          {canEngage ? (
            <View style={styles.actionGroup}>
              <Pressable onPress={(event) => { event.stopPropagation?.(); setCommentsOpen(true); }} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed ? { backgroundColor: colors.bgSecondary } : null]} accessibilityRole="button" accessibilityLabel="Reply to post"><Icon name="chatbubble-outline" size={18} color={colors.textSecondary} /><Text style={[styles.actionCount, { color: colors.textSecondary }]}>{postAsAny.comments_count || ''}</Text></Pressable>
              <Pressable onPress={() => void handleLike()} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed ? { backgroundColor: colors.liveSoft } : null]} accessibilityRole="button" accessibilityLabel="Like post"><Icon name={hasLiked ? 'heart' : 'heart-outline'} size={18} color={hasLiked ? colors.live : colors.textSecondary} /><Text style={[styles.actionCount, { color: hasLiked ? colors.live : colors.textSecondary }]}>{likeCount > 0 ? likeCount : ''}</Text></Pressable>
              {onBookmark ? <Pressable onPress={() => void handleSave()} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed ? { backgroundColor: colors.primarySoft } : null]} accessibilityRole="button" accessibilityLabel="Bookmark post"><Icon name={hasSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={hasSaved ? colors.interactive : colors.textSecondary} /></Pressable> : null}
              {post.body?.trim() ? <Pressable onPress={(event) => { event.stopPropagation?.(); void handleCopy(); }} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed ? { backgroundColor: colors.primarySoft } : null]} accessibilityRole="button" accessibilityLabel="Copy post text"><Icon name={copied ? 'checkmark-outline' : 'copy-outline'} size={18} color={copied ? colors.interactive : colors.textSecondary} /></Pressable> : null}
            </View>
          ) : <View style={styles.guestGroup}><Text style={[styles.guestMeta, { color: colors.textMuted }]}>Sign in to join the conversation</Text>{post.body?.trim() ? <Pressable onPress={(event) => { event.stopPropagation?.(); void handleCopy(); }} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Copy post text"><Icon name={copied ? 'checkmark-outline' : 'copy-outline'} size={18} color={copied ? colors.interactive : colors.textSecondary} /></Pressable> : null}</View>}
          {allowExternalShare ? <Pressable onPress={handleNativeShare} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed ? { backgroundColor: colors.bgSecondary } : null]} accessibilityRole="button" accessibilityLabel="Share post"><Icon name="share-social-outline" size={18} color={colors.textSecondary} /></Pressable> : <View style={styles.noShareMeta}><Icon name="lock-closed-outline" size={12} color={colors.textMuted} /><Text style={[styles.noShareText, { color: colors.textMuted }]}>Stays here</Text></View>}
        </View>
      </Pressable>
      <MediaPreviewModal media={preview} visible={Boolean(preview)} onClose={() => setPreview(null)} />
      <InlineCommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} contentId={post.id} context={isExpressionPost ? 'current' : 'public'} title="Comments" subtitle="Keep this post and its media in view while you read and reply." returnTo={isExpressionPost && postExpressionId ? `/expressions/${postExpressionId}/feed` : '/general'} onViewAll={onComment || onReply} />
      <ContentReportSheet target={reportOpen ? { contentId: post.id, context: isExpressionPost ? 'current' : 'public', label: isExpressionPost ? `Report post in ${expressionLabel || 'this Expression'}` : 'Report this General COT post' } : null} onClose={() => setReportOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: spacing.md, marginVertical: spacing.sm, padding: spacing.lg, borderWidth: 1, borderRadius: radius.card },
  feedContainer: { marginHorizontal: 0, marginTop: 7, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderRadius: radius.xxl },
  detachedIdentity: { paddingHorizontal: 2, gap: 6 },
  publicCard: { ...shadows.sm },
  expressionCard: { ...shadows.md },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2, marginBottom: 2 },
  contextPill: { minHeight: 26, maxWidth: '72%', borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  contextText: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.15, flexShrink: 1 },
  privatePill: { minHeight: 26, borderRadius: radius.pill, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  privateText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.15 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identityColumn: { flex: 1, minWidth: 0 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 4 },
  displayName: { fontSize: 15, fontWeight: '800', flexShrink: 1, letterSpacing: -0.2 },
  timestamp: { fontSize: 10.5, fontWeight: '600' },
  handleText: { fontSize: 10.5, marginTop: 2 },
  moreButton: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  identityMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  identityBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  identityBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  bodyText: { fontSize: 15, lineHeight: 23, marginTop: spacing.md, letterSpacing: -0.08 },
  feedBodyText: { fontSize: 16, lineHeight: 25, marginTop: 0, letterSpacing: -0.12 },
  mediaList: { gap: spacing.sm, marginTop: spacing.md, marginHorizontal: -4 },
  mediaFrame: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.xl, overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%' },
  richMediaFrame: { width: '100%', overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, position: 'relative' },
  expandButton: { position: 'absolute', right: 8, top: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)' },
  audioWrap: { position: 'relative' },
  audioExpand: { position: 'absolute', right: 8, top: 8, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  audioPlayer: { width: '100%' },
  fileCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  fileIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  fileCopy: { flex: 1, minWidth: 0 },
  fileTitle: { fontSize: 13, fontWeight: '800' },
  fileHint: { fontSize: 10, marginTop: 3 },
  reelReference: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  reelReferenceIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  reelReferenceCopy: { flex: 1, minWidth: 0 },
  reelReferenceKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  reelReferenceTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 2 },
  reelReferenceMeta: { fontSize: 10, marginTop: 3 },
  actionRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 46 },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  guestGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButton: { minWidth: 42, height: 36, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8 },
  actionCount: { fontSize: 12, fontWeight: '700' },
  guestMeta: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  noShareMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  noShareText: { fontSize: 9, fontWeight: '700' },
});
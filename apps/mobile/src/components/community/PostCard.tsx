import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, useWindowDimensions, View, ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { shareContent } from '@/services/share';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import { AudioPlayer } from '../media/AudioPlayer';
import { VideoPlayer } from '../media/VideoPlayer';
import { AdaptiveMediaImage } from '../media/AdaptiveMediaImage';
import { MediaPreviewModal, type PreviewableMedia } from '../media/MediaPreviewModal';
import { ContentReportSheet } from '../engagement/ContentReportSheet';
import { InlineCommentsSheet } from '../engagement/InlineCommentsSheet';
import { BottomSheet } from '../BottomSheet';
import { QuotedContentCard } from './QuotedContentCard';
import { ScripturePreviewCard } from '@/components/bible/ScriptureReferenceText';
import type { MediaAsset, Post, SocialPost } from '@/types/content';
import { CompactIdentityBadge, type PublicIdentityBadge } from '@/components/identity/PublicIdentityBadge';

const postRevealSteps = new Map<string, number>();
const POST_REVEAL_CHARS = 620;
const POST_REVEAL_LINES = 8;

function revealPostBody(body: string, step: number) {
  const maxChars = Math.max(POST_REVEAL_CHARS, POST_REVEAL_CHARS * step);
  const maxLines = Math.max(POST_REVEAL_LINES, POST_REVEAL_LINES * step);
  const lines = body.split(/\r?\n/);
  const selected: string[] = [];
  let usedChars = 0;

  for (const line of lines) {
    if (selected.length >= maxLines) break;
    const separatorCost = selected.length ? 1 : 0;
    const nextCost = line.length + separatorCost;
    if (usedChars + nextCost <= maxChars) {
      selected.push(line);
      usedChars += nextCost;
      continue;
    }

    if (!selected.length) {
      const raw = line.slice(0, maxChars);
      const wordBreak = raw.lastIndexOf(' ');
      selected.push(wordBreak > maxChars * 0.72 ? raw.slice(0, wordBreak) : raw);
    }
    break;
  }

  const text = selected.join('\n').trimEnd();
  const hasMore = text.length < body.length || selected.length < lines.length;
  return { text: hasMore ? text : body, hasMore };
}

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
  allowInternalShare?: boolean;
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

function mediaAspectRatio(media: MediaAsset) {
  if (typeof media.width === 'number' && typeof media.height === 'number' && media.width > 0 && media.height > 0) {
    return media.width / media.height;
  }
  if (typeof media.aspect_ratio === 'string') {
    const match = media.aspect_ratio.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
    if (match) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > 0 && height > 0) return width / height;
    }
    const numeric = Number(media.aspect_ratio);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return undefined;
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
  allowInternalShare = true,
  onMore,
  style,
  variant,
  showContext,
}: PostCardProps) {
  const { colors } = useTheme();
  const { api, mode, context } = useSession();
  const { width: windowWidth } = useWindowDimensions();
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
  const openAuthor = onPressAuthor ?? (handle
    ? () => router.push({ pathname: '/general/member/[username]', params: { username: handle } } as any)
    : undefined);

  const rawMedia = Array.isArray(post.media)
    ? post.media.filter((item) => Boolean(item?.url) || mediaKind(item) === 'reel_reference' || mediaKind(item) === 'post_reference')
    : [];
  const quoteReferences = rawMedia.filter((item) => mediaKind(item) === 'reel_reference' || mediaKind(item) === 'post_reference');
  const legacyQuotePreviewIds = new Set(
    quoteReferences.flatMap((item: any) => [item.reelId, item.postId].filter(Boolean)),
  );
  // Keep the existing horizontal media rail exactly for ordinary images/video/audio.
  // Quote previews are nested inside their reference card instead of becoming a
  // second carousel item (the bug that produced the giant blank/sideways Reel).
  const media = rawMedia.filter((item: any) => (
    mediaKind(item) !== 'reel_reference'
    && mediaKind(item) !== 'post_reference'
    && !(item.quotedReelId && legacyQuotePreviewIds.has(item.quotedReelId))
    && !(item.quotedPostId && legacyQuotePreviewIds.has(item.quotedPostId))
  ));
  const mediaCardWidth = Math.min(Math.max(windowWidth - 44, 280), 760);
  const internalShareAvailable = Boolean(
    allowInternalShare
    && canEngage
    && mode === 'authenticated'
    && !postAsAny.group_id
    && (
      post.visibility === 'public'
      || (post.visibility === 'branch' && postExpressionId)
    )
  );

  const [hasLiked, setHasLiked] = useState(Boolean(postAsAny.viewer_reaction));
  const [likeCount, setLikeCount] = useState(postAsAny.likes_count ?? (post.social_reactions?.length || 0));
  const [hasSaved, setHasSaved] = useState(Boolean(postAsAny.viewer_bookmarked));
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<PreviewableMedia | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [quoteBody, setQuoteBody] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [bodyRevealStep, setBodyRevealStep] = useState(() => postRevealSteps.get(post.id) ?? 1);

  const likePending = useRef(false);
  const savePending = useRef(false);

  useEffect(() => {
    setBodyRevealStep(postRevealSteps.get(post.id) ?? 1);
  }, [post.id]);

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

  const handleInternalShare = async () => {
    if (!internalShareAvailable || shareBusy) return;
    const organizationId = post.organization_id || context?.organization?.id || context?.organizations?.[0]?.id;
    if (!organizationId) {
      setShareError('Choose a church community before sharing this post.');
      return;
    }
    setShareBusy(true);
    setShareError('');
    try {
      await api.request('social-feed', {
        method: 'POST',
        context: isExpressionPost ? 'current' : 'public',
        body: JSON.stringify({
          action: 'share_post',
          organizationId,
          postId: post.id,
          body: quoteBody.trim(),
          ...(isExpressionPost && postExpressionId ? { branchId: postExpressionId } : {}),
        }),
      });
      invalidate('mobile:home-feed:');
      invalidate('mobile:community:');
      invalidate('expression:');
      setQuoteBody('');
      setShareOpen(false);
      onShare?.();
    } catch (value) {
      setShareError(value instanceof Error ? value.message : 'Unable to share this post inside COT.');
    } finally {
      setShareBusy(false);
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

  const body = post.body?.trim() ?? '';
  const bodyLineCount = body ? body.split(/\r?\n/).length : 0;
  const progressiveBody = body.length > 700 || bodyLineCount > POST_REVEAL_LINES;
  const revealedBody = progressiveBody ? revealPostBody(body, bodyRevealStep) : { text: body, hasMore: false };

  const identityHeader = (
    <View style={styles.headerRow}>
      <Pressable onPress={openAuthor || onPress} hitSlop={4}>
        <Avatar name={displayName} url={avatarUrl} size="md" />
      </Pressable>
      <View style={styles.identityColumn}>
        <View style={styles.authorLine}>
          <Pressable onPress={openAuthor || onPress} style={styles.nameGroup}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            {badges[0] ? <CompactIdentityBadge badge={badges[0]} size={17} /> : null}
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


  return (
    <>
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
        {resolvedVariant === 'feed' ? (
          <View style={[styles.feedIdentityBlock, { borderBottomColor: colors.borderSubtle }]}>
            {identityHeader}
            {contextRow}
          </View>
        ) : (
          <>
            {contextRow}
            {identityHeader}
          </>
        )}

        {body ? (
          <View style={[styles.bodyBlock, resolvedVariant === 'feed' && styles.feedBodyBlock]}>
            <Text style={[styles.bodyText, resolvedVariant === 'feed' && styles.feedBodyText, { color: colors.text }]}>
              {revealedBody.text}
              {revealedBody.hasMore ? '…' : ''}
            </Text>

            {progressiveBody ? (
              <Pressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  if (revealedBody.hasMore) {
                    const nextStep = bodyRevealStep + 1;
                    postRevealSteps.set(post.id, nextStep);
                    setBodyRevealStep(nextStep);
                  } else {
                    postRevealSteps.set(post.id, 1);
                    setBodyRevealStep(1);
                  }
                }}
                hitSlop={6}
                style={({ pressed }) => [styles.showMoreButton, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={revealedBody.hasMore ? 'Show more of this post' : 'Collapse this post'}
              >
                <Text style={[styles.showMoreText, { color: colors.interactive }]}>
                  {revealedBody.hasMore ? 'Show more' : 'Show less'}
                </Text>
                <Icon name={revealedBody.hasMore ? 'chevron-down' : 'chevron-up'} size={14} color={colors.interactive} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {body ? <ScripturePreviewCard text={body} compact /> : null}

        {quoteReferences.length ? (
          <View style={styles.quotedList}>
            {quoteReferences.map((reference: any, index) => {
              const fallbackPreview = rawMedia.find((candidate: any) => (
                reference.reelId && candidate.quotedReelId === reference.reelId
              ) || (
                reference.postId && candidate.quotedPostId === reference.postId
              )) ?? null;
              return (
                <QuotedContentCard
                  key={reference.reelId || reference.postId || `quote-${index}`}
                  reference={reference}
                  fallbackPreview={fallbackPreview}
                  currentExpressionId={postExpressionId}
                />
              );
            })}
          </View>
        ) : null}

        {media.length ? (
          <View style={styles.mediaList}>
            <ScrollView
              horizontal
              scrollEnabled={media.length > 1}
              style={styles.mediaScroller}
              showsHorizontalScrollIndicator={false}
              snapToInterval={media.length > 1 ? mediaCardWidth + 8 : undefined}
              decelerationRate={media.length > 1 ? 'fast' : 'normal'}
              contentContainerStyle={media.length > 1 ? styles.mediaRail : styles.singleMediaRail}
            >
              {media.map((item, index) => {
                const kind = mediaKind(item);
                const key = item.id || (item as any).uploadId || `${kind || 'media'}-${index}-${item.url}`;
                const itemStyle = media.length > 1 ? { width: mediaCardWidth } : styles.singleMediaItem;
                const ratio = mediaAspectRatio(item);

                if (kind === 'reel_reference') {
                  const reference = item as MediaAsset & { reelId?: string; caption?: string | null };
                  return (
                    <View key={key} style={itemStyle}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          if (!reference.reelId) return;
                          router.push((isExpressionPost && postExpressionId
                            ? { pathname: `/expressions/${postExpressionId}/reels`, params: { reelId: reference.reelId } }
                            : { pathname: '/general/reels', params: { reelId: reference.reelId } }) as any);
                        }}
                        style={({ pressed }) => [styles.reelReference, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed ? { opacity: 0.88 } : null]}
                        accessibilityRole="button"
                        accessibilityLabel="Open shared Reel"
                      >
                        <View style={[styles.reelReferenceIcon, { backgroundColor: colors.primarySoft }]}><Icon name="flash-outline" size={22} color={colors.interactive} /></View>
                        <View style={styles.reelReferenceCopy}>
                          <Text style={[styles.reelReferenceKicker, { color: colors.interactive }]}>REEL</Text>
                          <Text style={[styles.reelReferenceTitle, { color: colors.text }]} numberOfLines={2}>{reference.caption?.trim() || 'Open Reel'}</Text>
                        </View>
                        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  );
                }

                if (kind === 'video') {
                  return (
                    <View key={key} style={[itemStyle, styles.richMediaFrame, { borderColor: colors.borderSubtle }]}>
                      <VideoPlayer
                        title={mediaTitle(item, 'Video')}
                        sourceUrl={item.url}
                        posterUrl={item.thumbnailUrl}
                        durationSeconds={item.duration_seconds}
                        aspectRatio={ratio}
                      />
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setPreview({
                            url: item.url!,
                            type: 'video',
                            title: mediaTitle(item, 'Video'),
                            posterUrl: item.thumbnailUrl,
                            durationSeconds: item.duration_seconds,
                            width: item.width,
                            height: item.height,
                            aspectRatio: ratio,
                          });
                        }}
                        style={styles.expandButton}
                        accessibilityLabel="Open video full screen"
                      >
                        <Icon name="expand-outline" size={19} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  );
                }

                if (kind === 'audio') {
                  return (
                    <View key={key} style={[itemStyle, styles.audioWrap]}>
                      <AudioPlayer title={mediaTitle(item, 'Audio')} speaker={displayName} sourceUrl={item.url} durationSeconds={item.duration_seconds} style={styles.audioPlayer} />
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setPreview({ url: item.url!, type: 'audio', title: mediaTitle(item, 'Audio'), durationSeconds: item.duration_seconds });
                        }}
                        style={[styles.audioExpand, { backgroundColor: colors.primarySoft }]}
                        accessibilityLabel="Open audio preview"
                      >
                        <Icon name="expand-outline" size={17} color={colors.interactive} />
                      </Pressable>
                    </View>
                  );
                }

                if (kind === 'document' || kind === 'file') {
                  return (
                    <View key={key} style={itemStyle}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setPreview({ url: item.url!, type: 'document', title: mediaTitle(item, 'Attachment'), mimeType: mediaMime(item) || undefined });
                        }}
                        style={[styles.fileCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Open attached file"
                      >
                        <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}><Icon name="document-text-outline" size={22} color={colors.interactive} /></View>
                        <View style={styles.fileCopy}>
                          <Text numberOfLines={1} style={[styles.fileTitle, { color: colors.text }]}>{(item as any).fileName?.trim() || 'Attachment'}</Text>
                          <Text numberOfLines={1} style={[styles.fileMeta, { color: colors.textMuted }]}>{mediaMime(item) || 'File'}</Text>
                        </View>
                        <Icon name="expand-outline" size={18} color={colors.interactive} />
                      </Pressable>
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={key}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      setPreview({
                        url: item.url!,
                        type: 'image',
                        title: mediaTitle(item, 'Photo'),
                        width: item.width,
                        height: item.height,
                        aspectRatio: ratio,
                      });
                    }}
                    style={[itemStyle, styles.mediaFrame, { backgroundColor: colors.bgSecondary }]}
                    accessibilityRole="button"
                    accessibilityLabel="View full image"
                  >
                    <AdaptiveMediaImage
                      url={item.url!}
                      alt={item.alt || 'Community post image'}
                      widthHint={item.width}
                      heightHint={item.height}
                      aspectRatioHint={ratio}
                      resizeMode="contain"
                      style={styles.mediaImage}
                      backgroundColor={colors.bgSecondary}
                    />
                    <View style={styles.expandButton}><Icon name="expand-outline" size={19} color="#FFFFFF" /></View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {media.length > 1 ? <Text style={[styles.mediaCount, { color: colors.textMuted }]}>{media.length} media</Text> : null}
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
          {internalShareAvailable || allowExternalShare ? <Pressable onPress={(event) => { event.stopPropagation?.(); setShareError(''); setShareOpen(true); }} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed ? { backgroundColor: colors.bgSecondary } : null]} accessibilityRole="button" accessibilityLabel="Share post"><Icon name="share-social-outline" size={18} color={colors.textSecondary} /></Pressable> : <View style={styles.noShareMeta}><Icon name="lock-closed-outline" size={12} color={colors.textMuted} /><Text style={[styles.noShareText, { color: colors.textMuted }]}>Stays here</Text></View>}
        </View>
      </Pressable>
      <BottomSheet
        visible={shareOpen}
        onClose={() => { if (!shareBusy) { setShareOpen(false); setShareError(''); } }}
        title="Share"
        subtitle="Keep the original connected when you share inside COT."
        maxHeightPercent={82}
        compact
      >
        <View style={styles.shareSheet}>
          {internalShareAvailable ? (
            <View style={[styles.internalShareCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <View style={styles.shareSheetHead}>
                <View style={[styles.shareSheetIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="repeat-outline" size={18} color={colors.interactive} />
                </View>
                <View style={styles.shareSheetCopy}>
                  <Text style={[styles.shareSheetTitle, { color: colors.text }]}>
                    {isExpressionPost ? `Share in ${expressionLabel || 'this Expression'}` : 'Quote in General COT'}
                  </Text>
                  <Text style={[styles.shareSheetMeta, { color: colors.textMuted }]}>
                    The original post stays linked. Media is not duplicated.
                  </Text>
                </View>
              </View>
              <TextInput
                value={quoteBody}
                onChangeText={setQuoteBody}
                multiline
                maxLength={2200}
                placeholder="Add a thought (optional)"
                placeholderTextColor={colors.textMuted}
                style={[styles.quoteInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderSubtle }]}
              />
              {shareError ? <Text style={[styles.shareError, { color: colors.live }]}>{shareError}</Text> : null}
              <Pressable
                disabled={shareBusy}
                onPress={() => void handleInternalShare()}
                style={({ pressed }) => [
                  styles.internalShareButton,
                  { backgroundColor: colors.interactive },
                  (pressed || shareBusy) && { opacity: 0.78 },
                ]}
              >
                <Icon name={shareBusy ? 'hourglass-outline' : 'repeat-outline'} size={17} color="#FFFFFF" />
                <Text style={styles.internalShareButtonText}>{shareBusy ? 'Sharing…' : 'Share inside COT'}</Text>
              </Pressable>
            </View>
          ) : null}

          {allowExternalShare ? (
            <Pressable
              onPress={() => { setShareOpen(false); void handleNativeShare(); }}
              style={({ pressed }) => [styles.externalShareButton, { borderColor: colors.borderSubtle }, pressed && { backgroundColor: colors.bgSecondary }]}
            >
              <View style={[styles.shareSheetIcon, { backgroundColor: colors.bgSecondary }]}>
                <Icon name="share-social-outline" size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.shareSheetCopy}>
                <Text style={[styles.shareSheetTitle, { color: colors.text }]}>Share outside COT</Text>
                <Text style={[styles.shareSheetMeta, { color: colors.textMuted }]}>Use your device share menu.</Text>
              </View>
              <Icon name="chevron-forward" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>
      <MediaPreviewModal media={preview} visible={Boolean(preview)} onClose={() => setPreview(null)} />
      <InlineCommentsSheet visible={commentsOpen} onClose={() => setCommentsOpen(false)} contentId={post.id} context={isExpressionPost ? 'current' : 'public'} title="Comments" subtitle="Keep this post and its media in view while you read and reply." returnTo={isExpressionPost && postExpressionId ? `/expressions/${postExpressionId}/feed` : '/general'} onViewAll={onComment || onReply} />
      <ContentReportSheet target={reportOpen ? { contentId: post.id, context: isExpressionPost ? 'current' : 'public', label: isExpressionPost ? `Report post in ${expressionLabel || 'this Expression'}` : 'Report this General COT post' } : null} onClose={() => setReportOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: spacing.sm, marginVertical: spacing.xs, padding: spacing.md, borderWidth: 1, borderRadius: radius.card },
  feedContainer: { marginHorizontal: 0, marginTop: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0 },
  feedIdentityBlock: { paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: 5 },
  feedBodyBlock: { marginTop: spacing.sm },
  publicCard: { ...shadows.sm },
  expressionCard: { ...shadows.md },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2, marginBottom: 2 },
  contextPill: { minHeight: 26, maxWidth: '72%', borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  contextText: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.15, flexShrink: 1 },
  privatePill: { minHeight: 26, borderRadius: radius.pill, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  privateText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.15 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  identityColumn: { flex: 1, minWidth: 0, paddingTop: 1 },
  authorLine: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 6 },
  nameGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, gap: 4 },
  displayName: { fontSize: 15, fontWeight: '800', flexShrink: 1, letterSpacing: -0.2 },
  timestamp: { fontSize: 10.5, fontWeight: '600' },
  handleText: { fontSize: 10.5, marginTop: 2 },
  moreButton: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  identityMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  identityBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  identityBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  bodyBlock: { gap: 5 },
  bodyText: { fontSize: 15, lineHeight: 23, marginTop: spacing.md, letterSpacing: -0.08 },
  feedBodyText: { fontSize: 16, lineHeight: 25, marginTop: 0, letterSpacing: -0.12 },
  showMoreButton: { alignSelf: 'flex-start', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6 },
  showMoreText: { fontSize: 11.5, lineHeight: 16, fontWeight: '900' },
  quotedList: { marginTop: spacing.md, gap: spacing.sm },
  mediaList: { marginTop: spacing.md, marginHorizontal: -4, gap: 5 },
  mediaScroller: { flexGrow: 0, flexShrink: 0 },
  mediaRail: { gap: 8, paddingRight: spacing.md },
  singleMediaRail: { width: '100%' },
  singleMediaItem: { width: '100%' },
  mediaFrame: { borderRadius: radius.xl, overflow: 'hidden' },
  mediaImage: { width: '100%', borderRadius: radius.xl },
  mediaCount: { alignSelf: 'flex-end', fontSize: 9.5, fontWeight: '700', paddingRight: 2 },
  richMediaFrame: { width: '100%', overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, position: 'relative' },
  expandButton: { position: 'absolute', right: 8, top: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)' },
  audioWrap: { position: 'relative' },
  audioExpand: { position: 'absolute', right: 8, top: 8, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  audioPlayer: { width: '100%' },
  fileCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  fileIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  fileCopy: { flex: 1, minWidth: 0 },
  fileTitle: { fontSize: 13, fontWeight: '800' },
  fileMeta: { fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  reelReference: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  reelReferenceIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  reelReferenceCopy: { flex: 1, minWidth: 0 },
  reelReferenceKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  reelReferenceTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 2 },
  actionRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 46 },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  guestGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButton: { minWidth: 42, height: 36, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8 },
  actionCount: { fontSize: 12, fontWeight: '700' },
  guestMeta: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  noShareMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  noShareText: { fontSize: 9, fontWeight: '700' },
  shareSheet: { gap: spacing.md },
  internalShareCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  shareSheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shareSheetIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  shareSheetCopy: { flex: 1, minWidth: 0 },
  shareSheetTitle: { fontSize: 13, fontWeight: '900' },
  shareSheetMeta: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  quoteInput: { minHeight: 92, maxHeight: 180, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlignVertical: 'top', fontSize: 13, lineHeight: 19 },
  shareError: { fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  internalShareButton: { minHeight: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.md },
  internalShareButtonText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  externalShareButton: { minHeight: 62, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
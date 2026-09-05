import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, Share } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import { AudioPlayer } from '../media/AudioPlayer';
import { VideoPlayer } from '../media/VideoPlayer';
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
  onReact?: (reaction: string) => void;
  onBookmark?: () => void;
  onShare?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

function mediaKind(media: MediaAsset) {
  return media.type ?? media.media_type;
}

function mediaTitle(media: MediaAsset, fallback: string) {
  const item = media as MediaAsset & { fileName?: string | null; filename?: string | null };
  return item.fileName || item.filename || fallback;
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
  style,
}: PostCardProps) {
  const { colors } = useTheme();
  const postAsAny = post as any;
  const author = postAsAny.author ?? {};
  const expressionLabel = expressionName || postAsAny.expression?.name || undefined;

  const displayName = authorName || author.displayName || author.display_name || postAsAny.author_name || 'Church Member';
  const handle = authorHandle || author.username || author.handle || postAsAny.author_handle || undefined;
  const avatarUrl = authorAvatar || author.avatarUrl || author.avatar_url || postAsAny.author_avatar;
  const isVerified = author.isVerified || author.is_verified || postAsAny.is_verified || false;
  const badges: PublicIdentityBadge[] = Array.isArray(author.badges) ? author.badges : [];

  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(postAsAny.likes_count ?? (post.social_reactions?.length || 0));
  const [hasSaved, setHasSaved] = useState(false);

  const handleLike = () => {
    if (!canEngage || hasLiked) return;
    setHasLiked(true);
    setLikeCount((count: number) => count + 1);
    onReact?.('like');
    onLike?.();
  };

  const handleSave = () => {
    if (!canEngage) return;
    setHasSaved(!hasSaved);
    onBookmark?.();
  };

  const handleNativeShare = async () => {
    const text = post.body?.trim();
    const mediaCount = post.media?.length ?? 0;
    const message = text
      ? `${displayName} on Church: “${text}”`
      : `${displayName} shared ${mediaCount > 1 ? `${mediaCount} media items` : 'media'} on Church.`;
    try {
      await Share.share({ message });
      onShare?.();
    } catch {
      // Dismissing the native share sheet does not alter post state.
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

  const media = Array.isArray(post.media) ? post.media.filter((item) => Boolean(item?.url)) : [];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        pressed && onPress ? { backgroundColor: colors.pressed } : null,
        style,
      ]}
    >
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
          <View style={styles.metaLine}>
            {handle ? <Text style={[styles.handleText, { color: colors.textMuted }]} numberOfLines={1}>@{handle}</Text> : null}
            {expressionLabel ? (
              <>
                {handle ? <Text style={[styles.metaDot, { color: colors.textMuted }]}>•</Text> : null}
                <Text style={[styles.expressionText, { color: colors.textSecondary }]} numberOfLines={1}>{expressionLabel}</Text>
              </>
            ) : null}
          </View>
        </View>

        <Pressable hitSlop={8} style={styles.moreButton} accessibilityRole="button" accessibilityLabel="More post actions">
          <Icon name="ellipsis-horizontal" size={19} color={colors.textMuted} />
        </Pressable>
      </View>

      {badges.length ? (
        <View style={styles.identityMetaRow}>
          {badges.map((badge, index) => (
            <View key={badge.id || badge.code || `${badge.label}-${index}`} style={[styles.identityBadge, { backgroundColor: badge.backgroundColor }]}>
              <Text style={[styles.identityBadgeText, { color: badge.textColor }]}>{badge.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {post.body?.trim() ? <Text style={[styles.bodyText, { color: colors.text }]}>{post.body}</Text> : null}

      {media.length ? (
        <View style={styles.mediaList}>
          {media.map((item, index) => {
            const kind = mediaKind(item);
            const key = item.id || (item as any).uploadId || `${kind || 'media'}-${index}-${item.url}`;
            if (kind === 'video') {
              return (
                <View key={key} style={[styles.richMediaFrame, { borderColor: colors.borderSubtle }]}>
                  <VideoPlayer
                    title={mediaTitle(item, 'Community video')}
                    sourceUrl={item.url}
                    posterUrl={item.thumbnailUrl}
                    durationSeconds={item.duration_seconds}
                  />
                </View>
              );
            }
            if (kind === 'audio') {
              return (
                <AudioPlayer
                  key={key}
                  title={mediaTitle(item, 'Community audio')}
                  speaker={displayName}
                  sourceUrl={item.url}
                  durationSeconds={item.duration_seconds}
                  style={styles.audioPlayer}
                />
              );
            }
            return (
              <View key={key} style={[styles.mediaFrame, { backgroundColor: colors.bgSecondary }]}>
                <Image source={{ uri: item.url! }} style={styles.mediaImage} resizeMode="cover" accessibilityLabel={item.alt || 'Community post image'} />
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.actionRail, { borderTopColor: colors.borderSubtle }]}>
        {canEngage ? (
          <>
            <Pressable onPress={onComment || onReply} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed && { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Reply to post">
              <Icon name="chatbubble-outline" size={19} color={colors.textSecondary} />
              <Text style={[styles.actionCount, { color: colors.textSecondary }]}>{postAsAny.comments_count || ''}</Text>
            </Pressable>
            <Pressable onPress={handleLike} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed && { backgroundColor: colors.liveSoft }]} accessibilityRole="button" accessibilityLabel="Like post">
              <Icon name={hasLiked ? 'heart' : 'heart-outline'} size={19} color={hasLiked ? colors.live : colors.textSecondary} />
              <Text style={[styles.actionCount, { color: hasLiked ? colors.live : colors.textSecondary }]}>{likeCount > 0 ? likeCount : ''}</Text>
            </Pressable>
            <Pressable onPress={handleSave} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed && { backgroundColor: colors.primarySoft }]} accessibilityRole="button" accessibilityLabel="Bookmark post">
              <Icon name={hasSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={hasSaved ? colors.interactive : colors.textSecondary} />
            </Pressable>
          </>
        ) : (
          <Text style={[styles.guestMeta, { color: colors.textMuted }]}>Sign in to join the conversation</Text>
        )}
        <Pressable onPress={handleNativeShare} hitSlop={6} style={({ pressed }) => [styles.actionButton, pressed && { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Share post">
          <Icon name="share-social-outline" size={19} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.card,
    ...shadows.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityColumn: { flex: 1, minWidth: 0 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 4 },
  displayName: { fontSize: 15, fontWeight: '800', flexShrink: 1, letterSpacing: -0.2 },
  timestamp: { fontSize: 12, fontWeight: '500' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1, minWidth: 0 },
  handleText: { fontSize: 12, flexShrink: 1 },
  metaDot: { fontSize: 10 },
  expressionText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  moreButton: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  identityMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: spacing.md },
  identityBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  identityBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  bodyText: { fontSize: 15, lineHeight: 22, marginTop: spacing.md, letterSpacing: -0.08 },
  mediaList: { gap: spacing.sm, marginTop: spacing.md },
  mediaFrame: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%' },
  richMediaFrame: { width: '100%', overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1 },
  audioPlayer: { width: '100%' },
  actionRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  actionButton: { minWidth: 42, height: 36, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8 },
  actionCount: { fontSize: 12, fontWeight: '600' },
  guestMeta: { fontSize: 11, fontWeight: '600' },
});

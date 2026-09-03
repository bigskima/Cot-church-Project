import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, Share } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
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
      // The native share sheet can be dismissed without changing post state.
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
    <Pressable onPress={onPress} style={[styles.container, { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }, style]}>
      <Pressable onPress={onPressAuthor || onPress} style={styles.avatarColumn}>
        <Avatar name={displayName} url={avatarUrl} size="md" />
      </Pressable>

      <View style={styles.contentColumn}>
        <View style={styles.authorRow}>
          <Pressable onPress={onPressAuthor || onPress} style={styles.nameGroup}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            {isVerified ? <Icon name="checkmark-circle" size={14} color={colors.interactive} style={styles.verifiedIcon} /> : null}
            {handle ? <Text style={[styles.handleText, { color: colors.textMuted }]} numberOfLines={1}>@{handle}</Text> : null}
          </Pressable>
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>· {formatTime()}</Text>
        </View>

        {badges.length || expressionLabel ? (
          <View style={styles.identityMetaRow}>
            {badges.map((badge, index) => (
              <View key={badge.id || badge.code || `${badge.label}-${index}`} style={[styles.identityBadge, { backgroundColor: badge.backgroundColor }]}>
                <Text style={[styles.identityBadgeText, { color: badge.textColor }]}>{badge.label}</Text>
              </View>
            ))}
            {expressionLabel ? <Text style={[styles.expressionText, { color: colors.textMuted }]} numberOfLines={1}>{expressionLabel}</Text> : null}
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

        <View style={styles.actionRail}>
          {canEngage ? (
            <>
              <Pressable onPress={onComment || onReply} hitSlop={6} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Reply to post">
                <Icon name="chatbubble-outline" size={17} color={colors.textMuted} />
                <Text style={[styles.actionCount, { color: colors.textMuted }]}>{postAsAny.comments_count || 0}</Text>
              </Pressable>
              <Pressable onPress={handleLike} hitSlop={6} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Like post">
                <Icon name={hasLiked ? 'heart' : 'heart-outline'} size={17} color={hasLiked ? colors.live : colors.textMuted} />
                <Text style={[styles.actionCount, { color: hasLiked ? colors.live : colors.textMuted }]}>{likeCount > 0 ? likeCount : ''}</Text>
              </Pressable>
              <Pressable onPress={handleSave} hitSlop={6} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Bookmark post">
                <Icon name={hasSaved ? 'bookmark' : 'bookmark-outline'} size={17} color={hasSaved ? colors.interactive : colors.textMuted} />
              </Pressable>
            </>
          ) : (
            <Text style={[styles.guestMeta, { color: colors.textMuted }]}>Sign in to join the conversation</Text>
          )}
          <Pressable onPress={handleNativeShare} hitSlop={6} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Share post">
            <Icon name="share-social-outline" size={17} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  avatarColumn: { marginRight: spacing.md },
  contentColumn: { flex: 1, gap: 4 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 3 },
  displayName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  verifiedIcon: { marginLeft: 1 },
  handleText: { fontSize: 13, flexShrink: 1 },
  timestamp: { fontSize: 13, marginLeft: 4 },
  identityMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  identityBadge: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  identityBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  expressionText: { fontSize: 11, fontWeight: '600', maxWidth: 160 },
  bodyText: { fontSize: 15, lineHeight: 21, marginTop: 2 },
  mediaList: { gap: spacing.sm, marginTop: spacing.sm },
  mediaFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%' },
  richMediaFrame: { width: '100%', overflow: 'hidden', borderRadius: radius.md, borderWidth: 1 },
  audioPlayer: { width: '100%' },
  actionRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingRight: spacing.xl },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  actionCount: { fontSize: 12, fontWeight: '500' },
  guestMeta: { fontSize: 11, fontWeight: '600' },
});
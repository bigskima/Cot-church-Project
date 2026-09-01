import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, Share } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import type { Post, SocialPost } from '@/types/content';

export interface PostCardProps {
  post: Post | SocialPost;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string | null;
  expressionName?: string;
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

export function PostCard({
  post,
  authorName,
  authorHandle,
  authorAvatar,
  expressionName,
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
  const displayName =
    authorName ||
    postAsAny.author?.display_name ||
    postAsAny.author_name ||
    'Church Member';
  const handle =
    authorHandle ||
    postAsAny.author?.handle ||
    postAsAny.author_handle ||
    'fellowship';
  const avatarUrl =
    authorAvatar ||
    postAsAny.author?.avatar_url ||
    postAsAny.author_avatar;
  const isVerified =
    postAsAny.author?.is_verified ||
    postAsAny.is_verified ||
    false;

  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(
    postAsAny.likes_count ?? (post.social_reactions?.length || 0)
  );
  const [hasSaved, setHasSaved] = useState(false);

  const handleLike = () => {
    if (hasLiked) {
      setHasLiked(false);
      setLikeCount((c: number) => Math.max(0, c - 1));
    } else {
      setHasLiked(true);
      setLikeCount((c: number) => c + 1);
      onReact?.('amen');
      onLike?.();
    }
  };

  const handleSave = () => {
    setHasSaved(!hasSaved);
    onBookmark?.();
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `${displayName} on Church: "${post.body}"`,
      });
      onShare?.();
    } catch {
      // Ignored
    }
  };

  const formatTime = () => {
    const d = new Date(post.published_at || (post as any).created_at || Date.now());
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const mediaItem = post.media?.[0];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderBottomColor: colors.borderSubtle,
        },
        style,
      ]}
    >
      {/* Left Column: Avatar */}
      <Pressable onPress={onPressAuthor || onPress} style={styles.avatarColumn}>
        <Avatar name={displayName} url={avatarUrl} size="md" />
      </Pressable>

      {/* Right Column: Post Body & Thread Action Rail */}
      <View style={styles.contentColumn}>
        {/* Author Header Row */}
        <View style={styles.authorRow}>
          <Pressable onPress={onPressAuthor || onPress} style={styles.nameGroup}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isVerified && (
              <Icon name="checkmark-circle" size={14} color="#1D9BF0" style={styles.verifiedIcon} />
            )}
            <Text style={[styles.handleText, { color: colors.textMuted }]} numberOfLines={1}>
              @{handle}
            </Text>
          </Pressable>

          <Text style={[styles.timestamp, { color: colors.textMuted }]}>· {formatTime()}</Text>
        </View>

        {/* Post Text */}
        <Text style={[styles.bodyText, { color: colors.text }]}>{post.body}</Text>

        {/* Media Attachment if present */}
        {mediaItem?.url ? (
          <View style={[styles.mediaFrame, { backgroundColor: colors.bgSecondary }]}>
            <Image
              source={{ uri: mediaItem.url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Twitter / Threads Interaction Rail */}
        <View style={styles.actionRail}>
          {/* Reply / Comment */}
          <Pressable
            onPress={onComment || onReply}
            hitSlop={6}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Reply to post"
          >
            <Icon name="chatbubble-outline" size={17} color={colors.textMuted} />
            <Text style={[styles.actionCount, { color: colors.textMuted }]}>
              {postAsAny.comments_count || 0}
            </Text>
          </Pressable>

          {/* Like / Amen */}
          <Pressable
            onPress={handleLike}
            hitSlop={6}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Amen or like post"
          >
            <Icon
              name={hasLiked ? 'heart' : 'heart-outline'}
              size={17}
              color={hasLiked ? '#EF4444' : colors.textMuted}
            />
            <Text
              style={[
                styles.actionCount,
                { color: hasLiked ? '#EF4444' : colors.textMuted },
              ]}
            >
              {likeCount > 0 ? likeCount : ''}
            </Text>
          </Pressable>

          {/* Bookmark */}
          <Pressable
            onPress={handleSave}
            hitSlop={6}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Bookmark post"
          >
            <Icon
              name={hasSaved ? 'bookmark' : 'bookmark-outline'}
              size={17}
              color={hasSaved ? colors.interactive : colors.textMuted}
            />
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={handleNativeShare}
            hitSlop={6}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Share post"
          >
            <Icon name="share-social-outline" size={17} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatarColumn: {
    marginRight: spacing.md,
  },
  contentColumn: {
    flex: 1,
    gap: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 3,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 1,
  },
  handleText: {
    fontSize: 13,
    flexShrink: 1,
  },
  timestamp: {
    fontSize: 13,
    marginLeft: 4,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  mediaFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  actionRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingRight: spacing.xxl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
});

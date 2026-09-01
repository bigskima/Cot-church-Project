import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import type { SocialPost } from '@/types/content';

export interface PostCardProps {
  post: SocialPost;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string | null;
  expressionName?: string;
  onPress?: () => void;
  onReply?: () => void;
  onReact?: (reaction: string) => void;
  onBookmark?: () => void;
  onShare?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function PostCard({
  post,
  authorName = 'Church Member',
  authorHandle,
  authorAvatar,
  expressionName,
  onPress,
  onReply,
  onReact,
  onBookmark,
  onShare,
  style,
}: PostCardProps) {
  const { colors } = useTheme();

  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.social_reactions?.length || 0);
  const [hasSaved, setHasSaved] = useState(false);

  const handleLike = () => {
    if (hasLiked) {
      setHasLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      setHasLiked(true);
      setLikeCount((c) => c + 1);
      onReact?.('amen');
    }
  };

  const handleSave = () => {
    setHasSaved(!hasSaved);
    onBookmark?.();
  };

  const formatTime = () => {
    const d = new Date(post.published_at || Date.now());
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const mediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnailUrl;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowContainer,
        { borderBottomColor: colors.borderSubtle },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {/* Left Column: Avatar */}
      <View style={styles.leftCol}>
        <Avatar url={authorAvatar} name={authorName} size="md" />
      </View>

      {/* Right Column: Content + Actions (Twitter / Threads style) */}
      <View style={styles.rightCol}>
        {/* Author Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.nameGroup}>
            <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
              {authorName}
            </Text>
            <Icon name="checkmark-circle" size={14} color={colors.interactive} />
            <Text style={[styles.handleText, { color: colors.textMuted }]} numberOfLines={1}>
              {authorHandle ? `@${authorHandle}` : expressionName ? `· ${expressionName}` : ''}
            </Text>
          </View>

          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {formatTime()}
          </Text>
        </View>

        {/* Post Body Text */}
        <Text style={[styles.bodyText, { color: colors.text }]}>
          {post.body}
        </Text>

        {/* Media Attachment (if present) */}
        {mediaUrl ? (
          <View style={[styles.mediaContainer, { borderColor: colors.border }]}>
            <Image source={{ uri: mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
          </View>
        ) : null}

        {/* Twitter / Threads Action Rail */}
        <View style={styles.actionRail}>
          {/* Reply */}
          <Pressable
            onPress={onReply}
            hitSlop={8}
            style={styles.actionItem}
            accessibilityLabel="Reply"
          >
            <Icon name="chatbubble-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.actionCount, { color: colors.textMuted }]}>
              {/* replies */}
            </Text>
          </Pressable>

          {/* Repost / Fellowship */}
          <Pressable
            onPress={onShare}
            hitSlop={8}
            style={styles.actionItem}
            accessibilityLabel="Repost"
          >
            <Icon name="repeat-outline" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Amen / Like */}
          <Pressable
            onPress={handleLike}
            hitSlop={8}
            style={styles.actionItem}
            accessibilityLabel="Amen reaction"
          >
            <Icon
              name={hasLiked ? 'heart' : 'heart-outline'}
              size={17}
              color={hasLiked ? '#EF4444' : colors.textMuted}
            />
            {likeCount > 0 ? (
              <Text
                style={[
                  styles.actionCount,
                  { color: hasLiked ? '#EF4444' : colors.textMuted },
                ]}
              >
                {likeCount}
              </Text>
            ) : null}
          </Pressable>

          {/* Bookmark */}
          <Pressable
            onPress={handleSave}
            hitSlop={8}
            style={styles.actionItem}
            accessibilityLabel="Bookmark"
          >
            <Icon
              name={hasSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={hasSaved ? colors.interactive : colors.textMuted}
            />
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={onShare}
            hitSlop={8}
            style={styles.actionItem}
            accessibilityLabel="Share"
          >
            <Icon name="share-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  leftCol: {
    marginRight: spacing.md,
  },
  rightCol: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  handleText: {
    fontSize: 13,
    flexShrink: 1,
  },
  timeText: {
    fontSize: 12,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    marginTop: spacing.xs,
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
    paddingRight: spacing.xl,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 32,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.85,
  },
});

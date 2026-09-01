import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/state/theme';
import type { SocialPost } from '@/types/content';
import { radius, spacing, typography } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';

export interface PostCardProps {
  post: SocialPost;
  onReact?: (reaction: string) => void;
  onComment?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
  onAuthorPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function PostCard({
  post,
  onReact,
  onComment,
  onShare,
  onBookmark,
  onAuthorPress,
  style,
}: PostCardProps) {
  const { colors, isDark } = useTheme();
  const [reacted, setReacted] = useState(false);
  const [reactionCount, setReactionCount] = useState(post.social_reactions?.length ?? 0);
  const [bookmarked, setBookmarked] = useState(false);

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const handleToggleReact = () => {
    const next = !reacted;
    setReacted(next);
    setReactionCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    onReact?.('amen');
  };

  const handleToggleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      {/* Author Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={onAuthorPress} style={styles.authorGroup}>
          <Avatar name="Community Member" size="sm" />
          <View style={styles.authorMeta}>
            <View style={styles.authorNameRow}>
              <Text style={[styles.authorName, { color: colors.text }]}>Church Member</Text>
              {post.visibility === 'public' ? (
                <View style={[styles.verifiedPill, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.verifiedText, { color: colors.interactive }]}>Public</Text>
                </View>
              ) : null}
            </View>
            {formattedDate ? (
              <Text style={[styles.timestamp, { color: colors.textMuted }]}>{formattedDate}</Text>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          hitSlop={8}
          style={styles.moreButton}
          accessibilityRole="button"
          accessibilityLabel="Post options"
        >
          <Icon name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Post Body */}
      <Text style={[styles.bodyText, { color: colors.text }]}>{post.body}</Text>

      {/* Post Media if available */}
      {post.media && post.media.length > 0 && post.media[0]?.url ? (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: post.media[0].url }}
            style={styles.postImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Social Action Bar */}
      <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}>
        {/* Amen / Reaction */}
        <Pressable
          onPress={handleToggleReact}
          hitSlop={6}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="React"
        >
          <Icon
            name={reacted ? 'heart' : 'heart-outline'}
            size={18}
            color={reacted ? '#E5484D' : colors.textMuted}
          />
          <Text
            style={[
              styles.actionLabel,
              { color: reacted ? '#E5484D' : colors.textSecondary },
            ]}
          >
            {reactionCount > 0 ? reactionCount : 'Amen'}
          </Text>
        </Pressable>

        {/* Comment Action */}
        <Pressable
          onPress={onComment}
          hitSlop={6}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Comment"
        >
          <Icon name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Reply</Text>
        </Pressable>

        {/* Bookmark Action */}
        <Pressable
          onPress={handleToggleBookmark}
          hitSlop={6}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Save post"
        >
          <Icon
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={bookmarked ? colors.interactive : colors.textMuted}
          />
        </Pressable>

        {/* Share Action */}
        <Pressable
          onPress={onShare}
          hitSlop={6}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          <Icon name="share-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  authorMeta: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 1,
  },
  moreButton: {
    padding: 4,
  },
  bodyText: {
    ...typography.body,
    lineHeight: 22,
    marginVertical: spacing.xs,
  },
  mediaContainer: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});

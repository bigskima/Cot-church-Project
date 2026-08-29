import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { CommentSheet, ReactionDrawer, ResourceError, Skeleton, VideoCard, VideoPlayer } from '@/components';
import { palette, radius, spacing } from '@/design-system/tokens';
import type { ContentComment, Video } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch Video Details
  const videoResource = useResource<Video>(`watch:${id}`, (signal) =>
    api.request<Video[]>(`public-content?type=videos&id=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal })
      .then((res) => (Array.isArray(res) ? res.find((v) => v.id === id) ?? res[0] : res))
  );

  // Fetch Related Videos
  const relatedResource = useResource<Video[]>('watch:related', (signal) =>
    api.request<Video[]>(`public-content?type=videos${organization ? `&organizationId=${organization}` : ''}`, { signal })
  );

  const video = videoResource.data;
  const related = (relatedResource.data ?? []).filter((v) => v.id !== id);

  const handleOpenComments = async () => {
    if (!video) return;
    setCommentsVisible(true);
    setCommentLoading(true);
    try {
      const res = await api.request<ContentComment[]>(`engagement?contentId=${video.id}`);
      setComments(res ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSendComment = async (body: string, parentCommentId?: string | null) => {
    if (!video) return;
    try {
      const res = await api.request<ContentComment>('engagement', {
        method: 'POST',
        body: JSON.stringify({
          action: 'comment',
          contentId: video.id,
          body,
          parentCommentId,
        }),
      });
      if (res) setComments([...comments, res]);
    } catch {
      // Ignored
    }
  };

  const handleReact = async (reaction: string) => {
    if (mode === 'visitor' || !video) return;
    try {
      await api.request('engagement', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', contentId: video.id, reaction }),
      });
    } catch {
      // Ignored
    }
  };

  const handleToggleBookmark = async () => {
    if (mode === 'visitor' || !video) return;
    try {
      await api.request('engagement', {
        method: 'POST',
        body: JSON.stringify({ action: 'bookmark', contentId: video.id }),
      });
      setIsBookmarked(!isBookmarked);
    } catch {
      // Ignored
    }
  };

  const handleToggleFollow = async () => {
    if (mode === 'visitor' || !video) return;
    try {
      await api.request('follows', {
        method: 'POST',
        body: JSON.stringify({ expressionId: video.content_items?.expression_id ?? null, organizationId: video.organization_id }),
      });
      setIsFollowing(!isFollowing);
    } catch {
      // Ignored
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }] as any}>
      {/* Top Navigation */}
      <View
        style={[
          styles.navBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ] as any}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn as any}>
          <Text style={[styles.backText, { color: colors.text }] as any}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }] as any} numberOfLines={1}>
          Watch Experience
        </Text>
        <Pressable onPress={handleToggleBookmark} style={styles.bookmarkNavBtn as any}>
          <Text style={{ fontSize: 18 } as any}>{isBookmarked ? '🔖' : '🏷️'}</Text>
        </Pressable>
      </View>

      {videoResource.loading ? (
        <View style={styles.loadingContainer as any}>
          <Skeleton height={220} dark={isDark} />
          <Skeleton height={30} count={3} dark={isDark} />
        </View>
      ) : videoResource.error || !video ? (
        <View style={styles.centerWrapper as any}>
          <ResourceError
            offline={videoResource.offline}
            message={videoResource.error ?? 'Video not found'}
            retry={videoResource.refresh}
            dark={isDark}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content as any}>
          {/* Main Video Player */}
          <VideoPlayer
            title={video.title}
            durationSeconds={video.media_assets?.duration_seconds}
            chapters={video.chapters}
            dark={isDark}
          />

          {/* Title & Metadata */}
          <View style={styles.metaSection as any}>
            <View style={styles.categoryRow as any}>
              <View style={styles.categoryPill as any}>
                <Text style={styles.categoryText as any}>{video.category.toUpperCase()}</Text>
              </View>
              <Text style={[styles.dateText, { color: colors.textMuted }] as any}>
                {new Date(video.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.text }] as any}>{video.title}</Text>

            {/* Expression Creator Banner */}
            <View
              style={[
                styles.creatorBanner,
                { backgroundColor: colors.card, borderColor: colors.border },
              ] as any}
            >
              <View style={styles.avatarCircle as any}>
                <Text style={{ fontSize: 16 } as any}>🏛️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.creatorName, { color: colors.text }] as any}>
                  Sanctuary Campus
                </Text>
                <Text style={[styles.creatorSubtitle, { color: palette.gold }] as any}>
                  Official Ministry Broadcast
                </Text>
              </View>
              <Pressable
                onPress={handleToggleFollow}
                style={[
                  styles.followPill,
                  isFollowing ? styles.followingPill : null,
                ] as any}
              >
                <Text style={[styles.followText, isFollowing ? styles.followingText : null] as any}>
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </Text>
              </Pressable>
            </View>

            {/* Engagement Reaction Bar */}
            <ReactionDrawer onReact={handleReact} />

            {/* Comments Quick Trigger */}
            <Pressable
              onPress={handleOpenComments}
              style={[
                styles.commentsTrigger,
                { backgroundColor: isDark ? '#1C1008' : '#FFFDF9', borderColor: isDark ? '#3D2415' : palette.line },
              ] as any}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 } as any}>💬</Text>
                <Text style={[styles.commentsTriggerText, { color: colors.text }] as any}>
                  Discussion & Fellowship ({video.comments_count})
                </Text>
              </View>
              <Text style={{ color: palette.gold, fontSize: 13, fontWeight: '800' } as any}>
                Join Conversation ›
              </Text>
            </Pressable>

            {/* Description Box */}
            {video.description ? (
              <View
                style={[
                  styles.descBox,
                  { backgroundColor: isDark ? '#140C07' : '#F8EDE2' },
                ] as any}
              >
                <Text style={[styles.descTitle, { color: palette.gold }] as any}>ABOUT THIS VIDEO</Text>
                <Text style={[styles.descText, { color: colors.text }] as any}>
                  {video.description}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Related Watch Videos */}
          {related.length > 0 ? (
            <View style={styles.relatedSection as any}>
              <Text style={[styles.relatedHeading, { color: colors.text }] as any}>
                More From Sanctuary Watch
              </Text>
              {related.map((item) => (
                <VideoCard
                  key={item.id}
                  video={item}
                  onPress={() => router.push(`/watch/${item.id}` as any)}
                  dark={isDark}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Threaded Comment Drawer */}
      <CommentSheet
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
        comments={comments}
        onSubmitComment={handleSendComment}
        loading={commentLoading}
      />
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '800',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  bookmarkNavBtn: {
    padding: 4,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  metaSection: {
    gap: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    backgroundColor: '#2E1C11',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  categoryText: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  creatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '900',
  },
  creatorSubtitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  followPill: {
    backgroundColor: palette.gold,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  followingPill: {
    backgroundColor: 'rgba(255, 253, 249, 0.2)',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  followText: {
    color: '#140C07',
    fontSize: 12,
    fontWeight: '900',
  },
  followingText: {
    color: palette.gold,
  },
  commentsTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  commentsTriggerText: {
    fontSize: 13,
    fontWeight: '800',
  },
  descBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 6,
  },
  descTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  descText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  relatedSection: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  relatedHeading: {
    fontSize: 16,
    fontWeight: '900',
  },
});

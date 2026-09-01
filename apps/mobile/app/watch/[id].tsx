import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  CommentSheet,
  EmptyState,
  Icon,
  ReactionDrawer,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  VideoCard,
  VideoPlayer,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { ContentComment, Video } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

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

  const expressionName = context?.expression?.name || context?.organizations?.[0]?.name;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title={video?.title ?? 'Video Presentation'}
          subtitle={video?.category ? `${video.category.toUpperCase()} • Watch Library` : undefined}
          showBack
        />

        <View style={styles.body}>
          {videoResource.loading ? (
            <Skeleton height={220} />
          ) : videoResource.error && !video ? (
            <ResourceError message={videoResource.error} retry={videoResource.refresh} />
          ) : video ? (
            <>
              {/* Video Player Canvas */}
              <VideoPlayer
                title={video.title}
                posterUrl={video.media_assets?.thumbnailUrl}
                durationSeconds={video.media_assets?.duration_seconds}
              />

              {/* Title & Metadata Details */}
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                {video.category ? (
                  <Badge label={video.category.toUpperCase()} variant="primary" />
                ) : null}
                <Text style={[styles.title, { color: colors.text }]}>{video.title}</Text>
                {video.description ? (
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {video.description}
                  </Text>
                ) : null}

                {/* Interaction Action Row */}
                <View style={[styles.actionRow, { borderTopColor: colors.borderSubtle }]}>
                  <Pressable
                    onPress={handleOpenComments}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: colors.bgSecondary },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="chatbubble-outline" size={16} color={colors.text} />
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Comments</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleToggleBookmark}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: isBookmarked ? colors.primarySoft : colors.bgSecondary,
                        borderColor: isBookmarked ? colors.interactive : 'transparent',
                        borderWidth: 1,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon
                      name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                      size={16}
                      color={isBookmarked ? colors.interactive : colors.text}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: isBookmarked ? colors.interactive : colors.text },
                      ]}
                    >
                      {isBookmarked ? 'Saved' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Related Videos */}
              {related.length > 0 ? (
                <View style={styles.relatedSection}>
                  <SectionHeader title="Related Teachings & Videos" />
                  {related.slice(0, 3).map((r) => (
                    <VideoCard
                      key={r.id}
                      video={r}
                      expressionName={expressionName}
                      onPress={() => router.push(`/watch/${r.id}`)}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Comments Sheet */}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  infoCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.h2,
    lineHeight: 28,
  },
  description: {
    ...typography.body,
    lineHeight: 22,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  relatedSection: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});

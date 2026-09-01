import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Avatar,
  Badge,
  Button,
  CommentSheet,
  Icon,
  ResourceError,
  ScreenHeader,
  VideoCard,
  VideoPlayer,
  WatchSkeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Video } from '@/types/content';

export default function WatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const resource = useResource<Video>(`watch:detail:${id}`, (signal) => {
    if (mode === 'visitor') {
      return api
        .request<Video[]>(`public-content?type=videos`, { signal })
        .then((list) => {
          const match = list.find((v) => v.id === id);
          if (!match) throw new Error('Video not found.');
          return match;
        });
    }
    return api.request<Video[]>(`public-content?type=videos`, { signal }).then((list) => {
      const match = list.find((v) => v.id === id);
      if (!match) throw new Error('Video not found.');
      return match;
    });
  });

  const relatedResource = useResource<Video[]>('watch:related', (signal) => {
    return api.request<Video[]>('public-content?type=videos', { signal });
  });

  const video = resource.data;
  const relatedVideos = (relatedResource.data ?? []).filter((v) => v.id !== id);

  const videoUrl =
    video?.media_assets?.renditions?.find((r) => r.rendition_kind === 'video_stream')?.storage_path ||
    video?.media_assets?.url;
  const posterUrl = video?.media_assets?.thumbnailUrl || video?.media_assets?.url;

  const handleLike = async () => {
    if (mode === 'visitor') return;
    setIsLiked(!isLiked);
    try {
      await api.request('engagement', {
        method: 'POST',
        body: JSON.stringify({
          action: 'react',
          targetId: id,
          targetType: 'video',
          reaction: 'like',
        }),
      });
    } catch {
      // Ignored
    }
  };

  const handleSave = async () => {
    if (mode === 'visitor') return;
    setIsSaved(!isSaved);
    try {
      await api.request('engagement', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bookmark',
          targetId: id,
          targetType: 'video',
        }),
      });
    } catch {
      // Ignored
    }
  };

  const handleShare = async () => {
    if (!video) return;
    try {
      await Share.share({
        message: `Watch "${video.title}" on Church of the Truth.`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="" showBack style={{ backgroundColor: 'transparent' }} />

      {resource.loading ? (
        <WatchSkeleton />
      ) : resource.error && !video ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : video ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        >
          {/* Dominant 16:9 Video Canvas */}
          <VideoPlayer
            title={video.title}
            sourceUrl={videoUrl}
            posterUrl={posterUrl}
            durationSeconds={video.media_assets?.duration_seconds}
          />

          {/* Video Metadata & Title */}
          <View style={styles.metadataSection}>
            <Text style={[styles.title, { color: colors.text }]}>{video.title}</Text>

            <View style={styles.authorRow}>
              <Avatar name={context?.expression?.name || 'Church'} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                  {context?.expression?.name || 'Church of the Truth'}
                </Text>
                <Text style={[styles.authorSub, { color: colors.textSecondary }]}>
                  {video.category || 'Ministry Teaching'}
                </Text>
              </View>
            </View>

            {/* YouTube-Style Action Rail (Like, Save, Share, Comments) */}
            <View style={[styles.actionsBar, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
              <Pressable
                onPress={handleLike}
                style={[styles.actionBtn, isLiked && { backgroundColor: colors.primarySoft }]}
              >
                <Icon
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isLiked ? '#EF4444' : colors.text}
                />
                <Text style={[styles.actionBtnText, { color: isLiked ? '#EF4444' : colors.text }]}>
                  {isLiked ? 'Liked' : 'Like'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                style={[styles.actionBtn, isSaved && { backgroundColor: colors.primarySoft }]}
              >
                <Icon
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isSaved ? colors.interactive : colors.text}
                />
                <Text style={[styles.actionBtnText, { color: isSaved ? colors.interactive : colors.text }]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </Pressable>

              <Pressable onPress={handleShare} style={styles.actionBtn}>
                <Icon name="share-social-outline" size={20} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Share</Text>
              </Pressable>

              <Pressable onPress={() => setCommentsOpen(true)} style={styles.actionBtn}>
                <Icon name="chatbubble-ellipses-outline" size={20} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Comments</Text>
              </Pressable>
            </View>

            {/* Description */}
            {video.description ? (
              <View style={[styles.descCard, { backgroundColor: colors.bgSecondary }]}>
                <Text style={[styles.descText, { color: colors.text }]}>{video.description}</Text>
              </View>
            ) : null}

            {/* Related Videos Stack */}
            {relatedVideos.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={[styles.relatedHeading, { color: colors.text }]}>Related Teachings</Text>
                <View style={styles.relatedGrid}>
                  {relatedVideos.slice(0, 3).map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      onPress={() => router.push(`/watch/${v.id}` as any)}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      ) : null}

      {/* Comments Sheet */}
      <CommentSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={[]}
        onSubmitComment={async (body) => {
          try {
            await api.request('engagement', {
              method: 'POST',
              body: JSON.stringify({
                action: 'comment',
                targetId: id,
                targetType: 'video',
                body,
              }),
            });
            setCommentsOpen(false);
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Unable to post comment');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  metadataSection: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  authorSub: {
    fontSize: 12,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  descCard: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
  },
  relatedSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  relatedHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  relatedGrid: {
    gap: spacing.md,
  },
});

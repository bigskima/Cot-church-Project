import React, { useCallback, useRef, useState } from 'react';
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
import type { ContentComment } from '@/types/content';

type EngagementState = { reaction: string | null; bookmarked: boolean; progress: { progress_seconds: number; duration_seconds: number; completed: boolean } | null };
type PlaybackInfo = { available: boolean; renditions?: { kind?: string; playbackUrl?: string; storagePath?: string }[] };

export default function WatchDetailScreen() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const lastSyncedSecond = useRef(0);
  const expressionMode = requestedContext === 'expression';
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const resource = useResource<Video>(`watch:detail:${expressionMode ? context?.expression?.id ?? 'none' : 'public'}:${id}`, async (signal) => {
    if (expressionMode) {
      if (mode === 'visitor' || !context?.expression?.id) throw new Error('Enter this Expression to view its internal video.');
      const payload = await api.request<{ videos: Video[] }>(`home-feed?organizationId=${encodeURIComponent(organizationId)}&expressionId=${encodeURIComponent(context.expression.id)}`, { signal });
      const match = payload.videos.find((video) => video.id === id);
      if (!match) throw new Error('This video is not available in the active Expression.');
      return match;
    }
    const suffix = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : '';
    return api.request<Video>(`public-content?type=video&id=${encodeURIComponent(id)}${suffix}`, { signal, context: 'public' });
  });

  const relatedResource = useResource<Video[]>(`watch:related:${expressionMode ? context?.expression?.id ?? 'none' : `public:${organizationId}`}`, async (signal) => {
    if (expressionMode && context?.expression?.id) return (await api.request<{ videos: Video[] }>(`home-feed?organizationId=${encodeURIComponent(organizationId)}&expressionId=${encodeURIComponent(context.expression.id)}`, { signal })).videos;
    return api.request<Video[]>(`public-content?type=videos${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ''}`, { signal, context: 'public' });
  });

  const video = resource.data;
  const contentId = video?.content_items?.id;

  const engagement = useResource<EngagementState>(
    `watch:engagement:${mode}:${contentId ?? 'pending'}`,
    (signal) => mode === 'authenticated' && contentId
      ? api.request<EngagementState>(
          `engagement?contentId=${encodeURIComponent(contentId)}&view=state`,
          { signal, context: expressionMode ? 'current' : 'public' },
        )
      : Promise.resolve({ reaction: null, bookmarked: false, progress: null }),
  );
  const comments = useResource<ContentComment[]>(
    `watch:comments:${contentId ?? 'pending'}`,
    (signal) => contentId
      ? api.request<ContentComment[]>(
          `engagement?contentId=${encodeURIComponent(contentId)}`,
          { signal, context: expressionMode ? 'current' : 'public' },
        )
      : Promise.resolve([]),
  );
  const playback = useResource<PlaybackInfo>(
    `watch:playback:${expressionMode ? context?.expression?.id ?? 'none' : 'public'}:${contentId ?? 'pending'}`,
    (signal) => contentId
      ? api.request<PlaybackInfo>(
          `content-media?action=playback&contentId=${encodeURIComponent(contentId)}`,
          { signal, context: expressionMode ? 'current' : 'public' },
        )
      : Promise.resolve({ available: false, renditions: [] }),
  );

  const relatedVideos = (relatedResource.data ?? []).filter((v) => v.id !== id);

  const videoUrl = playback.data?.renditions?.find((rendition) => rendition.kind === 'video_stream')?.playbackUrl;
  const posterUrl = video?.media_assets?.thumbnailUrl || video?.media_assets?.url;
  const identity = (video?.content_items as any)?.expression?.name || (video?.content_items as any)?.organization?.name || context?.organization?.name || 'Church Community';

  const handleLike = async () => {
    if (mode === 'visitor') { router.push('/(auth)/login'); return; }
    if (!contentId) { setActionError('This video is missing its engagement identity.'); return; }
    setActionError('');
    try {
      await api.request('engagement', {
        method: 'POST',
        context: expressionMode ? 'current' : 'public',
        body: JSON.stringify({
          action: isLiked ? 'unreact' : 'react',
          contentId,
          ...(isLiked ? {} : { reaction: 'like' }),
        }),
      });
      setIsLiked(!isLiked);
      engagement.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to update your reaction.');
    }
  };

  const handleSave = async () => {
    if (mode === 'visitor') { router.push('/(auth)/login'); return; }
    if (!contentId) { setActionError('This video is missing its engagement identity.'); return; }
    setActionError('');
    try {
      const result = await api.request<{ bookmarked: boolean }>('engagement', {
        method: 'POST',
        context: expressionMode ? 'current' : 'public',
        body: JSON.stringify({
          action: 'bookmark',
          contentId,
        }),
      });
      setIsSaved(result.bookmarked);
      engagement.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to update your saved videos.');
    }
  };

  const handleShare = async () => {
    if (!video) return;
    try {
      await Share.share({
        message: `Watch "${video.title}" on ${identity}.`,
      });
    } catch {
      // Ignored
    }
  };

  const syncProgress = useCallback((seconds: number, duration: number) => {
    if (mode !== 'authenticated' || !contentId || duration <= 0) return;
    const wholeSecond = Math.floor(seconds);
    if (wholeSecond - lastSyncedSecond.current < 15 && seconds < duration * 0.9) return;
    lastSyncedSecond.current = wholeSecond;
    void api.request('engagement', { method: 'POST', context: expressionMode ? 'current' : 'public', body: JSON.stringify({ action: 'sync_playback', contentId, progressSeconds: wholeSecond, durationSeconds: Math.floor(duration) }) }).catch(() => {});
  }, [api, contentId, expressionMode, mode]);

  React.useEffect(() => {
    setIsLiked(Boolean(engagement.data?.reaction));
    setIsSaved(Boolean(engagement.data?.bookmarked));
  }, [engagement.data]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Watch" kicker="VIDEO" showBack style={{ backgroundColor: 'transparent' }} />
      </View>

      {resource.loading ? (
        <WatchSkeleton />
      ) : resource.error && !video ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : video ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        >
          {/* Dominant 16:9 Video Canvas */}
          {playback.error ? <ResourceError message={playback.error} retry={playback.refresh} /> : <VideoPlayer
            title={video.title}
            sourceUrl={videoUrl}
            posterUrl={posterUrl}
            durationSeconds={video.media_assets?.duration_seconds}
            chapters={video.chapters}
            initialPositionSeconds={engagement.data?.progress?.completed ? 0 : engagement.data?.progress?.progress_seconds ?? 0}
            onProgress={syncProgress}
          />}

          {/* Video Metadata & Title */}
          <View style={styles.metadataSection}>
            <View style={[styles.contextPill, { backgroundColor: expressionMode ? colors.accentSoft : colors.primarySoft }]}>
              <Icon name={expressionMode ? 'people-outline' : 'globe-outline'} size={13} color={expressionMode ? colors.accent : colors.interactive} />
              <Text style={[styles.contextPillText, { color: expressionMode ? colors.accent : colors.interactive }]}>{expressionMode ? 'Expression video' : 'Public video'}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{video.title}</Text>

            <View style={styles.authorRow}>
              <Avatar name={identity} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                  {identity}
                </Text>
                <Text style={[styles.authorSub, { color: colors.textSecondary }]}>
                  {video.category || 'Ministry Teaching'}
                </Text>
              </View>
            </View>
            {actionError ? <Text style={[styles.actionError, { color: colors.live }]} accessibilityRole="alert">{actionError}</Text> : null}

            {/* YouTube-Style Action Rail (Like, Save, Share, Comments) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.actionsBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
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

              <Pressable onPress={() => mode === 'visitor' ? router.push('/(auth)/login') : setCommentsOpen(true)} style={styles.actionBtn}>
                <Icon name="chatbubble-ellipses-outline" size={20} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Comments</Text>
              </Pressable>
            </ScrollView>

            {/* Description */}
            {video.description ? (
              <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
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
                      onPress={() => router.push(`/watch/${v.id}${expressionMode ? '?context=expression' : ''}` as any)}
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
        comments={comments.data ?? []}
        loading={comments.loading}
        onSubmitComment={async (body, parentCommentId) => {
          if (!contentId) throw new Error('This video is missing its engagement identity.');
          await api.request('engagement', {
            method: 'POST',
            context: expressionMode ? 'current' : 'public',
            body: JSON.stringify({
              action: 'comment',
              contentId,
              body,
              parentCommentId,
            }),
          });
          await comments.refresh();
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  contextPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  contextPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  title: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
    letterSpacing: -0.45,
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
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  descCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionError: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
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

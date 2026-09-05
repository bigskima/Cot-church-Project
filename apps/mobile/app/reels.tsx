import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View, ViewToken } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { BottomSheet, Button, CommentSheet, Icon, ReelPlayer, ResourceError, Skeleton } from '@/components';
import type { ContentComment, Reel } from '@/types/content';

const { height: windowHeight } = Dimensions.get('window');
type PlaybackInfo = {
  available: boolean;
  renditions?: { kind?: string; playbackUrl?: string; storagePath?: string }[];
};
type ReelEngagementState = {
  reaction: string | null;
  bookmarked: boolean;
};
type ReelWithViewerState = Reel & {
  viewerReaction?: string | null;
  viewerBookmarked?: boolean;
};

export default function FullScreenReelsScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context, hasCapability } = useSession();
  const { reelId } = useLocalSearchParams<{ reelId?: string }>();
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeReelForComments, setActiveReelForComments] = useState<Reel | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [shareTarget, setShareTarget] = useState<ReelWithViewerState | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const listRef = useRef<FlatList<ReelWithViewerState>>(null);
  const appliedDeepLinkRef = useRef<string | null>(null);
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const expressionId = context?.expression?.id;

  const reelsResource = useResource<ReelWithViewerState[]>(`reels:immersive:${expressionId ? `expression:${expressionId}` : `public:${organizationId || 'auto'}`}:${mode}`, async (signal) => {
    const reels = expressionId
      ? (await api.request<{ reels: Reel[] }>(`home-feed?organizationId=${encodeURIComponent(organizationId)}&expressionId=${encodeURIComponent(expressionId)}`, { signal })).reels
      : await api.request<Reel[]>(`public-content?type=reels${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ''}`, { signal });
    return Promise.all(reels.map(async (reel) => {
      const contentId = reel.content_items?.id;
      if (!contentId) return reel as ReelWithViewerState;

      const [playbackResult, engagementResult] = await Promise.allSettled([
        api.request<PlaybackInfo>(
          `content-media?action=playback&contentId=${encodeURIComponent(contentId)}`,
          { signal, context: expressionId ? 'current' : 'public' },
        ),
        mode === 'authenticated'
          ? api.request<ReelEngagementState>(
              `engagement?contentId=${encodeURIComponent(contentId)}&view=state`,
              { signal, context: expressionId ? 'current' : 'public' },
            )
          : Promise.resolve({ reaction: null, bookmarked: false }),
      ]);

      const playback = playbackResult.status === 'fulfilled' ? playbackResult.value : null;
      const engagement = engagementResult.status === 'fulfilled' ? engagementResult.value : null;
      const playbackUrl = playback?.renditions?.find((rendition) => rendition.kind === 'video_stream')?.playbackUrl;
      const currentRenditions = reel.media_assets?.renditions ?? [];

      return {
        ...reel,
        viewerReaction: engagement?.reaction ?? null,
        viewerBookmarked: engagement?.bookmarked ?? false,
        media_assets: playbackUrl
          ? {
              ...(reel.media_assets ?? {}),
              url: playbackUrl,
              renditions: currentRenditions.map((rendition) =>
                rendition.rendition_kind === 'video_stream'
                  ? { ...rendition, storage_path: playbackUrl }
                  : rendition,
              ),
            }
          : reel.media_assets,
      } as ReelWithViewerState;
    }));
  });

  const reels = reelsResource.data ?? [];
  const canShareToGeneral =
    mode === 'authenticated' &&
    (
      Boolean(
        organizationId &&
        context?.expressions?.some(
          (item) => item.status === 'active' && item.organizationId === organizationId,
        ),
      ) ||
      hasCapability('feed.post') ||
      hasCapability('*')
    );

  useEffect(() => {
    if (!reelId || !reels.length || appliedDeepLinkRef.current === reelId) return;
    const targetIndex = reels.findIndex((item) => item.id === reelId);
    if (targetIndex < 0) return;
    appliedDeepLinkRef.current = reelId;
    setActiveIndex(targetIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
    });
  }, [reelId, reels]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) setActiveIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const handleOpenComments = async (reel: Reel) => {
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: '/reels' } } as any);
      return;
    }
    setActiveReelForComments(reel);
    setCommentLoading(true);
    setActionError('');
    try {
      const contentId = reel.content_items?.id;
      if (!contentId) throw new Error('This Reel is missing its engagement identity.');
      const res = await api.request<ContentComment[]>(`engagement?contentId=${contentId}`, { context: expressionId ? 'current' : 'public' });
      setComments(res ?? []);
    } catch (value) {
      setComments([]);
      setActionError(value instanceof Error ? value.message : 'Unable to load comments for this Reel.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSendComment = async (body: string, parentCommentId?: string | null) => {
    if (!activeReelForComments) return;
    const contentId = activeReelForComments.content_items?.id;
    if (!contentId) throw new Error('This Reel is missing its engagement identity.');
    setActionError('');
    const res = await api.request<ContentComment>('engagement', {
      method: 'POST',
      context: expressionId ? 'current' : 'public',
      body: JSON.stringify({ action: 'comment', contentId, body, parentCommentId }),
    });
    if (res) setComments((prev) => [...prev, res]);
  };

  const handleLikeReel = async (reel: ReelWithViewerState, currentlyLiked: boolean) => {
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: '/reels' } } as any);
      return currentlyLiked;
    }
    const contentId = reel.content_items?.id;
    if (!contentId) return currentlyLiked;
    try {
      setActionError('');
      await api.request('engagement', {
        method: 'POST',
        context: expressionId ? 'current' : 'public',
        body: JSON.stringify(
          currentlyLiked
            ? { action: 'unreact', contentId }
            : { action: 'react', contentId, reaction: 'amen' },
        ),
      });
      return !currentlyLiked;
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to update your reaction.');
      return currentlyLiked;
    }
  };

  const handleSaveReel = async (reel: ReelWithViewerState, currentlySaved: boolean) => {
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: '/reels' } } as any);
      return currentlySaved;
    }
    const contentId = reel.content_items?.id;
    if (!contentId) return currentlySaved;
    try {
      setActionError('');
      const result = await api.request<{ bookmarked: boolean }>('engagement', {
        method: 'POST',
        context: expressionId ? 'current' : 'public',
        body: JSON.stringify({ action: 'bookmark', contentId }),
      });
      return result.bookmarked;
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to update this bookmark.');
      return currentlySaved;
    }
  };

  const handleShareReel = (reel: ReelWithViewerState) => {
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: '/reels' } } as any);
      return;
    }
    setActionError('');
    setShareTarget(reel);
  };

  const shareReelToGeneral = async () => {
    if (!shareTarget || !canShareToGeneral) return;
    const isPublic = shareTarget.content_items?.visibility === 'public';
    if (!isPublic) {
      setActionError('This Reel belongs to a private Expression and cannot be shared to General Community.');
      setShareTarget(null);
      return;
    }
    setShareBusy(true);
    setActionError('');
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'share_reel', reelId: shareTarget.id }),
      });
      setShareTarget(null);
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to share this Reel to General Community.');
    } finally {
      setShareBusy(false);
    }
  };

  const shareReelExternally = async () => {
    if (!shareTarget) return;
    const isPublic = shareTarget.content_items?.visibility === 'public';
    if (!isPublic) {
      setActionError('This Reel belongs to a private Expression and cannot be shared outside it.');
      setShareTarget(null);
      return;
    }
    try {
      await Share.share({
        message: `Watch this Reel on City of Transformation: ${shareTarget.caption || 'Church video'}`,
      });
      setShareTarget(null);
    } catch {
      // Dismissing the native share sheet does not change Reel state.
    }
  };

  const expressionName = context?.expression?.name;

  return (
    <View style={styles.screen}>
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close Reels" style={styles.closeBtnInner}>
          <Icon name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {actionError ? (
        <Pressable
          onPress={() => setActionError('')}
          style={[styles.errorToast, { top: insets.top + 58 }]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Reel error"
        >
          <Icon name="alert-circle-outline" size={15} color="#FFFFFF" />
          <Text style={styles.errorToastText} numberOfLines={2}>{actionError}</Text>
          <Icon name="close" size={14} color="rgba(255,255,255,0.86)" />
        </Pressable>
      ) : null}

      {reelsResource.loading && !reels.length ? (
        <Skeleton height={windowHeight} />
      ) : reelsResource.error && !reels.length ? (
        <View style={styles.centerWrapper}><ResourceError message={reelsResource.error} retry={reelsResource.refresh} /></View>
      ) : reels.length === 0 ? (
        <View style={styles.centerWrapper}><ResourceError message="No Reels Yet" retry={reelsResource.refresh} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          getItemLayout={(_, index) => ({ length: windowHeight, offset: windowHeight * index, index })}
          showsVerticalScrollIndicator={false}
          snapToInterval={windowHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={reelsResource.loading} onRefresh={reelsResource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item, index }) => (
            <ReelPlayer
              reel={item}
              expressionName={expressionName}
              isActive={index === activeIndex}
              initialLiked={Boolean(item.viewerReaction)}
              initialSaved={item.viewerBookmarked === true}
              onLike={(currentlyLiked) => handleLikeReel(item, currentlyLiked)}
              onSave={(currentlySaved) => handleSaveReel(item, currentlySaved)}
              onOpenComments={() => handleOpenComments(item)}
              onShare={() => handleShareReel(item)}
            />
          )}
        />
      )}

      <BottomSheet
        visible={!!shareTarget}
        onClose={() => { if (!shareBusy) setShareTarget(null); }}
        title="Share Reel"
        subtitle={shareTarget?.caption || 'Choose where to share this Reel.'}
      >
        <View style={styles.shareSheet}>
          {shareTarget?.content_items?.visibility === 'public' ? (
            <>
              {canShareToGeneral ? (
                <Button
                  label="Share to General Community"
                  onPress={() => void shareReelToGeneral()}
                  loading={shareBusy}
                  variant="primary"
                  size="lg"
                  fullWidth
                />
              ) : (
                <Text style={styles.shareHint}>Join an active Expression before sharing a Reel into General Community.</Text>
              )}
              <Button
                label="Share externally"
                onPress={() => void shareReelExternally()}
                disabled={shareBusy}
                variant="outline"
                size="lg"
                fullWidth
              />
            </>
          ) : (
            <View style={styles.privateShareNotice}>
              <Icon name="lock-closed-outline" size={20} color="#FFFFFF" />
              <Text style={styles.privateShareText}>This Reel is private to its Expression and cannot be shared outside that space.</Text>
            </View>
          )}
        </View>
      </BottomSheet>

      <CommentSheet
        visible={!!activeReelForComments}
        onClose={() => setActiveReelForComments(null)}
        comments={comments}
        onSubmitComment={handleSendComment}
        loading={commentLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  closeButton: { position: 'absolute', right: 16, zIndex: 10 },
  closeBtnInner: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  errorToast: { position: 'absolute', left: 16, right: 68, zIndex: 20, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, backgroundColor: 'rgba(180,35,24,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  errorToastText: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  centerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  shareSheet: { gap: 12 },
  shareHint: { fontSize: 12, lineHeight: 18, color: '#9AA8B8', textAlign: 'center' },
  privateShareNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  privateShareText: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 18, fontWeight: '600' },
});

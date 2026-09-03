import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, RefreshControl, StyleSheet, View, ViewToken } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { CommentSheet, Icon, ReelPlayer, ResourceError, Skeleton } from '@/components';
import type { ContentComment, Reel } from '@/types/content';

const { height: windowHeight } = Dimensions.get('window');
const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

type PlaybackInfo = {
  available: boolean;
  renditions?: { kind?: string; playbackUrl?: string; storagePath?: string }[];
};

export default function FullScreenReelsScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeReelForComments, setActiveReelForComments] = useState<Reel | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);

  const reelsResource = useResource<Reel[]>('reels:immersive', async (signal) => {
    const reels = await api.request<Reel[]>(`public-content?type=reels${organization ? `&organizationId=${organization}` : ''}`, { signal });
    return Promise.all(reels.map(async (reel) => {
      try {
        const playback = await api.request<PlaybackInfo>(`content-media?action=playback&contentId=${encodeURIComponent(reel.id)}`, { signal });
        const playbackUrl = playback.renditions?.find((rendition) => rendition.kind === 'video_stream')?.playbackUrl;
        if (!playbackUrl) return reel;
        const currentRenditions = reel.media_assets?.renditions ?? [];
        return {
          ...reel,
          media_assets: {
            ...(reel.media_assets ?? {}),
            url: playbackUrl,
            renditions: currentRenditions.map((rendition) => rendition.rendition_kind === 'video_stream'
              ? { ...rendition, storage_path: playbackUrl }
              : rendition),
          },
        } as Reel;
      } catch {
        return reel;
      }
    }));
  });

  const reels = reelsResource.data ?? [];
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) setActiveIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const handleOpenComments = async (reel: Reel) => {
    setActiveReelForComments(reel);
    setCommentLoading(true);
    try {
      const res = await api.request<ContentComment[]>(`engagement?contentId=${reel.id}`);
      setComments(res ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSendComment = async (body: string, parentCommentId?: string | null) => {
    if (!activeReelForComments) return;
    try {
      const res = await api.request<ContentComment>('engagement', {
        method: 'POST',
        body: JSON.stringify({ action: 'comment', contentId: activeReelForComments.id, body, parentCommentId }),
      });
      if (res) setComments((prev) => [...prev, res]);
    } catch {
      // Comment errors remain local to the comment sheet.
    }
  };

  const handleLikeReel = async (reelId: string) => {
    if (mode === 'visitor') return;
    try {
      await api.request('engagement', { method: 'POST', body: JSON.stringify({ action: 'react', contentId: reelId, reaction: 'amen' }) });
    } catch {
      // Optimistic state is handled by ReelPlayer.
    }
  };

  const handleSaveReel = async (reelId: string) => {
    if (mode === 'visitor') return;
    try {
      await api.request('engagement', { method: 'POST', body: JSON.stringify({ action: 'bookmark', contentId: reelId }) });
    } catch {
      // Optimistic state is handled by ReelPlayer.
    }
  };

  const expressionName = context?.expression?.name || context?.organizations?.[0]?.name;

  return (
    <View style={styles.screen}>
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close Reels" style={[styles.closeBtnInner, { backgroundColor: colors.cardElevated }]}>
          <Icon name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {reelsResource.loading && !reels.length ? (
        <Skeleton height={windowHeight} />
      ) : reelsResource.error && !reels.length ? (
        <View style={styles.centerWrapper}><ResourceError message={reelsResource.error} retry={reelsResource.refresh} /></View>
      ) : reels.length === 0 ? (
        <View style={styles.centerWrapper}><ResourceError message="No Short Clips Yet" retry={reelsResource.refresh} /></View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={windowHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={reelsResource.loading} onRefresh={reelsResource.refresh} tintColor="#2F6FED" />}
          renderItem={({ item, index }) => (
            <ReelPlayer
              reel={item}
              expressionName={expressionName}
              isActive={index === activeIndex}
              onLike={() => handleLikeReel(item.id)}
              onSave={() => handleSaveReel(item.id)}
              onOpenComments={() => handleOpenComments(item)}
            />
          )}
        />
      )}

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
  screen: { flex: 1, backgroundColor: '#061426' },
  closeButton: { position: 'absolute', right: 16, zIndex: 10 },
  closeBtnInner: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  centerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
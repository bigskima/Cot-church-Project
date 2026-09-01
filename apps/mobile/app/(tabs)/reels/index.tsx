import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  CommentSheet,
  EmptyState,
  ReelPlayer,
  ResourceError,
  Skeleton,
} from '@/components';
import type { ContentComment, Reel } from '@/types/content';

const { height: screenHeight } = Dimensions.get('window');
const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function ReelsScreen() {
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeReelForComments, setActiveReelForComments] = useState<Reel | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);

  const reelsResource = useResource<Reel[]>('reels:feed', (signal) =>
    api.request<Reel[]>(
      `public-content?type=reels${organization ? `&organizationId=${organization}` : ''}`,
      { signal }
    )
  );

  const reels = reelsResource.data ?? [];

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
  }).current;

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
        body: JSON.stringify({
          action: 'comment',
          contentId: activeReelForComments.id,
          body,
          parentCommentId,
        }),
      });
      if (res) {
        setComments((prev) => [...prev, res]);
      }
    } catch {
      // Ignored
    }
  };

  const handleLikeReel = async (reelId: string) => {
    if (mode === 'visitor') return;
    try {
      await api.request('engagement', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', contentId: reelId, reaction: 'amen' }),
      });
    } catch {
      // Ignored
    }
  };

  const handleSaveReel = async (reelId: string) => {
    if (mode === 'visitor') return;
    try {
      await api.request('engagement', {
        method: 'POST',
        body: JSON.stringify({ action: 'bookmark', contentId: reelId }),
      });
    } catch {
      // Ignored
    }
  };

  const expressionName = context?.expression?.name || context?.organizations?.[0]?.name;

  return (
    <View style={styles.screen}>
      {reelsResource.loading ? (
        <View style={styles.loadingContainer}>
          <Skeleton height={screenHeight - 120} />
        </View>
      ) : reelsResource.error && !reelsResource.data ? (
        <View style={styles.centerWrapper}>
          <ResourceError
            message={reelsResource.error}
            retry={reelsResource.refresh}
          />
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.centerWrapper}>
          <EmptyState
            title="No Short Clips Yet"
            message="Highlights and sermon clips will appear here as soon as published."
            iconName="film-outline"
          />
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={screenHeight - 80}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={
            <RefreshControl
              refreshing={reelsResource.loading}
              onRefresh={reelsResource.refresh}
              tintColor="#2F6FED"
            />
          }
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

      {/* Fellowship Comments Sheet */}
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
  screen: {
    flex: 1,
    backgroundColor: '#061426',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});

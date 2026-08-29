import React, { useState } from 'react';
import { Dimensions, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { CommentSheet, EmptyState, ReelPlayer, ResourceError, Skeleton } from '@/components';
import { palette, spacing } from '@/design-system/tokens';
import type { ContentComment, Reel } from '@/types/content';

const { height: screenHeight } = Dimensions.get('window');
const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function ReelsScreen() {
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();

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
        setComments([...comments, res]);
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
        body: JSON.stringify({ action: 'react', contentId: reelId, reaction: 'love' }),
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

  return (
    <View style={[styles.screen, { backgroundColor: '#0D0805' }] as any}>
      {reelsResource.loading ? (
        <View style={styles.loadingContainer as any}>
          <Skeleton height={screenHeight - 140} dark />
        </View>
      ) : reelsResource.error && !reelsResource.data ? (
        <View style={styles.centerWrapper as any}>
          <ResourceError
            offline={reelsResource.offline}
            message={reelsResource.error}
            retry={reelsResource.refresh}
            dark
          />
        </View>
      ) : reels.length > 0 ? (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          snapToInterval={screenHeight - 120}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ReelPlayer
              reel={item}
              expressionName="Sanctuary Expression"
              onLike={() => handleLikeReel(item.id)}
              onOpenComments={() => handleOpenComments(item)}
              onSave={() => handleSaveReel(item.id)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={reelsResource.loading}
              onRefresh={reelsResource.refresh}
              tintColor={palette.gold}
            />
          }
        />
      ) : (
        <View style={styles.centerWrapper as any}>
          <EmptyState
            title="No Reels Published Yet"
            message="Inspiring short-form messages and worship highlights will appear here."
            icon="🎬"
            dark
          />
        </View>
      )}

      {/* Threaded Comments Sheet */}
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

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    padding: spacing.md,
    justifyContent: 'center',
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});

import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Chip,
  CommentSheet,
  EmptyState,
  Icon,
  PostCard,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import type { ContentComment, SocialPost } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;
type Scope = 'all' | 'expression';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const [scope, setScope] = useState<Scope>('all');
  const [activePostForComments, setActivePostForComments] = useState<SocialPost | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);

  const feed = useResource<SocialPost[]>(`feed:${scope}`, (signal) =>
    mode === 'visitor'
      ? api.request<SocialPost[]>(
          `public-content?type=feed${organization ? `&organizationId=${organization}` : ''}`,
          { signal }
        )
      : api.request<SocialPost[]>('social-feed', { signal })
  );

  const posts =
    feed.data?.filter((post) =>
      scope === 'all' ? true : post.visibility !== 'public'
    ) ?? [];

  const handleReact = async (postId: string, reaction: string) => {
    if (mode === 'visitor') return;
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', postId, reaction }),
      });
    } catch {
      // Ignored
    }
  };

  const handleOpenComments = async (post: SocialPost) => {
    setActivePostForComments(post);
    setCommentLoading(true);
    try {
      const res = await api.request<ContentComment[]>(`engagement?contentId=${post.id}`);
      setComments(res ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSendComment = async (body: string, parentCommentId?: string | null) => {
    if (!activePostForComments) return;
    try {
      const res = await api.request<ContentComment>('engagement', {
        method: 'POST',
        body: JSON.stringify({
          action: 'comment',
          contentId: activePostForComments.id,
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={feed.loading}
            onRefresh={feed.refresh}
            tintColor={colors.interactive}
          />
        }
        ListHeaderComponent={() => (
          <View>
            <ScreenHeader
              title="Community Fellowship"
              subtitle="Testimonies, praise reports, and encouraging updates from your church family."
            />

            {/* Filter Tabs & Leadership Entry */}
            <View style={styles.filterRow}>
              <View style={styles.chipsWrap}>
                <Chip
                  label="All Updates"
                  selected={scope === 'all'}
                  onPress={() => setScope('all')}
                />
                {mode === 'authenticated' && (
                  <Chip
                    label="My Campus"
                    selected={scope === 'expression'}
                    onPress={() => setScope('expression')}
                  />
                )}
              </View>

              <Pressable
                onPress={() => router.push('/(tabs)/community/leadership')}
                style={({ pressed }) => [
                  styles.leadershipBtn,
                  { backgroundColor: colors.bgSecondary, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="people-outline" size={14} color={colors.interactive} />
                <Text style={[styles.leadershipBtnText, { color: colors.text }]}>Leaders</Text>
              </Pressable>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onReact={(r) => handleReact(item.id, r)}
            onComment={() => handleOpenComments(item)}
          />
        )}
        ListEmptyComponent={() => (
          feed.loading ? (
            <View style={styles.loadingPad}>
              <Skeleton height={140} count={3} />
            </View>
          ) : feed.error && !feed.data ? (
            <View style={styles.loadingPad}>
              <ResourceError message={feed.error} retry={feed.refresh} />
            </View>
          ) : (
            <View style={styles.loadingPad}>
              <EmptyState
                title="No Community Posts Yet"
                message="Be the first to share a testimony or encouragement with your spiritual family."
                iconName="chatbubbles-outline"
              />
            </View>
          )
        )}
      />

      {/* Fellowship Comments Sheet */}
      <CommentSheet
        visible={!!activePostForComments}
        onClose={() => setActivePostForComments(null)}
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leadershipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 4,
  },
  leadershipBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingPad: {
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
});

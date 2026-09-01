import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Avatar,
  BottomSheet,
  CommentSheet,
  EmptyState,
  Icon,
  PostCard,
  ReactionDrawer,
  ResourceError,
  Skeleton,
} from '@/components';
import { radius, spacing, typography } from '@/design-system/tokens';
import type { SocialPost } from '@/types/content';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'for_you' | 'campus'>('for_you');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);

  // Engagement Sheets
  const [commentTargetPostId, setCommentTargetPostId] = useState<string | null>(null);
  const [reactionTargetPostId, setReactionTargetPostId] = useState<string | null>(null);

  const orgParam =
    mode === 'visitor'
      ? `?organizationId=${process.env.EXPO_PUBLIC_ORGANIZATION_ID || ''}`
      : context?.expression?.id
      ? `?expressionId=${context.expression.id}`
      : '';

  const resource = useResource<SocialPost[]>('mobile:community:timeline', (signal) => {
    if (mode === 'visitor') {
      return api.request<SocialPost[]>(`public-content?type=posts${orgParam ? `&${orgParam.slice(1)}` : ''}`, { signal });
    }
    return api.request<SocialPost[]>(`social-feed${orgParam}`, { signal });
  });

  const handleCreatePost = async () => {
    if (!postText.trim() || mode === 'visitor') return;
    setPosting(true);
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({
          body: postText.trim(),
          visibility: 'public',
        }),
      });
      setPostText('');
      setComposerOpen(false);
      resource.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to share post.');
    } finally {
      setPosting(false);
    }
  };

  const posts = resource.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {/* Top Twitter / Threads Style Header */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.bg,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Community</Text>

        <Pressable
          onPress={() => router.push('/(tabs)/community/leadership')}
          hitSlop={8}
          style={[styles.headerIconBtn, { backgroundColor: colors.bgSecondary }]}
        >
          <Icon name="people-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Tabs (Twitter 'For You' / 'Campus') */}
      <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable
          onPress={() => setActiveTab('for_you')}
          style={[styles.tabItem, activeTab === 'for_you' && { borderBottomColor: colors.interactive }]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'for_you' ? colors.text : colors.textMuted },
              activeTab === 'for_you' && styles.tabTextActive,
            ]}
          >
            For you
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('campus')}
          style={[styles.tabItem, activeTab === 'campus' && { borderBottomColor: colors.interactive }]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'campus' ? colors.text : colors.textMuted },
              activeTab === 'campus' && styles.tabTextActive,
            ]}
          >
            {context?.expression?.name || 'Local Campus'}
          </Text>
        </Pressable>
      </View>

      {/* Twitter-Style Quick Composer Strip */}
      {mode !== 'visitor' ? (
        <Pressable
          onPress={() => setComposerOpen(true)}
          style={[styles.composerStrip, { borderBottomColor: colors.borderSubtle }]}
        >
          <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'Me'} size="sm" />
          <Text style={[styles.composerPlaceholder, { color: colors.textMuted }]}>
            Share a testimony, scripture, or thought...
          </Text>
          <Icon name="image-outline" size={20} color={colors.interactive} />
        </Pressable>
      ) : null}

      {/* Timeline Stream */}
      {resource.loading && !resource.data ? (
        <View style={styles.loadingContainer}>
          <Skeleton height={100} count={4} />
        </View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={resource.loading}
              onRefresh={resource.refresh}
              tintColor={colors.interactive}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              authorName={item.content_items?.author_profile_id ? 'Pastor / Leader' : 'Church Member'}
              expressionName={context?.expression?.name}
              onReply={() => setCommentTargetPostId(item.id)}
              onReact={() => setReactionTargetPostId(item.id)}
              onShare={() => {}}
            />
          )}
        />
      ) : (
        <EmptyState
          title="No Community Posts Yet"
          message="Be the first to share an encouraging word or testimony with your fellowship."
          iconName="chatbubbles-outline"
        />
      )}

      {/* Twitter Compose Bottom Sheet */}
      <BottomSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Share with Community"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.composerBody}
        >
          <View style={styles.composerRow}>
            <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'Me'} size="md" />
            <TextInput
              value={postText}
              onChangeText={setPostText}
              placeholder="What is the Lord doing in your life?"
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              style={[styles.composerInput, { color: colors.text }]}
            />
          </View>

          <View style={[styles.composerFooter, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.attachmentRow}>
              <Pressable hitSlop={8}>
                <Icon name="image-outline" size={22} color={colors.interactive} />
              </Pressable>
              <Pressable hitSlop={8}>
                <Icon name="book-outline" size={22} color={colors.interactive} />
              </Pressable>
            </View>

            <Pressable
              onPress={handleCreatePost}
              disabled={!postText.trim() || posting}
              style={({ pressed }) => [
                styles.postPillBtn,
                {
                  backgroundColor: colors.interactive,
                  opacity: !postText.trim() || posting ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.postPillText}>{posting ? 'Posting...' : 'Post'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* Comment Sheet */}
      {commentTargetPostId ? (
        <CommentSheet
          visible={!!commentTargetPostId}
          onClose={() => setCommentTargetPostId(null)}
          comments={[]}
          onSubmitComment={async (body) => {
            try {
              await api.request('comments', {
                method: 'POST',
                body: JSON.stringify({
                  targetId: commentTargetPostId,
                  targetType: 'post',
                  body,
                }),
              });
              setCommentTargetPostId(null);
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Unable to add comment');
            }
          }}
        />
      ) : null}

      {/* Reaction Drawer */}
      {reactionTargetPostId ? (
        <ReactionDrawer
          onReact={(reactionKey) => {
            setReactionTargetPostId(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '800',
  },
  composerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  composerPlaceholder: {
    flex: 1,
    fontSize: 15,
  },
  loadingContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  composerBody: {
    gap: spacing.md,
  },
  composerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  composerInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  postPillBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  postPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

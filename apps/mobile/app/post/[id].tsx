import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentsThread, PostCard, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import type { ContentComment, SocialPost } from '@/types/content';

type FeedScope = 'general' | 'expression';
type PublicBadge = { id?: string; code?: string; label: string; backgroundColor: string; textColor: string; priority?: number };
type CommunityPost = SocialPost & {
  author?: { id: string; displayName?: string; username?: string; avatarUrl?: string | null; bio?: string | null; badges?: PublicBadge[] } | null;
  expression?: { id: string; name: string; code?: string } | null;
  likes_count?: number;
  comments_count?: number;
  viewer_reaction?: string | null;
  viewer_bookmarked?: boolean;
};

export default function CommunityPostScreen() {
  const { id, scope: requestedScope, focus } = useLocalSearchParams<{ id: string; scope?: string; focus?: string }>();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const scope: FeedScope = requestedScope === 'expression' ? 'expression' : 'general';
  const expressionMode = scope === 'expression';
  const requestContext = expressionMode ? 'current' : 'public';
  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';
  const [commentFocus, setCommentFocus] = useState(focus === 'comments' ? 1 : 0);

  const post = useResource<CommunityPost>(
    `community:post:${scope}:${expressionMode ? context?.expression?.id ?? 'none' : organizationId || 'auto'}:${id}`,
    async (signal) => {
      if (!id) throw new Error('This post is unavailable.');
      if (expressionMode) {
        if (mode !== 'authenticated' || !context?.expression?.id) {
          throw new Error('Enter this Expression to view its post.');
        }
        return api.request<CommunityPost>(
          `social-feed?scope=expression&view=post&postId=${encodeURIComponent(id)}`,
          { signal, context: 'current' },
        );
      }
      const params = new URLSearchParams({ scope: 'church', postId: id });
      if (organizationId) params.set('organizationId', organizationId);
      return api.request<CommunityPost>(
        `public-social-feed?${params.toString()}`,
        { signal, context: 'public' },
      );
    },
  );

  const comments = useResource<ContentComment[]>(
    `community:post-comments:${scope}:${expressionMode ? context?.expression?.id ?? 'none' : 'public'}:${id}`,
    async (signal) => {
      if (!id) return [];
      if (expressionMode && (mode !== 'authenticated' || !context?.expression?.id)) return [];
      return api.request<ContentComment[]>(
        `engagement?contentId=${encodeURIComponent(id)}`,
        { signal, context: requestContext },
      );
    },
  );

  const openLogin = () => router.push({
    pathname: '/(auth)/login',
    params: { returnTo: `/post/${id}?scope=${scope}&focus=comments` },
  } as any);

  const reactToPost = async (reaction: string | null) => {
    if (mode !== 'authenticated') {
      openLogin();
      return false;
    }
    await api.request('engagement', {
      method: 'POST',
      context: requestContext,
      body: JSON.stringify(
        reaction
          ? { action: 'react', contentId: id, reaction }
          : { action: 'unreact', contentId: id },
      ),
    });
    post.refresh();
    return true;
  };

  const bookmarkPost = async (currentlySaved: boolean) => {
    if (mode !== 'authenticated') {
      openLogin();
      return false;
    }
    const result = await api.request<{ bookmarked: boolean }>('engagement', {
      method: 'POST',
      context: requestContext,
      body: JSON.stringify({ action: 'bookmark', contentId: id }),
    });
    post.refresh();
    return result.bookmarked === !currentlySaved;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title={expressionMode ? context?.expression?.name || 'Expression post' : 'Post'}
          showBack
        />
      </View>

      {post.loading && !post.data ? (
        <View style={styles.loading}>
          <Skeleton height={210} borderRadius={radius.xl} />
          <Skeleton height={120} count={3} />
        </View>
      ) : post.error && !post.data ? (
        <ResourceError message={post.error} retry={post.refresh} />
      ) : post.data ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xxl },
            ]}
          >
            <PostCard
              post={post.data}
              expressionName={post.data.expression?.name}
              canEngage={mode === 'authenticated'}
              allowExternalShare={post.data.visibility === 'public'}
              onReply={() => setCommentFocus((value) => value + 1)}
              onReact={reactToPost}
              onBookmark={bookmarkPost}
              style={styles.postCard}
            />

            {comments.error && !comments.data ? (
              <ResourceError message={comments.error} retry={comments.refresh} />
            ) : (
              <View style={styles.comments}>
                <CommentsThread
                  comments={comments.data ?? []}
                  loading={comments.loading}
                  canComment={mode === 'authenticated'}
                  focusRequest={commentFocus}
                  onRequireSignIn={openLogin}
                  onSubmitComment={async (body, parentCommentId) => {
                    if (mode !== 'authenticated') {
                      openLogin();
                      return;
                    }
                    await api.request('engagement', {
                      method: 'POST',
                      context: requestContext,
                      body: JSON.stringify({
                        action: 'comment',
                        contentId: id,
                        body,
                        parentCommentId: parentCommentId ?? undefined,
                      }),
                    });
                    comments.refresh();
                    post.refresh();
                  }}
                />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: spacing.xs },
  loading: { padding: spacing.md, gap: spacing.md },
  postCard: { marginTop: spacing.xs },
  comments: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});

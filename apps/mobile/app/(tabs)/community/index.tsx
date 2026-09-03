import React, { useEffect, useState } from 'react';
import {
  Alert,
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
  BrandMark,
  CommentSheet,
  EmptyState,
  Icon,
  PostCard,
  ResourceError,
  Skeleton,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import type { ContentComment, SocialPost } from '@/types/content';

type FeedScope = 'church' | 'expression';
type PublicBadge = { id?: string; code?: string; label: string; backgroundColor: string; textColor: string; priority?: number };
type CommunityPost = SocialPost & {
  author?: { id: string; displayName?: string; username?: string; avatarUrl?: string | null; bio?: string | null; badges?: PublicBadge[] } | null;
  expression?: { id: string; name: string; code?: string } | null;
};
type CommunityComment = ContentComment & {
  author?: { id: string; displayName?: string; username?: string; avatarUrl?: string | null; badges?: PublicBadge[] } | null;
};

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  const [activeTab, setActiveTab] = useState<FeedScope>('church');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [postDestination, setPostDestination] = useState<FeedScope>('church');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [commentTargetPostId, setCommentTargetPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    if (!expression?.id && activeTab === 'expression') setActiveTab('church');
  }, [activeTab, expression?.id]);

  const feedKey = `mobile:community:${mode}:${activeTab}:${organizationId}:${expression?.id ?? 'none'}`;
  const resource = useResource<CommunityPost[]>(feedKey, (signal) => {
    if (mode === 'visitor') {
      const query = new URLSearchParams({ scope: 'church', organizationId });
      return api.request<CommunityPost[]>(`public-social-feed?${query.toString()}`, { signal });
    }
    return api.request<CommunityPost[]>(`social-feed?scope=${activeTab}`, { signal });
  });

  const canPost = mode === 'authenticated' && Boolean(expression?.id);
  const canEngage = mode === 'authenticated';

  const openComposer = () => {
    if (!canPost) return;
    setPostError('');
    setPostDestination(activeTab === 'expression' ? 'expression' : 'church');
    setComposerOpen(true);
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || !canPost) return;
    if (postDestination === 'expression' && !expression?.id) {
      setPostError('Select or join an Expression before posting to an Expression feed.');
      return;
    }
    setPosting(true);
    setPostError('');
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({
          body: postText.trim(),
          visibility: 'public',
          branchId: postDestination === 'expression' ? expression!.id : undefined,
        }),
      });
      setPostText('');
      setComposerOpen(false);
      setActiveTab(postDestination);
      resource.refresh();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to share post.');
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    if (!commentTargetPostId || mode !== 'authenticated') {
      setComments([]);
      return;
    }
    let active = true;
    setCommentsLoading(true);
    api.request<CommunityComment[]>(`social-feed?postId=${encodeURIComponent(commentTargetPostId)}`)
      .then((items) => { if (active) setComments(items); })
      .catch((error) => {
        if (active) Alert.alert('Comments unavailable', error instanceof Error ? error.message : 'Unable to load comments.');
      })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [api, commentTargetPostId, mode]);

  const submitComment = async (body: string, parentCommentId?: string | null) => {
    if (!commentTargetPostId) return;
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'comment', postId: commentTargetPostId, body, parentCommentId: parentCommentId ?? undefined }),
      });
      const refreshed = await api.request<CommunityComment[]>(`social-feed?postId=${encodeURIComponent(commentTargetPostId)}`);
      setComments(refreshed);
    } catch (error) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Unable to add comment.');
      throw error;
    }
  };

  const reactToPost = async (postId: string, reaction: string) => {
    if (!canEngage) return;
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', postId, reaction }),
      });
    } catch (error) {
      Alert.alert('Reaction not saved', error instanceof Error ? error.message : 'Unable to save reaction.');
    }
  };

  const posts = resource.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.xs, backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerIdentity}>
          <BrandMark variant="compact" size={30} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Community</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Church conversations and fellowship</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/community/leadership')} hitSlop={8} style={[styles.headerIconBtn, { backgroundColor: colors.bgSecondary }]}>
          <Icon name="people-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable onPress={() => setActiveTab('church')} style={[styles.tabItem, activeTab === 'church' && { borderBottomColor: colors.interactive }]}>
          <Text style={[styles.tabText, { color: activeTab === 'church' ? colors.text : colors.textMuted }, activeTab === 'church' && styles.tabTextActive]}>Church-wide</Text>
        </Pressable>
        {expression?.id ? (
          <Pressable onPress={() => setActiveTab('expression')} style={[styles.tabItem, activeTab === 'expression' && { borderBottomColor: colors.interactive }]}>
            <Text style={[styles.tabText, { color: activeTab === 'expression' ? colors.text : colors.textMuted }, activeTab === 'expression' && styles.tabTextActive]} numberOfLines={1}>{expression.name}</Text>
          </Pressable>
        ) : null}
      </View>

      {canPost ? (
        <Pressable onPress={openComposer} style={[styles.composerStrip, { borderBottomColor: colors.borderSubtle }]}>
          <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'Me'} size="sm" />
          <Text style={[styles.composerPlaceholder, { color: colors.textMuted }]}>Share a testimony, scripture, or thought...</Text>
          <Icon name="create-outline" size={20} color={colors.interactive} />
        </Pressable>
      ) : mode === 'authenticated' ? (
        <View style={[styles.membershipNotice, { backgroundColor: colors.primarySoft, borderBottomColor: colors.borderSubtle }]}>
          <Icon name="people-outline" size={17} color={colors.interactive} />
          <Text style={[styles.membershipNoticeText, { color: colors.textSecondary }]}>Join an Expression to post. You can still read church-wide public conversations.</Text>
        </View>
      ) : null}

      {resource.loading && !resource.data ? (
        <View style={styles.loadingContainer}><Skeleton height={100} count={4} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              expressionName={item.expression?.name}
              canEngage={canEngage}
              onReply={canEngage ? () => setCommentTargetPostId(item.id) : undefined}
              onReact={canEngage ? (reaction) => void reactToPost(item.id, reaction) : undefined}
            />
          )}
        />
      ) : (
        <EmptyState
          title={activeTab === 'expression' ? 'No Expression Posts Yet' : 'No Church-wide Posts Yet'}
          message={canPost ? 'Share the first encouraging word or testimony in this feed.' : 'Published community posts will appear here.'}
          iconName="chatbubbles-outline"
        />
      )}

      <BottomSheet visible={composerOpen} onClose={() => !posting && setComposerOpen(false)} title="Create Post">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.composerBody}>
          <View style={styles.destinationBlock}>
            <Text style={[styles.destinationLabel, { color: colors.textSecondary }]}>POST TO</Text>
            <View style={styles.destinationRow}>
              <Pressable
                onPress={() => setPostDestination('church')}
                style={[styles.destinationPill, { borderColor: postDestination === 'church' ? colors.interactive : colors.border, backgroundColor: postDestination === 'church' ? colors.primarySoft : colors.bgSecondary }]}
              >
                <Icon name="globe-outline" size={15} color={postDestination === 'church' ? colors.interactive : colors.textSecondary} />
                <Text style={[styles.destinationText, { color: postDestination === 'church' ? colors.interactive : colors.textSecondary }]}>Church-wide</Text>
              </Pressable>
              {expression?.id ? (
                <Pressable
                  onPress={() => setPostDestination('expression')}
                  style={[styles.destinationPill, { borderColor: postDestination === 'expression' ? colors.interactive : colors.border, backgroundColor: postDestination === 'expression' ? colors.primarySoft : colors.bgSecondary }]}
                >
                  <Icon name="people-outline" size={15} color={postDestination === 'expression' ? colors.interactive : colors.textSecondary} />
                  <Text style={[styles.destinationText, { color: postDestination === 'expression' ? colors.interactive : colors.textSecondary }]} numberOfLines={1}>{expression.name}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.destinationHelp, { color: colors.textMuted }]}>Church-wide posts appear in the general church feed. Expression posts are attached to your current Expression.</Text>
          </View>

          {postError ? <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}><Icon name="alert-circle" size={17} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{postError}</Text></View> : null}

          <View style={styles.composerRow}>
            <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'Me'} size="md" />
            <TextInput
              value={postText}
              onChangeText={setPostText}
              placeholder="What would you like to share?"
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              maxLength={10000}
              style={[styles.composerInput, { color: colors.text }]}
            />
          </View>

          <View style={[styles.composerFooter, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[styles.characterCount, { color: colors.textMuted }]}>{postText.length.toLocaleString()} / 10,000</Text>
            <Pressable
              onPress={handleCreatePost}
              disabled={!postText.trim() || posting}
              style={({ pressed }) => [styles.postPillBtn, { backgroundColor: colors.interactive, opacity: !postText.trim() || posting ? 0.5 : pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.postPillText}>{posting ? 'Posting...' : 'Post'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {commentTargetPostId ? (
        <CommentSheet
          visible
          onClose={() => setCommentTargetPostId(null)}
          comments={comments}
          loading={commentsLoading}
          onSubmitComment={submitComment}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 10, marginTop: 1 },
  headerIconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabTextActive: { fontWeight: '800' },
  composerStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, gap: spacing.md },
  composerPlaceholder: { flex: 1, fontSize: 14 },
  membershipNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  membershipNoticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  composerBody: { gap: spacing.md },
  destinationBlock: { gap: spacing.xs },
  destinationLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  destinationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  destinationPill: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  destinationText: { fontSize: 12, fontWeight: '700', maxWidth: 180 },
  destinationHelp: { fontSize: 11, lineHeight: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
  composerRow: { flexDirection: 'row', gap: spacing.md },
  composerInput: { flex: 1, fontSize: 16, minHeight: 120, textAlignVertical: 'top' },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1 },
  characterCount: { fontSize: 11 },
  postPillBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: radius.pill },
  postPillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

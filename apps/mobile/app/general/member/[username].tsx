import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  EmptyState,
  Icon,
  ResourceError,
  Skeleton,
  SocialProfileHero,
} from '@/components';
import { PostCard } from '@/components/community/PostCard';
import type { PublicIdentityBadge } from '@/components/identity/PublicIdentityBadge';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type PublicProfilePayload = {
  profile: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
    banner_url?: string | null;
    bio?: string | null;
    created_at?: string;
    badges?: PublicIdentityBadge[];
  };
  counts: {
    followers: number;
    following: number;
  };
  viewer: {
    isSelf: boolean;
    isFollowing: boolean;
    canMessage: boolean;
  };
  posts?: any[];
};

export default function PublicMemberProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const handle = typeof username === 'string' ? username.trim().replace(/^@/, '').toLowerCase() : '';
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, mode } = useSession();
  const [followBusy, setFollowBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [actionError, setActionError] = useState('');

  const resource = useResource<PublicProfilePayload>(
    `public-profile:${handle || 'none'}:${mode}`,
    (signal) => handle
      ? api.request<PublicProfilePayload>(
          `public-profile?username=${encodeURIComponent(handle)}`,
          { signal, context: 'public' },
        )
      : Promise.reject(new Error('Profile username is missing.')),
  );

  const profile = resource.data?.profile;
  const viewer = resource.data?.viewer;

  useEffect(() => {
    setFollowing(Boolean(viewer?.isFollowing));
  }, [viewer?.isFollowing, profile?.id]);

  const openLogin = () => {
    router.push({
      pathname: '/(auth)/login',
      params: { returnTo: handle ? `/general/member/${handle}` : '/general' },
    } as any);
  };

  const toggleFollow = async () => {
    if (!profile) return;
    if (mode !== 'authenticated') {
      openLogin();
      return;
    }
    if (viewer?.isSelf || followBusy) return;

    setFollowBusy(true);
    setActionError('');
    const next = !following;
    setFollowing(next);
    try {
      const result = await api.request<{ following: boolean }>('follows', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: next ? 'follow' : 'unfollow',
          targetProfileId: profile.id,
        }),
      });
      setFollowing(result.following);
      invalidate('public-profile:');
      invalidate('mobile:home-feed:');
      resource.refresh();
    } catch (value) {
      setFollowing(!next);
      setActionError(value instanceof Error ? value.message : 'Unable to update this follow.');
    } finally {
      setFollowBusy(false);
    }
  };

  const message = () => {
    if (!profile?.username) return;
    if (mode !== 'authenticated') {
      openLogin();
      return;
    }
    router.push({
      pathname: '/general/chat',
      params: { username: profile.username },
    } as any);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {resource.loading && !resource.data ? (
        <View style={[styles.loading, { paddingTop: insets.top + spacing.md }]}>
          <Skeleton height={180} borderRadius={0} />
          <Skeleton height={92} />
          <Skeleton height={160} />
        </View>
      ) : resource.error && !profile ? (
        <View style={[styles.loading, { paddingTop: insets.top + spacing.md }]}>
          <ResourceError message={resource.error} retry={resource.refresh} />
        </View>
      ) : profile ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            <SocialProfileHero
              displayName={profile.display_name || `@${profile.username}`}
              username={profile.username}
              avatarUrl={profile.avatar_url}
              bannerUrl={profile.banner_url}
              bio={profile.bio}
              badges={profile.badges ?? []}
              followers={resource.data?.counts.followers ?? 0}
              following={resource.data?.counts.following ?? 0}
              onFollowers={() => router.push({ pathname: '/general/member-connections', params: { username: profile.username, type: 'followers' } } as any)}
              onFollowing={() => router.push({ pathname: '/general/member-connections', params: { username: profile.username, type: 'following' } } as any)}
              actions={viewer?.isSelf ? (
                <Button
                  label="Edit profile"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/general/settings')}
                />
              ) : (
                <>
                  <Button
                    label={following ? 'Following' : 'Follow'}
                    variant={following ? 'outline' : 'primary'}
                    size="sm"
                    loading={followBusy}
                    onPress={() => void toggleFollow()}
                  />
                  {viewer?.canMessage !== false ? (
                    <Pressable
                      onPress={message}
                      accessibilityRole="button"
                      accessibilityLabel={`Message @${profile.username}`}
                      style={({ pressed }) => [
                        styles.iconAction,
                        { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                    </Pressable>
                  ) : null}
                </>
              )}
            />

            {actionError ? (
              <View style={[styles.error, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
                <Icon name="alert-circle-outline" size={16} color={colors.live} />
                <Text style={[styles.errorText, { color: colors.live }]}>{actionError}</Text>
              </View>
            ) : null}

            <View style={[styles.postsTab, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.postsTabLabel, { color: colors.text }]}>Posts</Text>
              <Text style={[styles.postsTabCount, { color: colors.textMuted }]}>{resource.data?.posts?.length ?? 0}</Text>
            </View>

            <View style={styles.postsSection}>
              {(resource.data?.posts ?? []).length ? (
                (resource.data?.posts ?? []).map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    authorName={profile.display_name || `@${profile.username}`}
                    authorHandle={profile.username}
                    authorAvatar={profile.avatar_url ?? null}
                    canEngage={mode === 'authenticated'}
                    onPress={() => router.push(`/general/post/${post.id}` as any)}
                    allowExternalShare
                    variant="feed"
                    showContext={false}
                  />
                ))
              ) : (
                <EmptyState
                  title="No public posts yet"
                  message={viewer?.isSelf ? 'Your published posts will appear here.' : `@${profile.username} has not published yet.`}
                  iconName="newspaper-outline"
                />
              )}
            </View>
          </ScrollView>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.floatingBack,
              { top: insets.top + 8, backgroundColor: 'rgba(5,7,11,0.72)' },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, gap: spacing.md },
  floatingBack: {
    position: 'absolute',
    left: 12,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAction: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  errorText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  postsTab: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  postsTabLabel: { fontSize: 14, fontWeight: '900' },
  postsTabCount: { fontSize: 11, fontWeight: '800' },
  postsSection: { width: '100%' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});

import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { PostCard } from '@/components/community/PostCard';
import { FullIdentityBadge, type PublicIdentityBadge } from '@/components/identity/PublicIdentityBadge';
import { radius, shadows, spacing } from '@/design-system/tokens';
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
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Profile" kicker="COT MEMBER" showBack />
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.loading}>
          <Skeleton height={150} borderRadius={radius.xl} />
          <Skeleton height={80} />
          <Skeleton height={120} />
        </View>
      ) : resource.error && !profile ? (
        <View style={styles.loading}>
          <ResourceError message={resource.error} retry={resource.refresh} />
        </View>
      ) : profile ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          <View
            style={[
              styles.identityCard,
              { backgroundColor: colors.card, borderColor: colors.borderSubtle },
              shadows.md,
            ]}
          >
            <View style={[styles.banner, { backgroundColor: colors.primarySoft }]}>
              {profile.banner_url ? (
                <Image source={{ uri: profile.banner_url }} style={styles.bannerImage} resizeMode="cover" />
              ) : (
                <View style={styles.bannerFallback}>
                  <Icon name="sparkles-outline" size={30} color={colors.interactive} />
                </View>
              )}
            </View>

            <View style={styles.identityBody}>
              <View style={styles.avatarRow}>
                <View style={[styles.avatarShell, { backgroundColor: colors.card, borderColor: colors.card }]}>
                  <Avatar
                    url={profile.avatar_url ?? undefined}
                    name={profile.display_name || profile.username}
                    size="xl"
                  />
                </View>
                <View style={styles.actions}>
                  {viewer?.isSelf ? (
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
                      <Pressable
                        onPress={message}
                        accessibilityRole="button"
                        accessibilityLabel={`Message @${profile.username}`}
                        style={({ pressed }) => [
                          styles.messageButton,
                          {
                            backgroundColor: colors.bgSecondary,
                            borderColor: colors.borderSubtle,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Icon name="chatbubble-ellipses-outline" size={17} color={colors.text} />
                        <Text style={[styles.messageButtonText, { color: colors.text }]}>Message</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              <Text style={[styles.name, { color: colors.text }]}>
                {profile.display_name || `@${profile.username}`}
              </Text>
              <Text style={[styles.username, { color: colors.textSecondary }]}>
                @{profile.username}
              </Text>

              {profile.badges?.length ? (
                <View style={styles.publicBadges}>
                  {profile.badges.map((badge) => <FullIdentityBadge key={badge.id || badge.code || badge.label} badge={badge} />)}
                </View>
              ) : null}

              {profile.bio ? (
                <Text style={[styles.bio, { color: colors.textSecondary }]}>
                  {profile.bio}
                </Text>
              ) : null}

              <View style={styles.stats}>
                <Pressable
                  onPress={() => router.push({ pathname: '/general/member-connections', params: { username: profile.username, type: 'followers' } } as any)}
                  style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${resource.data?.counts.followers ?? 0} followers`}
                >
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {(resource.data?.counts.followers ?? 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: '/general/member-connections', params: { username: profile.username, type: 'following' } } as any)}
                  style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${resource.data?.counts.following ?? 0} following`}
                >
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {(resource.data?.counts.following ?? 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
                </Pressable>
              </View>

              {actionError ? (
                <View
                  style={[
                    styles.error,
                    { backgroundColor: colors.liveSoft, borderColor: colors.live },
                  ]}
                >
                  <Icon name="alert-circle-outline" size={16} color={colors.live} />
                  <Text style={[styles.errorText, { color: colors.live }]}>{actionError}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.postsSection}>
            <SectionHeader
              title={`Published by @${profile.username}`}
              subtitle="Only this member's public General COT posts appear here."
              badge={resource.data?.posts?.length ?? 0}
            />
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
                  onPressAuthor={() => undefined}
                  allowExternalShare
                />
              ))
            ) : (
              <EmptyState
                title="No public posts yet"
                message={viewer?.isSelf ? 'Your published General COT posts will appear here.' : `@${profile.username} has not published any General COT posts yet.`}
                iconName="newspaper-outline"
              />
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, padding: spacing.lg, gap: spacing.md },
  identityCard: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  banner: { width: '100%', aspectRatio: 3 / 1, overflow: 'hidden' },
  bannerImage: { width: '100%', height: '100%' },
  bannerFallback: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', padding: spacing.lg },
  identityBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  avatarRow: {
    marginTop: -38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  avatarShell: { borderWidth: 4, borderRadius: 34, padding: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: 4 },
  messageButton: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageButtonText: { fontSize: 12, fontWeight: '800' },
  name: { fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: spacing.md },
  username: { fontSize: 13, marginTop: 1 },
  bio: { fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statNumber: { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  error: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
  postsSection: { marginTop: spacing.md, paddingHorizontal: spacing.md, gap: spacing.xs },
  pressed: { opacity: 0.84 },
});

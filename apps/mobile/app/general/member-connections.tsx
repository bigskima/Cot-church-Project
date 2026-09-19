import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type ConnectionPerson = {
  id: string;
  display_name: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  viewerFollows: boolean | null;
  isSelf: boolean;
};

type ConnectionsPayload = {
  profile: { id: string; display_name: string; username: string; avatar_url?: string | null };
  counts: { followers: number; following: number };
  view: 'followers' | 'following';
  people: ConnectionPerson[];
};

export default function MemberConnectionsScreen() {
  const params = useLocalSearchParams<{ username?: string; type?: string }>();
  const username = typeof params.username === 'string' ? params.username.trim().replace(/^@/, '').toLowerCase() : '';
  const type = params.type === 'following' ? 'following' : 'followers';
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, mode } = useSession();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const resource = useResource<ConnectionsPayload>(
    `public-profile:connections:${username || 'none'}:${type}:${mode}`,
    (signal) => username
      ? api.request<ConnectionsPayload>(
          `public-profile?username=${encodeURIComponent(username)}&view=${type}`,
          { signal, context: 'public' },
        )
      : Promise.reject(new Error('Profile username is missing.')),
  );

  const people = useMemo(
    () => (resource.data?.people ?? []).map((person) => ({
      ...person,
      viewerFollows: overrides[person.id] ?? person.viewerFollows,
    })),
    [resource.data?.people, overrides],
  );
  const total = type === 'followers'
    ? resource.data?.counts.followers ?? 0
    : resource.data?.counts.following ?? 0;

  const openLogin = () => {
    router.push({
      pathname: '/(auth)/login',
      params: { returnTo: `/general/member-connections?username=${encodeURIComponent(username)}&type=${type}` },
    } as any);
  };

  const toggleFollow = async (person: ConnectionPerson) => {
    if (person.isSelf || busy === person.id) return;
    if (mode !== 'authenticated') {
      openLogin();
      return;
    }
    const current = overrides[person.id] ?? Boolean(person.viewerFollows);
    const next = !current;
    setBusy(person.id);
    setActionError('');
    setOverrides((state) => ({ ...state, [person.id]: next }));
    try {
      const result = await api.request<{ following: boolean }>('follows', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: next ? 'follow' : 'unfollow',
          targetProfileId: person.id,
        }),
      });
      setOverrides((state) => ({ ...state, [person.id]: result.following }));
      invalidate('public-profile:');
      invalidate('mobile:home-feed:');
    } catch (error) {
      setOverrides((state) => ({ ...state, [person.id]: current }));
      setActionError(error instanceof Error ? error.message : 'Unable to update this follow.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 }]}
      >
        <ScreenHeader
          title={type === 'followers' ? 'Followers' : 'Following'}
          kicker={resource.data?.profile?.username ? `@${resource.data.profile.username}` : 'COT MEMBER'}
          subtitle={resource.data ? `${total.toLocaleString()} ${type === 'followers' ? 'followers' : 'people followed'}` : 'Member connections'}
          showBack
        />

        {actionError ? (
          <Pressable onPress={() => setActionError('')} style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
            <Icon name="alert-circle-outline" size={17} color={colors.live} />
            <Text style={[styles.noticeText, { color: colors.live }]}>{actionError}</Text>
            <Icon name="close" size={15} color={colors.live} />
          </Pressable>
        ) : null}

        {resource.loading && !resource.data ? (
          <View style={styles.list}><Skeleton height={72} count={5} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : people.length ? (
          <View style={styles.list}>
            <View style={[styles.countCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.countNumber, { color: colors.text }]}>{total.toLocaleString()}</Text>
              <Text style={[styles.countLabel, { color: colors.textSecondary }]}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
            </View>
            {people.map((person) => (
              <View key={person.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <Pressable
                  style={styles.identity}
                  onPress={() => router.push(`/general/member/${encodeURIComponent(person.username)}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open @${person.username}'s profile`}
                >
                  <Avatar url={person.avatar_url ?? undefined} name={person.display_name || person.username} size="md" />
                  <View style={styles.identityCopy}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{person.display_name || `@${person.username}`}</Text>
                    <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>@{person.username}</Text>
                    {person.bio ? <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={1}>{person.bio}</Text> : null}
                  </View>
                </Pressable>
                {!person.isSelf ? (
                  <Button
                    label={person.viewerFollows ? 'Following' : 'Follow'}
                    variant={person.viewerFollows ? 'outline' : 'primary'}
                    size="sm"
                    loading={busy === person.id}
                    onPress={() => void toggleFollow(person)}
                  />
                ) : (
                  <Text style={[styles.you, { color: colors.textMuted }]}>You</Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title={type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            message={type === 'followers' ? `@${username} does not have followers yet.` : `@${username} is not following another COT member yet.`}
            iconName="people-outline"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  list: { gap: spacing.sm },
  countCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  countNumber: { fontSize: 24, fontWeight: '900' },
  countLabel: { fontSize: 13, fontWeight: '700' },
  row: { minHeight: 76, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identityCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '900' },
  username: { fontSize: 11.5, marginTop: 1 },
  bio: { fontSize: 10.5, marginTop: 3 },
  you: { fontSize: 11, fontWeight: '800', paddingHorizontal: spacing.sm },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noticeText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
});

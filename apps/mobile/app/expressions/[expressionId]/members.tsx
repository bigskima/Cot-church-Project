import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Avatar, EmptyState, Icon, ResourceError, Skeleton } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type DirectoryProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type DirectoryMember = {
  id: string;
  profile_id: string;
  joined_at?: string | null;
  profile?: DirectoryProfile | DirectoryProfile[] | null;
};

function profileOf(member: DirectoryMember) {
  return Array.isArray(member.profile) ? member.profile[0] ?? null : member.profile ?? null;
}

function joinedLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function ExpressionMembersScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const expressionName =
    context?.expression?.id === id
      ? context.expression.name
      : membership?.name ?? 'this Expression';

  const resource = useResource<DirectoryMember[]>(
    `expression:member-directory:${id || 'none'}:${mode}`,
    (signal) =>
      id
        ? api.request<DirectoryMember[]>(
            `memberships?view=expression-directory&expressionId=${encodeURIComponent(id)}&limit=100`,
            { signal },
          )
        : Promise.resolve([]),
  );

  const members = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = resource.data ?? [];
    if (!term) return rows;
    return rows.filter((member) => {
      const profile = profileOf(member);
      return [profile?.display_name, profile?.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [query, resource.data]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionPeopleHeader
        expressionId={id}
        expressionName={expressionName}
        active="members"
        title="Members"
        subtitle="Find the people who belong to this Expression and recognize the community around you."
        icon="people-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={resource.refreshing}
            onRefresh={resource.refresh}
            tintColor={colors.interactive}
          />
        }
      >
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.borderSubtle },
            shadows.sm,
          ]}
        >
          <Icon name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a member"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {resource.data ? (
            <View style={[styles.countPill, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.countText, { color: colors.interactive }]}>
                {resource.data.length}
              </Text>
            </View>
          ) : null}
        </View>

        {resource.loading && !resource.data ? (
          <View style={styles.stack}>
            <Skeleton height={68} count={6} />
          </View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : members.length ? (
          <View style={styles.stack}>
            {members.map((member) => {
              const profile = profileOf(member);
              const name = profile?.display_name || profile?.username || 'Expression member';
              const username = profile?.username ? `@${profile.username}` : null;
              const isYou = profile?.id === context?.profile?.id;
              const joined = joinedLabel(member.joined_at);

              return (
                <View
                  key={member.id}
                  style={[
                    styles.memberRow,
                    { backgroundColor: colors.card, borderColor: isYou ? colors.interactive : colors.borderSubtle },
                    shadows.sm,
                  ]}
                >
                  <Avatar url={profile?.avatar_url ?? undefined} name={name} size="md" />
                  <View style={styles.memberCopy}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                        {name}
                      </Text>
                      {isYou ? (
                        <View style={[styles.youPill, { backgroundColor: colors.primarySoft }]}>
                          <Text style={[styles.youText, { color: colors.interactive }]}>YOU</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.memberMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {[username, joined ? `Joined ${joined}` : null].filter(Boolean).join(' · ') || 'Expression member'}
                    </Text>
                  </View>
                  <View style={[styles.memberIcon, { backgroundColor: colors.bgSecondary }]}>
                    <Icon name="person-outline" size={16} color={colors.textMuted} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title={query.trim() ? 'No members match your search' : 'No active members found'}
            message={
              query.trim()
                ? 'Try another name or username.'
                : 'Active Expression members will appear here.'
            }
            iconName="people-outline"
          />
        )}

        <View style={[styles.privacyNote, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <View style={[styles.privacyIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="shield-checkmark-outline" size={17} color={colors.interactive} />
          </View>
          <View style={styles.privacyCopy}>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>Member-safe directory</Text>
            <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
              Only profile information intended for other members is shown here. Private contact details and administration data stay protected.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 80,
    gap: spacing.md,
  },
  searchBar: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  countPill: { minWidth: 30, height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '900' },
  stack: { gap: spacing.sm },
  memberRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  memberName: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  memberMeta: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  memberIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  youPill: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  youText: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.5 },
  privacyNote: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  privacyIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  privacyCopy: { flex: 1, minWidth: 0 },
  privacyTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  privacyText: { fontSize: 11, lineHeight: 17, marginTop: 2 },
});

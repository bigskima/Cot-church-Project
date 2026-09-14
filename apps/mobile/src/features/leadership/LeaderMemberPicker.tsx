import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, BottomSheet, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export type LeaderCandidate = {
  profile_id: string;
  joined_at?: string | null;
  profile?: {
    id: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | Array<{
    id: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  }> | null;
};

function profileOf(candidate: LeaderCandidate) {
  return Array.isArray(candidate.profile) ? candidate.profile[0] ?? null : candidate.profile ?? null;
}

export function LeaderMemberPicker({
  scope,
  expressionId,
  selectedProfileId,
  onSelect,
}: {
  scope: 'organization' | 'expression';
  expressionId?: string;
  selectedProfileId?: string | null;
  onSelect: (candidate: LeaderCandidate) => void;
}) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const resource = useResource<LeaderCandidate[]>(
    `leadership:candidates:${scope}:${expressionId ?? 'organization'}`,
    (signal) => {
      const params = new URLSearchParams({ view: 'leader-candidates', limit: '100' });
      if (scope === 'expression' && expressionId) params.set('expressionId', expressionId);
      return api.request<LeaderCandidate[]>(`church-story?${params.toString()}`, { signal });
    },
  );

  const candidates = useMemo(() => {
    const normalized = query.trim().replace(/^@/, '').toLowerCase();
    if (!normalized) return resource.data ?? [];
    return (resource.data ?? []).filter((candidate) => {
      const profile = profileOf(candidate);
      return [profile?.display_name, profile?.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [query, resource.data]);

  const selected = (resource.data ?? []).find((candidate) => profileOf(candidate)?.id === selectedProfileId);
  const selectedProfile = selected ? profileOf(selected) : null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>SELECT EXISTING MEMBER</Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        {selectedProfile ? <Avatar url={selectedProfile.avatar_url ?? undefined} name={selectedProfile.display_name || selectedProfile.username || 'Member'} size="sm" /> : <View style={[styles.placeholderAvatar, { backgroundColor: colors.primarySoft }]}><Icon name="person-add-outline" size={18} color={colors.interactive} /></View>}
        <View style={styles.flex}>
          <Text style={[styles.fieldTitle, { color: colors.text }]}>{selectedProfile?.display_name || 'Search members'}</Text>
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{selectedProfile?.username ? `@${selectedProfile.username}` : 'Choose a real member instead of typing a leader manually.'}</Text>
        </View>
        <Icon name="search-outline" size={18} color={colors.interactive} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose a member" subtitle={scope === 'expression' ? 'Only active members of this Expression are listed.' : 'Only active church members are listed.'} maxHeightPercent={92}>
        <View style={styles.sheet}>
          <View style={[styles.search, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="search-outline" size={18} color={colors.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search name or username" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
          </View>

          {resource.loading && !resource.data ? (
            <Skeleton height={64} count={5} />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : (
            <ScrollView style={styles.results} contentContainerStyle={styles.resultContent} keyboardShouldPersistTaps="handled">
              {candidates.map((candidate) => {
                const profile = profileOf(candidate);
                if (!profile) return null;
                const active = profile.id === selectedProfileId;
                return (
                  <Pressable
                    key={profile.id}
                    onPress={() => { onSelect(candidate); setOpen(false); setQuery(''); }}
                    style={[styles.row, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.interactive : colors.borderSubtle }]}
                  >
                    <Avatar url={profile.avatar_url ?? undefined} name={profile.display_name || profile.username || 'Member'} size="md" />
                    <View style={styles.flex}><Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{profile.display_name || profile.username || 'Member'}</Text>{profile.username ? <Text style={[styles.username, { color: colors.textMuted }]}>@{profile.username}</Text> : null}</View>
                    <View style={[styles.addButton, { backgroundColor: active ? colors.interactive : colors.bgSecondary }]}><Icon name={active ? 'checkmark' : 'add'} size={16} color={active ? '#fff' : colors.interactive} /></View>
                  </Pressable>
                );
              })}
              {!candidates.length ? <Text style={[styles.empty, { color: colors.textMuted }]}>No active member matches this search.</Text> : null}
            </ScrollView>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

export { profileOf as leaderCandidateProfile };

const styles = StyleSheet.create({
  wrap: { gap: 5 }, label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  field: { minHeight: 62, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, placeholderAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1, minWidth: 0 }, fieldTitle: { fontSize: 12.5, fontWeight: '800' }, fieldHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  sheet: { gap: spacing.md, minHeight: 300 }, search: { minHeight: 48, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  results: { maxHeight: 480 }, resultContent: { gap: spacing.sm, paddingBottom: spacing.lg }, row: { minHeight: 66, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, name: { fontSize: 13, fontWeight: '800' }, username: { fontSize: 10.5, marginTop: 2 }, addButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, empty: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: spacing.xl },
});

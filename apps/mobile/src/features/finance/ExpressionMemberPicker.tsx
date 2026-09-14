import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, BottomSheet, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export type FinanceMemberCandidate = {
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

export function financeMemberProfile(candidate?: FinanceMemberCandidate | null) {
  if (!candidate) return null;
  return Array.isArray(candidate.profile) ? candidate.profile[0] ?? null : candidate.profile ?? null;
}

export function ExpressionMemberPicker({
  expressionId,
  selectedProfileId,
  onSelect,
  onClear,
}: {
  expressionId: string;
  selectedProfileId?: string | null;
  onSelect: (candidate: FinanceMemberCandidate) => void;
  onClear?: () => void;
}) {
  const { api } = useSession();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const resource = useResource<FinanceMemberCandidate[]>(
    `finance:expression-members:${expressionId}`,
    (signal) => {
      const params = new URLSearchParams({ view: 'leader-candidates', limit: '250', expressionId });
      return api.request<FinanceMemberCandidate[]>(`church-story?${params.toString()}`, { signal });
    },
  );

  const candidates = useMemo(() => {
    const normalized = query.trim().replace(/^@/, '').toLowerCase();
    if (!normalized) return resource.data ?? [];
    return (resource.data ?? []).filter((candidate) => {
      const profile = financeMemberProfile(candidate);
      return [profile?.display_name, profile?.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [query, resource.data]);

  const selected = (resource.data ?? []).find((candidate) => financeMemberProfile(candidate)?.id === selectedProfileId);
  const selectedProfile = financeMemberProfile(selected);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>MEMBER</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selectedProfile ? `Change contributor ${selectedProfile.display_name || selectedProfile.username || ''}` : 'Choose contributor from Expression members'}
        style={[styles.field, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}
      >
        {selectedProfile ? (
          <Avatar url={selectedProfile.avatar_url ?? undefined} name={selectedProfile.display_name || selectedProfile.username || 'Member'} size="sm" />
        ) : (
          <View style={[styles.placeholderAvatar, { backgroundColor: colors.primarySoft }]}><Icon name="person-add-outline" size={18} color={colors.interactive} /></View>
        )}
        <View style={styles.flex}>
          <Text style={[styles.fieldTitle, { color: colors.text }]}>{selectedProfile?.display_name || selectedProfile?.username || 'Choose an Expression member'}</Text>
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{selectedProfile?.username ? `@${selectedProfile.username}` : 'Names come from member public profiles — no manual typing.'}</Text>
        </View>
        <Icon name="search-outline" size={18} color={colors.interactive} />
      </Pressable>
      {selectedProfile && onClear ? (
        <Pressable onPress={onClear} accessibilityRole="button" style={styles.clearRow}><Icon name="close-circle-outline" size={14} color={colors.textMuted} /><Text style={[styles.clearText, { color: colors.textMuted }]}>Remove member</Text></Pressable>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose contributor" subtitle="Only active members of this Expression are listed." maxHeightPercent={92}>
        <View style={styles.sheet}>
          <View style={[styles.search, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="search-outline" size={18} color={colors.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search name or username" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
          </View>
          {resource.loading && !resource.data ? <Skeleton height={64} count={5} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : (
            <ScrollView style={styles.results} contentContainerStyle={styles.resultContent} keyboardShouldPersistTaps="handled">
              {candidates.map((candidate) => {
                const profile = financeMemberProfile(candidate);
                if (!profile) return null;
                const active = profile.id === selectedProfileId;
                return (
                  <Pressable key={profile.id} onPress={() => { onSelect(candidate); setOpen(false); setQuery(''); }} style={[styles.row, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.interactive : colors.borderSubtle }]}>
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

const styles = StyleSheet.create({
  wrap: { gap: 5 }, label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  field: { minHeight: 62, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, placeholderAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1, minWidth: 0 }, fieldTitle: { fontSize: 12.5, fontWeight: '800' }, fieldHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  clearRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }, clearText: { fontSize: 10.5, fontWeight: '700' },
  sheet: { gap: spacing.md, minHeight: 300 }, search: { minHeight: 48, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  results: { maxHeight: 480 }, resultContent: { gap: spacing.sm, paddingBottom: spacing.lg }, row: { minHeight: 66, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, name: { fontSize: 13, fontWeight: '800' }, username: { fontSize: 10.5, marginTop: 2 }, addButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, empty: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: spacing.xl },
});

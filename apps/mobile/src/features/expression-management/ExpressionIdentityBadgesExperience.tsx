import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Badge, BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { FullIdentityBadge } from '@/components/identity/PublicIdentityBadge';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { LeaderMemberPicker, leaderCandidateProfile, type LeaderCandidate } from '@/features/leadership/LeaderMemberPicker';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Definition = {
  id: string;
  code: string;
  label: string;
  background_color: string;
  text_color: string;
  priority: number;
  badge_variant: string;
  notify_priority_posts: boolean;
  is_membership_default: boolean;
  is_active: boolean;
};
type Assignment = { id: string; profile_id: string; badge_definition_id: string; is_active: boolean };
type Member = { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null };
type Payload = { definitions: Definition[]; assignments: Assignment[]; members: Member[]; branchId: string };

const variants = ['default','teal','blue','gold','silver','custom'] as const;

export function ExpressionIdentityBadgesExperience() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const branchId = typeof expressionId === 'string' ? expressionId : '';
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { api, context, hasCapability } = useSession();
  const canManage = Boolean(branchId) && hasCapability('expression.leadership.manage');

  const [editor, setEditor] = useState<Definition | 'new' | null>(null);
  const [label, setLabel] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#475569');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [priority, setPriority] = useState('50');
  const [badgeVariant, setBadgeVariant] = useState<(typeof variants)[number]>('default');
  const [notifyPriorityPosts, setNotifyPriorityPosts] = useState(false);
  const [active, setActive] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resource = useResource<Payload>(
    `identity-badges:expression:${branchId || 'none'}`,
    (signal) => branchId && canManage
      ? api.request<Payload>(`church-story?view=badges&expressionId=${encodeURIComponent(branchId)}`, { signal, context: 'current' })
      : Promise.resolve({ definitions: [], assignments: [], members: [], branchId } as Payload),
  );

  const definitions = (resource.data?.definitions ?? []).filter((item) => !item.is_membership_default);
  const assignments = resource.data?.assignments ?? [];
  const members = resource.data?.members ?? [];
  const selectedMember = selectedProfileId ? members.find((member) => member.id === selectedProfileId) ?? null : null;
  const selectedAssignments = useMemo(
    () => selectedProfileId ? new Set(assignments.filter((item) => item.profile_id === selectedProfileId).map((item) => item.badge_definition_id)) : new Set<string>(),
    [assignments, selectedProfileId],
  );

  const openCreate = () => {
    setEditor('new');
    setLabel('');
    setBackgroundColor('#475569');
    setTextColor('#FFFFFF');
    setPriority('50');
    setBadgeVariant('default');
    setNotifyPriorityPosts(false);
    setActive(true);
    setErrorMsg('');
  };

  const openEdit = (definition: Definition) => {
    setEditor(definition);
    setLabel(definition.label);
    setBackgroundColor(definition.background_color);
    setTextColor(definition.text_color);
    setPriority(String(definition.priority));
    setBadgeVariant((variants.includes(definition.badge_variant as any) ? definition.badge_variant : 'default') as any);
    setNotifyPriorityPosts(definition.notify_priority_posts === true);
    setActive(definition.is_active !== false);
    setErrorMsg('');
  };

  const selectCandidate = (candidate: LeaderCandidate) => {
    const profile = leaderCandidateProfile(candidate);
    if (!profile) return;
    setSelectedProfileId(profile.id);
    setErrorMsg('');
  };

  const saveDefinition = async () => {
    if (!branchId || !label.trim()) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const editing = editor !== null && editor !== 'new';
      await api.request('church-story', {
        method: editing ? 'PATCH' : 'POST',
        context: 'current',
        body: JSON.stringify({
          action: editing ? 'badge_update_definition' : 'badge_create_definition',
          expressionId: branchId,
          ...(editing ? { definitionId: editor.id } : {}),
          label: label.trim(),
          backgroundColor,
          textColor,
          priority: Number(priority) || 0,
          badgeVariant,
          notifyPriorityPosts,
          ...(editing ? { isActive: active } : {}),
        }),
      });
      setEditor(null);
      setSuccessMsg(editing ? 'Expression title updated.' : 'Expression title created.');
      await resource.refresh();
    } catch (value) {
      setErrorMsg(value instanceof Error ? value.message : 'Unable to save this public title.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAssignment = async (definition: Definition) => {
    if (!selectedProfileId) return;
    const assigned = selectedAssignments.has(definition.id);
    setBusy(true);
    setErrorMsg('');
    try {
      await api.request('church-story', {
        method: 'POST',
        context: 'current',
        body: JSON.stringify({
          action: assigned ? 'badge_revoke' : 'badge_assign',
          expressionId: branchId,
          profileId: selectedProfileId,
          definitionId: definition.id,
        }),
      });
      setSuccessMsg(assigned ? 'Title removed from this member.' : 'Title assigned to this member.');
      await resource.refresh();
    } catch (value) {
      setErrorMsg(value instanceof Error ? value.message : 'Unable to update this title assignment.');
    } finally {
      setBusy(false);
    }
  };

  if (!branchId || !canManage) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Public-title management unavailable" message="Only authorized Expression leadership can manage presentation badges here." iconName="lock-closed-outline" /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 90 }]}>
        <ScreenHeader title="Titles & badges" kicker="EXPRESSION IDENTITY" subtitle="Presentation-only titles for this Expression. They never grant permissions." showBack rightAction={<Button label="New title" size="sm" onPress={openCreate} />} />
        {successMsg ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text></View> : null}
        {errorMsg && !editor ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}

        <View style={[styles.ruleCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
          <Icon name="ribbon-outline" size={20} color={colors.interactive} />
          <Text style={[styles.ruleText, { color: colors.textSecondary }]}>A person can have a church-wide title and a different Expression title. The highest-priority applicable badge becomes the compact mark beside their name.</Text>
        </View>

        <SectionHeader title="Expression title definitions" badge={definitions.length} subtitle="Defaults are editable and you can create additional ministry titles." />
        {resource.loading && !resource.data ? <Skeleton height={86} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : definitions.length ? (
          <View style={styles.stack}>
            {definitions.map((definition) => (
              <View key={definition.id} style={[styles.definitionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <FullIdentityBadge badge={{ id: definition.id, code: definition.code, label: definition.label, backgroundColor: definition.background_color, textColor: definition.text_color, priority: definition.priority, badgeVariant: definition.badge_variant }} />
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: colors.text }]}>{definition.label}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Priority {definition.priority}{definition.notify_priority_posts ? ' · priority-post alerts' : ''}</Text>
                </View>
                <Badge label={definition.is_active ? 'ACTIVE' : 'OFF'} variant={definition.is_active ? 'active' : 'neutral'} />
                <Button label="Edit" variant="outline" size="sm" onPress={() => openEdit(definition)} />
              </View>
            ))}
          </View>
        ) : <EmptyState title="No Expression titles" message="Create the first presentation title for this Expression." iconName="ribbon-outline" actionLabel="Create title" onAction={openCreate} />}

        <SectionHeader title="Assign to a member" subtitle="Search an active member, then tap the titles that should appear on their identity." />
        <LeaderMemberPicker scope="expression" expressionId={branchId} selectedProfileId={selectedProfileId} onSelect={selectCandidate} />
        {selectedMember ? (
          <View style={[styles.assignmentCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <View style={styles.assignmentHeading}>
              <View style={styles.flex}><Text style={[styles.title, { color: colors.text }]}>{selectedMember.display_name || selectedMember.username || 'Member'}</Text>{selectedMember.username ? <Text style={[styles.meta, { color: colors.textMuted }]}>@{selectedMember.username}</Text> : null}</View>
              <Badge label={selectedAssignments.size ? `${selectedAssignments.size} TITLE${selectedAssignments.size === 1 ? '' : 'S'}` : 'NO TITLE'} variant={selectedAssignments.size ? 'primary' : 'neutral'} />
            </View>
            <View style={styles.chips}>
              {definitions.filter((item) => item.is_active).map((definition) => (
                <Chip key={definition.id} label={definition.label} selected={selectedAssignments.has(definition.id)} onPress={() => void toggleAssignment(definition)} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={editor !== null} onClose={() => { if (!busy) setEditor(null); }} title={editor === 'new' ? 'Create Expression title' : 'Edit Expression title'} subtitle={context?.expression?.name ?? 'Expression'} maxHeightPercent={94}>
        <View style={styles.form}>
          {errorMsg ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}
          <InputField label="Title" value={label} onChangeText={setLabel} placeholder="Expression Pastor, Youth Leader…" />
          <InputField label="Badge color" value={backgroundColor} onChangeText={setBackgroundColor} placeholder="#0F766E" autoCapitalize="characters" />
          <InputField label="Icon/text color" value={textColor} onChangeText={setTextColor} placeholder="#FFFFFF" autoCapitalize="characters" />
          <InputField label="Priority" value={priority} onChangeText={setPriority} keyboardType="number-pad" placeholder="50" />
          <Text style={[styles.label, { color: colors.textSecondary }]}>BADGE STYLE</Text>
          <View style={styles.chips}>{variants.map((variant) => <Chip key={variant} label={variant.toUpperCase()} selected={badgeVariant === variant} onPress={() => setBadgeVariant(variant)} />)}</View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>PRIORITY POST ALERTS</Text>
          <View style={styles.chips}><Chip label="Normal title" selected={!notifyPriorityPosts} onPress={() => setNotifyPriorityPosts(false)} /><Chip label="Priority ministry" selected={notifyPriorityPosts} onPress={() => setNotifyPriorityPosts(true)} /></View>
          {editor !== 'new' ? <><Text style={[styles.label, { color: colors.textSecondary }]}>STATUS</Text><View style={styles.chips}><Chip label="Active" selected={active} onPress={() => setActive(true)} /><Chip label="Inactive" selected={!active} onPress={() => setActive(false)} /></View></> : null}
          <Button label={editor === 'new' ? 'Create title' : 'Save changes'} onPress={() => void saveDefinition()} loading={busy} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { width: '100%', maxWidth: 840, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  stack: { gap: spacing.sm }, flex: { flex: 1, minWidth: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, bannerText: { flex: 1, fontSize: 12, fontWeight: '700' },
  ruleCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, ruleText: { flex: 1, fontSize: 11, lineHeight: 17 },
  definitionCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 13, fontWeight: '900' }, meta: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  assignmentCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, assignmentHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, form: { gap: spacing.md }, label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
});

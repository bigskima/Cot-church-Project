import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  LeaderCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function ExpressionLeadershipManage() {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const branchId = expression?.id;
  const canManage = Boolean(branchId) && (hasCapability('expression.leadership.manage') || hasCapability('*'));

  const [createOpen, setCreateOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<LeadershipProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [featurePublicly, setFeaturePublicly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const leaders = useResource<LeadershipProfile[]>(
    `leadership:expression:manage:${branchId ?? 'none'}`,
    (signal) =>
      branchId
        ? api.request<LeadershipProfile[]>(`church-story?view=leadership&expressionId=${branchId}`, { signal })
        : Promise.resolve([]),
  );

  if (!branchId) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Expression leadership" kicker="LEADERSHIP" showBack />
        <View style={styles.emptyPad}>
          <EmptyState title="Enter an Expression first" message="Leadership profiles belong to the active Expression." iconName="people-outline" />
        </View>
      </View>
    );
  }

  const resetForm = () => {
    setEditingLeader(null);
    setDisplayName('');
    setRoleTitle('');
    setMinistry('');
    setShortBio('');
    setFeaturePublicly(false);
    setErrorMsg('');
  };

  const openCreate = () => {
    if (!canManage) return;
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (leader: LeadershipProfile) => {
    if (!canManage) return;
    setEditingLeader(leader);
    setDisplayName(leader.display_name ?? '');
    setRoleTitle(leader.role_title ?? '');
    setMinistry(leader.ministry ?? '');
    setShortBio(leader.short_bio ?? '');
    setFeaturePublicly(leader.is_featured_public === true);
    setErrorMsg('');
    setSuccessMsg('');
    setCreateOpen(true);
  };

  async function handleSaveLeader() {
    if (!canManage) return;
    if (!displayName.trim() || !roleTitle.trim()) {
      setErrorMsg('Provide the leader name and role title.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const isEditing = Boolean(editingLeader);
      await api.request('church-story', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(isEditing ? { id: editingLeader!.id } : { expressionId: branchId }),
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          ministry: ministry.trim() || null,
          shortBio: shortBio.trim() || '',
          isFeaturedPublic: featurePublicly,
        }),
      });
      setSuccessMsg(
        isEditing
          ? 'Leader profile updated.'
          : featurePublicly
            ? 'Leader added to the Expression directory and marked for public leadership presentation.'
            : 'Leader added to the Expression directory.',
      );
      setCreateOpen(false);
      resetForm();
      await leaders.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create leader profile.');
    } finally {
      setSaving(false);
    }
  }

  const leaderList = leaders.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Expression leadership"
            kicker="LEADERSHIP"
            subtitle={`Pastors and ministry leaders serving ${expression.name}.`}
            showBack
            rightAction={canManage ? <Button label="Add leader" onPress={openCreate} size="sm" /> : undefined}
          />
        </View>

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text>
            </View>
          ) : null}
          {errorMsg && !createOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.listSection}>
            <SectionHeader
              title="Leadership directory"
              badge={leaderList.length}
              subtitle="Expression leadership remains private to this scope unless explicitly featured publicly"
              actionLabel={canManage ? 'Add' : undefined}
              onAction={canManage ? openCreate : undefined}
            />
            {leaders.loading ? (
              <Skeleton height={92} count={2} />
            ) : leaders.error && !leaders.data ? (
              <ResourceError message={leaders.error} retry={leaders.refresh} />
            ) : leaderList.length ? (
              leaderList.map((leader) => (
                <View key={leader.id} style={styles.leaderRow}>
                  <View style={styles.flex}><LeaderCard leader={leader} variant="standard" /></View>
                  {canManage ? <Button label="Edit" onPress={() => openEdit(leader)} variant="outline" size="sm" /> : null}
                </View>
              ))
            ) : (
              <EmptyState
                title="No leaders configured"
                message="Add the pastoral and ministry team serving this Expression."
                iconName="people-outline"
                actionLabel={canManage ? 'Add leader' : undefined}
                onAction={canManage ? openCreate : undefined}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={createOpen}
        onClose={() => {
          if (!saving) {
            setCreateOpen(false);
            resetForm();
          }
        }}
        title={editingLeader ? 'Edit Expression leader' : 'Add Expression leader'}
        subtitle={editingLeader ? editingLeader.display_name : `Inside ${expression.name}`}
        maxHeightPercent={92}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField label="Full name" value={displayName} onChangeText={setDisplayName} placeholder="Pastor / leader name" />
          <InputField label="Role title" value={roleTitle} onChangeText={setRoleTitle} placeholder="Lead Pastor, Worship Director…" />
          <InputField label="Ministry (optional)" value={ministry} onChangeText={setMinistry} placeholder="Pastoral Care, Youth, Worship…" />
          <InputField label="Short biography" value={shortBio} onChangeText={setShortBio} multiline numberOfLines={4} placeholder="A short ministry introduction…" />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PUBLIC VISIBILITY</Text>
          <View style={styles.chips}>
            <Chip label="Expression directory only" selected={!featurePublicly} onPress={() => setFeaturePublicly(false)} />
            <Chip label="Also feature publicly" selected={featurePublicly} onPress={() => setFeaturePublicly(true)} />
          </View>
          <Text style={[styles.helper, { color: colors.textMuted }]}>
            Public featuring is optional. Expression leaders are not automatically added to the church-wide public leadership presentation.
          </Text>

          <Button label={editingLeader ? 'Save changes' : 'Save leader'} onPress={() => void handleSaveLeader()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
  flex: { flex: 1 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyPad: { paddingHorizontal: spacing.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  listSection: { gap: spacing.sm },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helper: { fontSize: 11, lineHeight: 16 },
});

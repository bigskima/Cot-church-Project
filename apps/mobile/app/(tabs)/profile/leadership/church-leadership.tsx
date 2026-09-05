import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
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

export default function ChurchLeadershipManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const organization = context?.organization ?? context?.organizations?.[0];
  const canManage = hasCapability('organization.leadership.manage') || hasCapability('*');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<LeadershipProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [featurePublicly, setFeaturePublicly] = useState(true);
  const [isFounder, setIsFounder] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const leaders = useResource<LeadershipProfile[]>(
    `leadership:church:manage:${organization?.id ?? 'none'}:${canManage}`,
    (signal) =>
      organization && canManage
        ? api.request<LeadershipProfile[]>('church-story?view=leadership-manage', { signal })
        : Promise.resolve([]),
  );

  const resetForm = () => {
    setEditingLeader(null);
    setDisplayName('');
    setRoleTitle('');
    setMinistry('');
    setShortBio('');
    setFeaturePublicly(true);
    setIsFounder(false);
    setIsActive(true);
    setErrorMsg('');
  };

  const openCreate = () => {
    if (!canManage) return;
    resetForm();
    setSuccessMsg('');
    setEditorOpen(true);
  };

  const openEdit = (leader: LeadershipProfile) => {
    if (!canManage) return;
    setEditingLeader(leader);
    setDisplayName(leader.display_name ?? '');
    setRoleTitle(leader.role_title ?? '');
    setMinistry(leader.ministry ?? '');
    setShortBio(leader.short_bio ?? '');
    setFeaturePublicly(leader.is_featured_public === true);
    setIsFounder(leader.is_founder === true);
    setIsActive(leader.is_active !== false);
    setErrorMsg('');
    setSuccessMsg('');
    setEditorOpen(true);
  };

  const saveLeader = async () => {
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
          ...(isEditing ? { id: editingLeader!.id } : {}),
          displayName: displayName.trim(),
          roleTitle: roleTitle.trim(),
          ministry: ministry.trim() || null,
          shortBio: shortBio.trim() || '',
          isFounder,
          isFeaturedPublic: featurePublicly,
          ...(isEditing ? { isActive } : {}),
        }),
      });
      setEditorOpen(false);
      resetForm();
      setSuccessMsg(isEditing ? 'Church leader profile updated.' : 'Church leader added.');
      await leaders.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to save this church leader.');
    } finally {
      setSaving(false);
    }
  };

  if (!organization) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState title="Choose a church" message="Choose a church before managing its leadership." iconName="business-outline" />
      </View>
    );
  }

  if (!canManage) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          title="Church leadership access unavailable"
          message="Your current role does not include church-wide leadership management."
          iconName="lock-closed-outline"
        />
      </View>
    );
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
            title="Church Leadership"
            kicker="LEADERSHIP"
            subtitle={`Church-wide leadership presentation for ${organization.name}.`}
            showBack
            rightAction={<Button label="Add leader" onPress={openCreate} size="sm" />}
          />
        </View>

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text>
            </View>
          ) : null}
          {errorMsg && !editorOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <SectionHeader
            title="Church-wide directory"
            badge={leaderList.length}
            subtitle="Only profiles marked public are shown in the public Church Story."
            actionLabel="Add"
            onAction={openCreate}
          />

          {leaders.loading && !leaders.data ? (
            <Skeleton height={96} count={3} />
          ) : leaders.error && !leaders.data ? (
            <ResourceError message={leaders.error} retry={leaders.refresh} />
          ) : leaderList.length ? (
            leaderList.map((leader) => (
              <View key={leader.id} style={[styles.leaderRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.flex}>
                  <LeaderCard leader={leader} variant="standard" />
                  <View style={styles.badges}>
                    <Badge label={leader.is_active ? 'ACTIVE' : 'INACTIVE'} variant={leader.is_active ? 'active' : 'neutral'} />
                    <Badge label={leader.is_featured_public ? 'PUBLIC' : 'INTERNAL'} variant={leader.is_featured_public ? 'primary' : 'neutral'} />
                    {leader.is_founder ? <Badge label="FOUNDER" variant="warning" /> : null}
                  </View>
                </View>
                <Button label="Edit" onPress={() => openEdit(leader)} variant="outline" size="sm" />
              </View>
            ))
          ) : (
            <EmptyState
              title="No church leaders configured"
              message="Add the church-wide leadership team and choose who should appear publicly."
              iconName="people-outline"
              actionLabel="Add leader"
              onAction={openCreate}
            />
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={editorOpen}
        onClose={() => {
          if (!saving) {
            setEditorOpen(false);
            resetForm();
          }
        }}
        title={editingLeader ? 'Edit church leader' : 'Add church leader'}
        subtitle={editingLeader ? editingLeader.display_name : organization.name}
        maxHeightPercent={94}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField label="Full name" value={displayName} onChangeText={setDisplayName} placeholder="Pastor / leader name" />
          <InputField label="Role title" value={roleTitle} onChangeText={setRoleTitle} placeholder="Senior Pastor, Worship Director…" />
          <InputField label="Ministry (optional)" value={ministry} onChangeText={setMinistry} placeholder="Pastoral Care, Worship, Youth…" />
          <InputField label="Short biography" value={shortBio} onChangeText={setShortBio} multiline numberOfLines={4} placeholder="A short public introduction…" />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PUBLIC PRESENTATION</Text>
          <View style={styles.chips}>
            <Chip label="Feature publicly" selected={featurePublicly} onPress={() => setFeaturePublicly(true)} />
            <Chip label="Keep internal" selected={!featurePublicly} onPress={() => setFeaturePublicly(false)} />
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FOUNDER</Text>
          <View style={styles.chips}>
            <Chip label="Founder" selected={isFounder} onPress={() => setIsFounder(true)} />
            <Chip label="Not founder" selected={!isFounder} onPress={() => setIsFounder(false)} />
          </View>

          {editingLeader ? (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text>
              <View style={styles.chips}>
                <Chip label="Active" selected={isActive} onPress={() => setIsActive(true)} />
                <Chip label="Inactive" selected={!isActive} onPress={() => setIsActive(false)} />
              </View>
            </>
          ) : null}

          <Button label={editingLeader ? 'Save changes' : 'Save leader'} onPress={() => void saveLeader()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

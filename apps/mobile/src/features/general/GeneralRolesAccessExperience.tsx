import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SearchBar,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type MemberProfile = { id: string; display_name?: string | null; phone_number?: string | null; avatar_url?: string | null };
type Membership = {
  id: string;
  status: string;
  branch_id?: string | null;
  profile?: MemberProfile | MemberProfile[] | null;
};
type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  role_permissions?: Array<{ permission_code: string }>;
};
type RoleAssignment = {
  id: string;
  membership_id: string;
  branch_id?: string | null;
  expires_at?: string | null;
  role?: Role | Role[] | null;
};
type Permission = { code: string; name: string; description: string; category: string };

type AccessResource = {
  memberships: Membership[];
  roles: Role[];
  assignments: RoleAssignment[];
  permissions: Permission[];
};

const rolePresets: Array<{ key: string; name: string; description: string; permissions: string[] }> = [
  {
    key: 'content_operator',
    name: 'Content Operator',
    description: 'Creates and manages General COT posts, sermons, events, announcements and media.',
    permissions: ['posts.create','posts.publish','media.upload','sermons.create','sermons.manage','sermons.publish','events.create','events.update','announcements.manage','polls.manage','reels.create','reels.publish','videos.create','videos.publish','studio.access'],
  },
  {
    key: 'pastoral_operator',
    name: 'Pastoral Care Operator',
    description: 'Receives and works prayer, pastoral follow-up and testimony queues.',
    permissions: ['prayer.intake.receive','prayer.moderate','prayer.pastoral.receive','prayer.team.receive','pastoral.followups.receive','testimonies.review','testimonies.manage'],
  },
  {
    key: 'general_admin',
    name: 'General COT Admin',
    description: 'Helps manage people, content, giving and ministry across General COT without becoming a Platform Administrator.',
    permissions: ['members.read','members.update','members.invite','roles.read','roles.assign','organization.leadership.manage','posts.create','posts.publish','media.upload','sermons.create','sermons.manage','sermons.publish','events.create','events.update','announcements.manage','polls.manage','giving.campaigns.manage','giving.finance.read','giving.read','prayer.moderate','prayer.pastoral.receive','prayer.team.receive','pastoral.followups.receive','testimonies.review','testimonies.manage'],
  },
];

function one<T>(value?: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function roleForAssignment(assignment: RoleAssignment) {
  return one(assignment.role);
}

export default function GeneralRolesAccessExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, hasOrganizationCapability, mode } = useSession();
  const { colors } = useTheme();
  const organization = context?.organization ?? context?.organizations?.[0];
  const canRead = mode === 'authenticated' && hasOrganizationCapability('roles.read');
  const canAssign = hasOrganizationCapability('roles.assign') || hasOrganizationCapability('roles.manage');
  const canManage = hasOrganizationCapability('roles.manage');

  const [query, setQuery] = useState('');
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [roleComposerOpen, setRoleComposerOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const resource = useResource<AccessResource>(
    `general:roles-access:${organization?.id ?? 'none'}:${canRead}`,
    async (signal) => {
      if (!organization || !canRead) return { memberships: [], roles: [], assignments: [], permissions: [] };
      const [memberships, roles, assignments, permissions] = await Promise.all([
        api.request<Membership[]>('memberships?status=active&limit=100', { signal }),
        api.request<Role[]>('roles', { signal }),
        api.request<RoleAssignment[]>('role-assignments', { signal }),
        api.request<Permission[]>('permissions', { signal }),
      ]);
      return { memberships, roles, assignments, permissions };
    },
  );

  const members = resource.data?.memberships ?? [];
  const roles = resource.data?.roles ?? [];
  const assignments = resource.data?.assignments ?? [];
  const assignablePermissions = useMemo(
    () => (resource.data?.permissions ?? []).filter((item) => !item.code.startsWith('platform.') && !item.code.startsWith('public.')),
    [resource.data?.permissions],
  );
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((membership) => {
      const profile = one(membership.profile);
      return [profile?.display_name, profile?.phone_number].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [members, query]);
  const selectedMembership = members.find((item) => item.id === selectedMembershipId) ?? null;
  const selectedProfile = one(selectedMembership?.profile);
  const selectedAssignments = assignments.filter((item) => item.membership_id === selectedMembershipId && !item.branch_id);
  const activeRoleIds = new Set(selectedAssignments.map((item) => roleForAssignment(item)?.id).filter(Boolean));

  const refreshAll = async () => {
    await resource.refresh();
  };

  const assignRole = async (role: Role) => {
    if (!selectedMembership || !canAssign || busyKey) return;
    setBusyKey(`role:${role.id}`); setError(''); setNotice('');
    try {
      await api.request('role-assignments', {
        method: 'POST',
        body: JSON.stringify({ membershipId: selectedMembership.id, roleId: role.id, branchId: null }),
      });
      setNotice(`${role.name} granted to ${selectedProfile?.display_name || 'this member'} for General COT.`);
      await refreshAll();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to assign this role.');
    } finally { setBusyKey(''); }
  };

  const revokeRole = async (role: Role) => {
    if (!selectedMembership || !canAssign || role.code === 'owner' || busyKey) return;
    const assignment = selectedAssignments.find((item) => roleForAssignment(item)?.id === role.id);
    if (!assignment) return;
    setBusyKey(`role:${role.id}`); setError(''); setNotice('');
    try {
      await api.request('role-assignments', { method: 'DELETE', body: JSON.stringify({ assignmentId: assignment.id }) });
      setNotice(`${role.name} removed from ${selectedProfile?.display_name || 'this member'}.`);
      await refreshAll();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to remove this role.');
    } finally { setBusyKey(''); }
  };

  const applyPreset = (key: string) => {
    const preset = rolePresets.find((item) => item.key === key);
    if (!preset) return;
    setRoleName(preset.name);
    setRoleCode(preset.key);
    setRoleDescription(preset.description);
    setSelectedPermissions(preset.permissions.filter((code) => assignablePermissions.some((permission) => permission.code === code)));
  };

  const createRole = async () => {
    if (!canManage || !roleName.trim() || !roleCode.trim() || busyKey) return;
    setBusyKey('create-role'); setError(''); setNotice('');
    try {
      await api.request('roles', {
        method: 'POST',
        body: JSON.stringify({
          code: roleCode.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''),
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissionCodes: selectedPermissions,
        }),
      });
      setRoleComposerOpen(false);
      setRoleName(''); setRoleCode(''); setRoleDescription(''); setSelectedPermissions([]);
      setNotice('General COT operator role created. You can now assign it to members.');
      await refreshAll();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to create this role.');
    } finally { setBusyKey(''); }
  };

  if (!organization) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Choose a church" message="General COT roles are managed inside a church organization." iconName="business-outline" /></View>;
  }
  if (!canRead) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Role management unavailable" message="Your role does not include access to manage church roles." iconName="lock-closed-outline" /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 }]}>
        <ScreenHeader title="Roles & Access" kicker="GENERAL COT · ADMIN" subtitle="Give people the exact church-wide ministry responsibilities they need without leaking Expression or platform authority." showBack rightAction={canManage ? <Button label="New role" size="sm" onPress={() => setRoleComposerOpen(true)} /> : undefined} />

        <View style={[styles.scopeCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
          <Icon name="shield-checkmark-outline" size={20} color={colors.interactive} />
          <View style={styles.flex}><Text style={[styles.scopeTitle, { color: colors.text }]}>This screen grants ministry access only</Text><Text style={[styles.scopeText, { color: colors.textSecondary }]}>General COT roles control church-wide ministry work. Expression roles stay inside an Expression. Platform administrator invitations and operations belong only to the separate administration website.</Text></View>
        </View>

        {notice ? <Pressable onPress={() => setNotice('')} style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{notice}</Text></Pressable> : null}
        {error ? <Pressable onPress={() => setError('')} style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></Pressable> : null}

        {resource.loading && !resource.data ? <Skeleton height={100} count={4} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : (
          <>
            <View style={styles.twoColumn}>
              <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <SectionHeader title="General COT people" badge={members.length} subtitle="Select an active church member" />
                <SearchBar value={query} onChangeText={setQuery} placeholder="Search member name or phone" />
                <View style={styles.memberList}>
                  {filteredMembers.map((membership) => {
                    const profile = one(membership.profile);
                    const selected = membership.id === selectedMembershipId;
                    const count = assignments.filter((item) => item.membership_id === membership.id && !item.branch_id).length;
                    return <Pressable key={membership.id} onPress={() => setSelectedMembershipId(membership.id)} style={[styles.memberRow, { backgroundColor: selected ? colors.primarySoft : colors.bgSecondary, borderColor: selected ? colors.interactive : colors.borderSubtle }]}><Avatar url={profile?.avatar_url} name={profile?.display_name || 'Member'} size="sm" /><View style={styles.flex}><Text style={[styles.memberName, { color: colors.text }]}>{profile?.display_name || 'Church member'}</Text><Text style={[styles.memberMeta, { color: colors.textMuted }]}>{profile?.phone_number || 'Active member'} · {count} General role{count === 1 ? '' : 's'}</Text></View>{selected ? <Icon name="checkmark-circle" size={19} color={colors.interactive} /> : <Icon name="chevron-forward" size={17} color={colors.textMuted} />}</Pressable>;
                  })}
                  {!filteredMembers.length ? <EmptyState title="No matching members" message="Try a different name or phone number." iconName="people-outline" /> : null}
                </View>
              </View>

              <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <SectionHeader title="General roles" badge={roles.length} subtitle={selectedMembership ? `Access for ${selectedProfile?.display_name || 'selected member'}` : 'Choose a member first'} actionLabel={canManage ? 'Create' : undefined} onAction={canManage ? () => setRoleComposerOpen(true) : undefined} />
                {selectedMembership ? roles.map((role) => {
                  const enabled = activeRoleIds.has(role.id);
                  const owner = role.code === 'owner';
                  return <View key={role.id} style={[styles.roleRow, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.flex}><View style={styles.roleHeading}><Text style={[styles.roleName, { color: colors.text }]}>{role.name}</Text>{role.is_system ? <Badge label="SYSTEM" variant="neutral" /> : <Badge label="CUSTOM" variant="primary" />}{enabled ? <Badge label="ASSIGNED" variant="active" /> : null}</View><Text style={[styles.roleDescription, { color: colors.textSecondary }]}>{role.description || role.code}</Text></View><Button label={enabled ? (owner ? 'Protected' : 'Remove') : 'Assign'} size="sm" variant={enabled ? 'outline' : 'primary'} disabled={!canAssign || owner && enabled || Boolean(busyKey)} loading={busyKey === `role:${role.id}`} onPress={() => void (enabled ? revokeRole(role) : assignRole(role))} /></View>;
                }) : <EmptyState title="Select a member" message="Their General COT roles and operator access will appear here." iconName="person-circle-outline" />}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomSheet visible={roleComposerOpen} onClose={() => { if (!busyKey) setRoleComposerOpen(false); }} title="Create General COT role" subtitle="Reusable operator permissions" maxHeightPercent={95}>
        <View style={styles.form}>
          <Text style={[styles.fieldTitle, { color: colors.textSecondary }]}>START FROM A PRESET</Text>
          <View style={styles.chips}>{rolePresets.map((preset) => <Chip key={preset.key} label={preset.name} selected={roleCode === preset.key} onPress={() => applyPreset(preset.key)} />)}</View>
          <InputField label="Role name" value={roleName} onChangeText={setRoleName} placeholder="General Content Operator" />
          <InputField label="Role code" value={roleCode} onChangeText={setRoleCode} autoCapitalize="none" placeholder="general_content_operator" helperText="Stable internal code; lowercase letters, numbers and underscores work best." />
          <InputField label="Description" value={roleDescription} onChangeText={setRoleDescription} multiline numberOfLines={3} placeholder="What this operator is responsible for" />
          <Text style={[styles.fieldTitle, { color: colors.textSecondary }]}>PERMISSIONS</Text>
          <View style={styles.permissionList}>{assignablePermissions.map((permission) => {
            const selected = selectedPermissions.includes(permission.code);
            return <Pressable key={permission.code} onPress={() => setSelectedPermissions((current) => selected ? current.filter((code) => code !== permission.code) : [...current, permission.code])} style={[styles.permissionRow, { backgroundColor: selected ? colors.primarySoft : colors.bgSecondary, borderColor: selected ? colors.interactive : colors.borderSubtle }]}><View style={styles.flex}><Text style={[styles.permissionName, { color: colors.text }]}>{permission.name}</Text><Text style={[styles.permissionMeta, { color: colors.textMuted }]}>{permission.category} · {permission.code}</Text></View><Icon name={selected ? 'checkbox' : 'square-outline'} size={20} color={selected ? colors.interactive : colors.textMuted} /></Pressable>;
          })}</View>
          <Button label="Create role" fullWidth size="lg" loading={busyKey === 'create-role'} disabled={!roleName.trim() || !roleCode.trim() || Boolean(busyKey && busyKey !== 'create-role')} onPress={() => void createRole()} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, content: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  scopeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, scopeTitle: { fontSize: 14, fontWeight: '900' }, scopeText: { fontSize: 11.5, lineHeight: 18, marginTop: 2 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, panel: { flex: 1, minWidth: 310, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, memberList: { gap: spacing.xs }, memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm }, memberName: { fontSize: 13.5, fontWeight: '800' }, memberMeta: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, roleHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }, roleName: { fontSize: 13.5, fontWeight: '900' }, roleDescription: { fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  form: { gap: spacing.md }, fieldTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, permissionList: { gap: spacing.xs }, permissionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm }, permissionName: { fontSize: 12.5, fontWeight: '800' }, permissionMeta: { fontSize: 9.5, lineHeight: 14, marginTop: 2 },
});

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type Role = { id: string; code: string; name: string; description: string; is_system: boolean };
type Invitation = { id: string; target_email: string; organization_role_id: string; message: string; status: string; expires_at: string; created_at: string };
type InvitePayload = { invitations: Invitation[]; roles: Role[] };
type Ownership = {
  branch_id: string;
  owner_profile_id: string;
  isCurrentOwner: boolean;
  transferred_at?: string | null;
  owner: { id: string; display_name?: string | null; avatar_url?: string | null; email?: string | null };
};

export default function ExpressionGovernanceScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const expressionName = context?.expression?.name ?? 'Expression';

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [retainPreviousAdmin, setRetainPreviousAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const governance = useResource<InvitePayload>('expression:governance:roles', (signal) => api.request<InvitePayload>('expression-role-invitations', { signal }));
  const ownership = useResource<Ownership>('expression:governance:ownership', (signal) => api.request<Ownership>('expression-ownership', { signal }));

  const roles = governance.data?.roles ?? [];
  const invitations = governance.data?.invitations ?? [];
  const pending = useMemo(() => invitations.filter((item) => item.status === 'pending'), [invitations]);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;

  const sendInvitation = async () => {
    if (!email.trim() || !selectedRole) { setErrorMsg('Enter the registered user email and choose the Expression role being offered.'); return; }
    setBusy(true); setErrorMsg(''); setFeedback('');
    try {
      await api.request('expression-role-invitations', { method: 'POST', body: JSON.stringify({ email: email.trim(), roleId: selectedRole.id, message: message.trim() }) });
      setFeedback(`Invitation sent for the ${selectedRole.name} role. No authority is granted until the user accepts it in Notifications.`);
      setEmail(''); setMessage('');
      governance.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to send Expression role invitation.');
    } finally { setBusy(false); }
  };

  const revokeInvitation = async (invitationId: string) => {
    setBusy(true); setErrorMsg(''); setFeedback('');
    try {
      await api.request('expression-role-invitations', { method: 'DELETE', body: JSON.stringify({ invitationId }) });
      setFeedback('Invitation revoked.'); governance.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to revoke invitation.');
    } finally { setBusy(false); }
  };

  const transferOwnership = async () => {
    if (!transferEmail.trim()) { setErrorMsg('Enter the registered email of the new Expression owner.'); return; }
    setBusy(true); setErrorMsg(''); setFeedback('');
    try {
      await api.request('expression-ownership', { method: 'POST', body: JSON.stringify({ email: transferEmail.trim(), retainPreviousAdmin }) });
      setFeedback('Expression ownership transferred successfully.');
      setTransferEmail(''); ownership.refresh(); governance.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to transfer Expression ownership.');
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }}>
        <ScreenHeader title="Expression Access & Ownership" subtitle={`Manage role invitations and accountable ownership for ${expressionName}.`} showBack />
        <View style={styles.body}>
          {feedback ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{feedback}</Text></View> : null}
          {errorMsg ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}><Icon name="person-add-outline" size={20} color={colors.interactive} /><Text style={[styles.cardTitle, { color: colors.text }]}>Invite a User into this Expression</Text></View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>Choose exactly which role is being offered. The invitee must Accept or Decline from Notifications; the role is never silently assigned.</Text>
            <InputField label="Registered User Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ROLE OFFERED</Text>
            {governance.loading ? <Skeleton height={38} count={2} /> : governance.error && !governance.data ? <ResourceError message={governance.error} retry={governance.refresh} /> : roles.length ? (
              <View style={styles.chips}>{roles.map((role) => <Chip key={role.id} label={role.name} selected={(selectedRoleId ?? roles[0]?.id) === role.id} onPress={() => setSelectedRoleId(role.id)} />)}</View>
            ) : <EmptyState title="No assignable Expression roles" message="No Expression-scoped roles are available yet." iconName="shield-outline" />}
            {selectedRole?.description ? <Text style={[styles.helper, { color: colors.textMuted }]}>{selectedRole.description}</Text> : null}
            <InputField label="Invitation Message (Optional)" value={message} onChangeText={setMessage} multiline numberOfLines={3} placeholder="Explain the responsibility being offered." />
            <Button label="Send Role Invitation" onPress={sendInvitation} loading={busy} disabled={!roles.length} variant="primary" size="md" />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Pending Role Invitations" badge={pending.length} />
            {governance.loading ? <Skeleton height={84} count={2} /> : pending.length ? pending.map((invite) => {
              const role = roles.find((item) => item.id === invite.organization_role_id);
              return <View key={invite.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{invite.target_email}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{role?.name ?? 'Expression role'} · expires {new Date(invite.expires_at).toLocaleDateString()}</Text></View>
                <Button label="Revoke" variant="outline" size="sm" disabled={busy} onPress={() => void revokeInvitation(invite.id)} />
              </View>;
            }) : <Text style={[styles.helper, { color: colors.textMuted }]}>No pending role invitations.</Text>}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}><Icon name="key-outline" size={20} color={colors.interactive} /><Text style={[styles.cardTitle, { color: colors.text }]}>Expression Ownership</Text></View>
            {ownership.loading ? <Skeleton height={90} /> : ownership.error && !ownership.data ? <ResourceError message={ownership.error} retry={ownership.refresh} /> : ownership.data ? (
              <>
                <View style={styles.ownerRow}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{ownership.data.owner.display_name || ownership.data.owner.email || 'Current owner'}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{ownership.data.owner.email || 'Registered COT account'}</Text></View><Badge label="OWNER" variant="primary" /></View>
                {ownership.data.isCurrentOwner ? (
                  <>
                    <Text style={[styles.helper, { color: colors.textSecondary }]}>Transfer ownership only when responsibility for this Expression changes. The new owner receives Expression Admin authority automatically.</Text>
                    <InputField label="New Owner Email" value={transferEmail} onChangeText={setTransferEmail} keyboardType="email-address" autoCapitalize="none" placeholder="newowner@example.com" />
                    <View style={styles.chips}><Chip label="Remove my Expression Admin role" selected={!retainPreviousAdmin} onPress={() => setRetainPreviousAdmin(false)} /><Chip label="Keep me as an Expression Admin" selected={retainPreviousAdmin} onPress={() => setRetainPreviousAdmin(true)} /></View>
                    <Button label="Transfer Expression Ownership" onPress={transferOwnership} loading={busy} variant="outline" size="md" />
                  </>
                ) : <Text style={[styles.helper, { color: colors.textMuted }]}>Only the current Expression owner can initiate an ownership transfer.</Text>}
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, body: { paddingHorizontal: spacing.lg, gap: spacing.lg }, section: { gap: spacing.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }, bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, cardTitle: { fontSize: 16, fontWeight: '800' }, helper: { fontSize: 12, lineHeight: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }, rowTitle: { fontSize: 14, fontWeight: '800' }, rowMeta: { fontSize: 11, marginTop: 3 }, ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

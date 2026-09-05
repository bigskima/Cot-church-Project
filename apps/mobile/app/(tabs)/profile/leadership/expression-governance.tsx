import React, { useMemo, useState } from 'react';
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
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type Role = { id: string; code: string; name: string; description: string; is_system: boolean };
type Invitation = {
  id: string;
  target_email: string;
  organization_role_id: string;
  message: string;
  status: string;
  expires_at: string;
  created_at: string;
};
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
  const expression = context?.expression;
  const expressionName = expression?.name ?? 'Expression';

  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [retainPreviousAdmin, setRetainPreviousAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const governance = useResource<InvitePayload>(
    `expression:governance:roles:${expression?.id ?? 'none'}`,
    (signal) => (expression?.id ? api.request<InvitePayload>('expression-role-invitations', { signal }) : Promise.resolve({ invitations: [], roles: [] })),
  );
  const ownership = useResource<Ownership | null>(
    `expression:governance:ownership:${expression?.id ?? 'none'}`,
    (signal) => (expression?.id ? api.request<Ownership>('expression-ownership', { signal }) : Promise.resolve(null)),
  );

  const roles = governance.data?.roles ?? [];
  const invitations = governance.data?.invitations ?? [];
  const pending = useMemo(() => invitations.filter((item) => item.status === 'pending'), [invitations]);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;

  if (!expression?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Expression governance" kicker="LEADERSHIP" showBack />
        <View style={styles.emptyPad}>
          <EmptyState title="Enter an Expression first" message="Role invitations and ownership belong to the active Expression." iconName="shield-outline" />
        </View>
      </View>
    );
  }

  const openInvite = () => {
    setEmail('');
    setMessage('');
    setSelectedRoleId(roles[0]?.id ?? null);
    setErrorMsg('');
    setInviteOpen(true);
  };

  const openTransfer = () => {
    setTransferEmail('');
    setRetainPreviousAdmin(false);
    setErrorMsg('');
    setTransferOpen(true);
  };

  const sendInvitation = async () => {
    if (!email.trim() || !selectedRole) {
      setErrorMsg('Enter the registered user email and choose the Expression role being offered.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setFeedback('');
    try {
      await api.request('expression-role-invitations', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), roleId: selectedRole.id, message: message.trim() }),
      });
      setFeedback(`Invitation sent for the ${selectedRole.name} role. Authority starts only after the user accepts it in Notifications.`);
      setInviteOpen(false);
      await governance.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to send Expression role invitation.');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    setBusy(true);
    setErrorMsg('');
    setFeedback('');
    try {
      await api.request('expression-role-invitations', {
        method: 'DELETE',
        body: JSON.stringify({ invitationId }),
      });
      setFeedback('Invitation revoked.');
      await governance.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to revoke invitation.');
    } finally {
      setBusy(false);
    }
  };

  const transferOwnership = async () => {
    if (!transferEmail.trim()) {
      setErrorMsg('Enter the registered email of the new Expression owner.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setFeedback('');
    try {
      await api.request('expression-ownership', {
        method: 'POST',
        body: JSON.stringify({ email: transferEmail.trim(), retainPreviousAdmin }),
      });
      setFeedback('Expression ownership transferred successfully.');
      setTransferOpen(false);
      await Promise.all([ownership.refresh(), governance.refresh()]);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to transfer Expression ownership.');
    } finally {
      setBusy(false);
    }
  };

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
            title="Access & ownership"
            kicker="EXPRESSION GOVERNANCE"
            subtitle={`Roles, invitations and accountable ownership for ${expressionName}.`}
            showBack
            rightAction={<Button label="Invite" onPress={openInvite} size="sm" />}
          />
        </View>

        <View style={styles.body}>
          {feedback ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{feedback}</Text>
            </View>
          ) : null}
          {errorMsg && !inviteOpen && !transferOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.ownerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.ownerIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="key-outline" size={21} color={colors.interactive} />
            </View>
            {ownership.loading ? (
              <View style={styles.flex}><Skeleton height={50} /></View>
            ) : ownership.error && !ownership.data ? (
              <View style={styles.flex}><ResourceError message={ownership.error} retry={ownership.refresh} /></View>
            ) : ownership.data ? (
              <>
                <View style={styles.flex}>
                  <Text style={[styles.ownerLabel, { color: colors.textMuted }]}>EXPRESSION OWNER</Text>
                  <Text style={[styles.ownerName, { color: colors.text }]}>
                    {ownership.data.owner.display_name || ownership.data.owner.email || 'Current owner'}
                  </Text>
                  <Text style={[styles.ownerEmail, { color: colors.textSecondary }]}>
                    {ownership.data.owner.email || 'Registered COT account'}
                  </Text>
                </View>
                <Badge label="OWNER" variant="primary" />
                {ownership.data.isCurrentOwner ? <Button label="Transfer" onPress={openTransfer} variant="outline" size="sm" /> : null}
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Pending invitations" badge={pending.length} subtitle="Roles activate only after acceptance" actionLabel="Invite" onAction={openInvite} />
            {governance.loading ? (
              <Skeleton height={86} count={2} />
            ) : governance.error && !governance.data ? (
              <ResourceError message={governance.error} retry={governance.refresh} />
            ) : pending.length ? (
              pending.map((invite) => {
                const role = roles.find((item) => item.id === invite.organization_role_id);
                return (
                  <View key={invite.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                    <View style={[styles.inviteIcon, { backgroundColor: colors.primarySoft }]}>
                      <Icon name="person-add-outline" size={18} color={colors.interactive} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{invite.target_email}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                        {role?.name ?? 'Expression role'} · expires {new Date(invite.expires_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Button label="Revoke" variant="outline" size="sm" disabled={busy} onPress={() => void revokeInvitation(invite.id)} />
                  </View>
                );
              })
            ) : (
              <EmptyState title="No pending invitations" message="Invite a trusted member when a role needs to be assigned." iconName="person-add-outline" actionLabel="Invite member" onAction={openInvite} />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={inviteOpen}
        onClose={() => !busy && setInviteOpen(false)}
        title="Invite to a role"
        subtitle={`Inside ${expressionName}`}
        maxHeightPercent={92}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField label="Registered user email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ROLE OFFERED</Text>
          {governance.loading ? (
            <Skeleton height={38} count={2} />
          ) : roles.length ? (
            <View style={styles.chips}>
              {roles.map((role) => (
                <Chip
                  key={role.id}
                  label={role.name}
                  selected={(selectedRoleId ?? roles[0]?.id) === role.id}
                  onPress={() => setSelectedRoleId(role.id)}
                />
              ))}
            </View>
          ) : (
            <EmptyState title="No assignable Expression roles" message="No Expression-scoped roles are available yet." iconName="shield-outline" />
          )}
          {selectedRole?.description ? <Text style={[styles.helper, { color: colors.textMuted }]}>{selectedRole.description}</Text> : null}
          <InputField label="Invitation message (optional)" value={message} onChangeText={setMessage} multiline numberOfLines={3} placeholder="Explain the responsibility being offered." />
          <Button label="Send invitation" onPress={() => void sendInvitation()} loading={busy} disabled={!roles.length} size="lg" fullWidth />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={transferOpen}
        onClose={() => !busy && setTransferOpen(false)}
        title="Transfer ownership"
        subtitle={`Transfer accountable ownership of ${expressionName}.`}
        maxHeightPercent={88}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.warningCard, { backgroundColor: colors.warningSoft }]}>
            <Icon name="warning-outline" size={18} color={colors.warning} />
            <Text style={[styles.helper, { color: colors.textSecondary }]}>The new owner receives Expression Admin authority automatically. Use this only when responsibility truly changes.</Text>
          </View>

          <InputField label="New owner email" value={transferEmail} onChangeText={setTransferEmail} keyboardType="email-address" autoCapitalize="none" placeholder="newowner@example.com" />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>YOUR ROLE AFTER TRANSFER</Text>
          <View style={styles.chips}>
            <Chip label="Remove my admin role" selected={!retainPreviousAdmin} onPress={() => setRetainPreviousAdmin(false)} />
            <Chip label="Keep me as admin" selected={retainPreviousAdmin} onPress={() => setRetainPreviousAdmin(true)} />
          </View>
          <Button label="Transfer ownership" onPress={() => void transferOwnership()} loading={busy} variant="destructive" size="lg" fullWidth />
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
  emptyPad: { paddingHorizontal: spacing.md },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  ownerIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  ownerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  ownerName: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  ownerEmail: { fontSize: 11, marginTop: 1 },
  section: { gap: spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  inviteIcon: { width: 38, height: 38, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowMeta: { fontSize: 11, marginTop: 3 },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helper: { fontSize: 12, lineHeight: 18 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
});

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, EmptyState, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type GovernanceInvitation = {
  id: string;
  kind: 'platform_role' | 'expression_role';
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expires_at: string;
  expression?: { id: string; name: string; code: string } | null;
  role?: { code: string; name: string } | null;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read_at?: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const invitations = useResource<GovernanceInvitation[]>('governance:inbox', (signal) => {
    if (mode !== 'authenticated') return Promise.resolve([]);
    return api.request<GovernanceInvitation[]>('governance-invitations', { signal });
  });
  const notifications = useResource<NotificationItem[]>('notifications:inbox', (signal) => {
    if (mode !== 'authenticated' || !context?.organization?.id) return Promise.resolve([]);
    return api.request<NotificationItem[]>('notifications', { signal });
  });
  const pending = useMemo(() => (invitations.data ?? []).filter((item) => item.status === 'pending'), [invitations.data]);
  const history = useMemo(() => (invitations.data ?? []).filter((item) => item.status !== 'pending'), [invitations.data]);

  const respond = async (invitationId: string, decision: 'accept' | 'decline') => {
    setBusyId(invitationId);
    setMessage('');
    try {
      await api.request('governance-invitations', { method: 'POST', body: JSON.stringify({ invitationId, decision }) });
      setMessage(decision === 'accept' ? 'Invitation accepted.' : 'Invitation declined.');
      invitations.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to respond to invitation.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 130 }}>
        <ScreenHeader title="Notifications" kicker="INBOX" subtitle="Invitations, updates and actions that need your attention." showBack />
        <View style={styles.body}>
          {message ? <View style={[styles.message, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.messageText, { color: colors.text }]}>{message}</Text></View> : null}
          <View style={styles.section}>
            <SectionHeader title="Invitations" badge={pending.length} />
            {invitations.loading ? <Skeleton height={132} count={2} /> : invitations.error && !invitations.data ? (
              <ResourceError message={invitations.error} retry={invitations.refresh} />
            ) : pending.length ? pending.map((invite) => (
              <View key={invite.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}><Icon name={invite.kind === 'platform_role' ? 'shield-checkmark-outline' : 'people-outline'} size={20} color={colors.interactive} /></View>
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.title, { color: colors.text }]}>{invite.kind === 'platform_role' ? 'Platform administration invitation' : 'Expression role invitation'}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{invite.role?.name ?? 'Role invitation'}{invite.expression?.name ? ` · ${invite.expression.name}` : ''}</Text>
                  </View>
                  <Badge label="PENDING" variant="primary" />
                </View>
                {invite.message ? <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{invite.message}</Text> : null}
                <Text style={[styles.meta, { color: colors.textMuted }]}>Expires {new Date(invite.expires_at).toLocaleString()}</Text>
                <View style={styles.actions}>
                  <Button label="Decline" variant="outline" size="sm" disabled={busyId === invite.id} onPress={() => void respond(invite.id, 'decline')} />
                  <Button label="Accept" variant="primary" size="sm" loading={busyId === invite.id} onPress={() => void respond(invite.id, 'accept')} />
                </View>
              </View>
            )) : <EmptyState title="No invitations waiting" message="Role and administration invitations that need your decision will appear here." iconName="mail-open-outline" />}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Church notifications" badge={notifications.data?.length ?? 0} />
            {notifications.loading ? <Skeleton height={86} count={2} /> : notifications.error && !notifications.data ? (
              <ResourceError message={notifications.error} retry={notifications.refresh} />
            ) : notifications.data?.length ? notifications.data.map((item) => (
              <View key={item.id} style={[styles.notice, { backgroundColor: colors.card, borderColor: item.read_at ? colors.borderSubtle : colors.interactive }, shadows.sm]}>
                <View style={styles.noticeTitleRow}>
                  {!item.read_at ? <View style={[styles.unreadDot, { backgroundColor: colors.interactive }]} /> : null}
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                </View>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{item.body}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            )) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>No church notifications yet.</Text>}
          </View>

          {history.length ? <View style={styles.section}>
            <SectionHeader title="Invitation history" badge={history.length} />
            {history.map((invite) => <View key={invite.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.text }]}>{invite.role?.name ?? 'Invitation'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{invite.expression?.name ?? 'Platform'}</Text></View>
              <Badge label={invite.status.toUpperCase()} variant={invite.status === 'accepted' ? 'success' : 'neutral'} />
            </View>)}
          </View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.xl }, section: { gap: spacing.sm },
  message: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md }, messageText: { fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, cardHeaderText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800' }, bodyText: { fontSize: 13, lineHeight: 19 }, meta: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  notice: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 5 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1 }, emptyText: { fontSize: 13 },
});

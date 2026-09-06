import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, EmptyState, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type GovernanceInvitation = {
  id: string;
  organization_id?: string | null;
  branch_id?: string | null;
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

type InboxView = 'actions' | 'updates' | 'history';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context, auth, selectContext } = useSession();
  const { colors } = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeView, setActiveView] = useState<InboxView>('actions');

  const invitations = useResource<GovernanceInvitation[]>(`governance:inbox:${mode}`, (signal) => {
    if (mode !== 'authenticated') return Promise.resolve([]);
    return api.request<GovernanceInvitation[]>('governance-invitations', { signal });
  });
  const notifications = useResource<NotificationItem[]>(`notifications:inbox:${mode}:${context?.organization?.id ?? 'none'}`, (signal) => {
    if (mode !== 'authenticated' || !context?.organization?.id) return Promise.resolve([]);
    return api.request<NotificationItem[]>('notifications', { signal });
  });

  const pending = useMemo(() => (invitations.data ?? []).filter((item) => item.status === 'pending'), [invitations.data]);
  const history = useMemo(() => (invitations.data ?? []).filter((item) => item.status !== 'pending'), [invitations.data]);
  const unread = useMemo(() => (notifications.data ?? []).filter((item) => !item.read_at), [notifications.data]);

  const respond = async (invitation: GovernanceInvitation, decision: 'accept' | 'decline') => {
    setBusyId(invitation.id);
    setMessage('');
    try {
      await api.request('governance-invitations', {
        method: 'POST',
        body: JSON.stringify({ invitationId: invitation.id, decision }),
      });
      setMessage(decision === 'accept' ? 'Invitation accepted. Your access has been refreshed.' : 'Invitation declined.');
      await invitations.refresh();

      if (decision === 'accept') {
        const organizationId = invitation.kind === 'expression_role'
          ? invitation.organization_id ?? auth?.organizationId ?? undefined
          : auth?.organizationId ?? invitation.organization_id ?? undefined;
        if (organizationId) {
          const preserveBranch =
            invitation.kind !== 'expression_role' &&
            auth?.organizationId === organizationId
              ? auth.branchId
              : undefined;
          await selectContext(organizationId, preserveBranch);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to respond to invitation.');
    } finally {
      setBusyId(null);
    }
  };

  const markRead = async (item: NotificationItem) => {
    if (item.read_at || busyNotificationId === item.id) return;
    setBusyNotificationId(item.id);
    try {
      await api.request('notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, read: true }),
      });
      await notifications.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update this notification.');
    } finally {
      setBusyNotificationId(null);
    }
  };

  const views: Array<{ key: InboxView; label: string; icon: string; count: number }> = [
    { key: 'actions', label: 'Actions', icon: 'flash-outline', count: pending.length },
    { key: 'updates', label: 'Updates', icon: 'notifications-outline', count: unread.length },
    { key: 'history', label: 'History', icon: 'time-outline', count: history.length },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 130 }}
      >
        <ScreenHeader
          title="Notifications"
          kicker="INBOX"
          subtitle="Decisions, church updates and invitation history in one focused workspace."
          showBack
        />

        <View style={styles.body}>
          <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.overviewCopy}>
              <View style={[styles.overviewIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="mail-unread-outline" size={22} color={colors.interactive} />
              </View>
              <View style={styles.overviewText}>
                <Text style={[styles.overviewTitle, { color: colors.text }]}>Your church inbox</Text>
                <Text style={[styles.overviewSubtitle, { color: colors.textSecondary }]}>
                  Open only the section you need instead of scrolling through every inbox type.
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <Pressable
                onPress={() => setActiveView('actions')}
                style={({ pressed }) => [
                  styles.metric,
                  { backgroundColor: activeView === 'actions' ? colors.primarySoft : colors.bgSecondary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${pending.length} pending actions`}
              >
                <Text style={[styles.metricValue, { color: activeView === 'actions' ? colors.interactive : colors.text }]}>{pending.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Need action</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveView('updates')}
                style={({ pressed }) => [
                  styles.metric,
                  { backgroundColor: activeView === 'updates' ? colors.primarySoft : colors.bgSecondary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${unread.length} unread updates`}
              >
                <Text style={[styles.metricValue, { color: activeView === 'updates' ? colors.interactive : colors.text }]}>{unread.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Unread</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveView('history')}
                style={({ pressed }) => [
                  styles.metric,
                  { backgroundColor: activeView === 'history' ? colors.primarySoft : colors.bgSecondary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${history.length} invitation history items`}
              >
                <Text style={[styles.metricValue, { color: activeView === 'history' ? colors.interactive : colors.text }]}>{history.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>History</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.segmented, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            {views.map((view) => {
              const selected = activeView === view.key;
              return (
                <Pressable
                  key={view.key}
                  onPress={() => setActiveView(view.key)}
                  style={({ pressed }) => [
                    styles.segment,
                    selected && { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Icon name={view.icon} size={16} color={selected ? colors.interactive : colors.textMuted} />
                  <Text style={[styles.segmentLabel, { color: selected ? colors.text : colors.textSecondary }]}>{view.label}</Text>
                  {view.count > 0 ? (
                    <View style={[styles.segmentCount, { backgroundColor: selected ? colors.primarySoft : colors.cardElevated }]}>
                      <Text style={[styles.segmentCountText, { color: selected ? colors.interactive : colors.textMuted }]}>{view.count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {message ? (
            <Pressable
              onPress={() => setMessage('')}
              style={({ pressed }) => [
                styles.message,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                shadows.sm,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss status message"
            >
              <View style={[styles.messageIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="information-circle-outline" size={17} color={colors.interactive} />
              </View>
              <Text style={[styles.messageText, { color: colors.text }]}>{message}</Text>
              <Icon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {activeView === 'actions' ? (
            <View style={styles.section}>
              <SectionHeader title="Actions waiting for you" badge={pending.length} subtitle="Accept or decline role invitations without leaving this inbox." />
              {invitations.loading ? <Skeleton height={148} count={2} /> : invitations.error && !invitations.data ? (
                <ResourceError message={invitations.error} retry={invitations.refresh} />
              ) : pending.length ? pending.map((invite) => (
                <View key={invite.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                      <Icon name={invite.kind === 'platform_role' ? 'shield-checkmark-outline' : 'people-outline'} size={20} color={colors.interactive} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={[styles.title, { color: colors.text }]}>
                        {invite.kind === 'platform_role' ? 'Platform administration invitation' : 'Expression role invitation'}
                      </Text>
                      <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        {invite.role?.name ?? 'Role invitation'}{invite.expression?.name ? ` · ${invite.expression.name}` : ''}
                      </Text>
                    </View>
                    <Badge label="PENDING" variant="primary" />
                  </View>

                  {invite.message ? (
                    <View style={[styles.inviteMessage, { backgroundColor: colors.bgSecondary }]}>
                      <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{invite.message}</Text>
                    </View>
                  ) : null}

                  <View style={styles.expiryRow}>
                    <Icon name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.meta, { color: colors.textMuted }]}>Expires {new Date(invite.expires_at).toLocaleString()}</Text>
                  </View>

                  <View style={styles.actions}>
                    <Button
                      label="Decline"
                      variant="outline"
                      size="sm"
                      disabled={busyId === invite.id}
                      onPress={() => void respond(invite, 'decline')}
                    />
                    <Button
                      label="Accept invitation"
                      variant="primary"
                      size="sm"
                      loading={busyId === invite.id}
                      onPress={() => void respond(invite, 'accept')}
                    />
                  </View>
                </View>
              )) : (
                <EmptyState
                  title="Nothing needs your decision"
                  message="New role and administration invitations will appear here when they need your action."
                  iconName="checkmark-circle-outline"
                />
              )}
            </View>
          ) : null}

          {activeView === 'updates' ? (
            <View style={styles.section}>
              <SectionHeader
                title="Church updates"
                badge={notifications.data?.length ?? 0}
                subtitle={unread.length ? `${unread.length} unread update${unread.length === 1 ? '' : 's'}` : 'You are all caught up'}
              />
              {notifications.loading ? <Skeleton height={98} count={3} /> : notifications.error && !notifications.data ? (
                <ResourceError message={notifications.error} retry={notifications.refresh} />
              ) : notifications.data?.length ? notifications.data.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void markRead(item)}
                  disabled={Boolean(item.read_at) || busyNotificationId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.read_at ? item.title : `${item.title}. Mark as read`}
                  style={({ pressed }) => [
                    styles.notice,
                    {
                      backgroundColor: colors.card,
                      borderColor: item.read_at ? colors.borderSubtle : colors.interactive,
                    },
                    shadows.sm,
                    pressed && !item.read_at && styles.noticePressed,
                  ]}
                >
                  <View style={[
                    styles.noticeIcon,
                    { backgroundColor: item.read_at ? colors.bgSecondary : colors.primarySoft },
                  ]}>
                    <Icon
                      name={item.read_at ? 'notifications-outline' : 'notifications'}
                      size={18}
                      color={item.read_at ? colors.textMuted : colors.interactive}
                    />
                  </View>
                  <View style={styles.noticeBody}>
                    <View style={styles.noticeTitleRow}>
                      <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                      {!item.read_at ? <View style={[styles.unreadDot, { backgroundColor: colors.interactive }]} /> : null}
                    </View>
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{item.body}</Text>
                    <View style={styles.noticeMetaRow}>
                      <Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
                      {!item.read_at ? <Text style={[styles.markReadHint, { color: colors.interactive }]}>Tap to mark read</Text> : null}
                    </View>
                  </View>
                </Pressable>
              )) : (
                <EmptyState
                  title="No church updates yet"
                  message="Announcements and account notifications from your church will appear here."
                  iconName="notifications-off-outline"
                />
              )}
            </View>
          ) : null}

          {activeView === 'history' ? (
            <View style={styles.section}>
              <SectionHeader title="Invitation history" badge={history.length} subtitle="A compact record of invitations you already handled." />
              {invitations.loading ? <Skeleton height={78} count={3} /> : invitations.error && !invitations.data ? (
                <ResourceError message={invitations.error} retry={invitations.refresh} />
              ) : history.length ? history.map((invite) => (
                <View key={invite.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  <View style={[styles.historyIcon, { backgroundColor: colors.bgSecondary }]}>
                    <Icon name="time-outline" size={17} color={colors.textMuted} />
                  </View>
                  <View style={styles.historyCopy}>
                    <Text style={[styles.title, { color: colors.text }]}>{invite.role?.name ?? 'Invitation'}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>{invite.expression?.name ?? 'Platform'}</Text>
                  </View>
                  <Badge label={invite.status.toUpperCase()} variant={invite.status === 'accepted' ? 'success' : 'neutral'} />
                </View>
              )) : (
                <EmptyState
                  title="No invitation history"
                  message="Invitations you accept, decline, or that expire will be kept here."
                  iconName="archive-outline"
                />
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  overviewCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.md, gap: spacing.md },
  overviewCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  overviewIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  overviewText: { flex: 1, minWidth: 0 },
  overviewTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  overviewSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, minHeight: 72, borderRadius: radius.xl, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, justifyContent: 'center' },
  metricValue: { fontSize: 22, lineHeight: 24, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.xl, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7 },
  segmentLabel: { fontSize: 11, fontWeight: '800' },
  segmentCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentCountText: { fontSize: 10, fontWeight: '900' },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm },
  messageIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  messageText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  section: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.md, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardHeaderText: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  bodyText: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 11, marginTop: 2 },
  inviteMessage: { borderRadius: radius.lg, padding: spacing.sm },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  notice: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  noticeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  noticeBody: { flex: 1, minWidth: 0, gap: 4 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 'auto' },
  noticeMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  markReadHint: { fontSize: 10, fontWeight: '800' },
  noticePressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm },
  historyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});

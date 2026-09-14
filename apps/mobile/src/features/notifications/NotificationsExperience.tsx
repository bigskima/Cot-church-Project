import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Chip, EmptyState, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

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

type NotificationData = {
  scope?: 'general' | 'expression' | string;
  branchId?: string | null;
  entityType?: string;
  entityId?: string;
  route?: string;
  prayerRequestId?: string;
  testimonyId?: string;
  eventId?: string;
  announcementId?: string;
  requiresRoleAssignment?: boolean;
  [key: string]: unknown;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: NotificationData | null;
  read_at?: string | null;
  created_at: string;
};

type InboxView = 'actions' | 'updates' | 'history';
type ScopeView = 'expression' | 'general';

type NotificationsExperienceProps = {
  forcedExpressionId?: string;
  onRespondInvitation?: (invitation: { id: string }, decision: 'accept' | 'decline') => Promise<void>;
  onMarkNotificationRead?: (item: { id: string }) => Promise<void>;
};

function itemScope(item: NotificationItem): ScopeView {
  return item.data?.scope === 'expression' || Boolean(item.data?.branchId) ? 'expression' : 'general';
}

function inferredRoute(item: NotificationItem) {
  const data = item.data ?? {};
  if (typeof data.route === 'string' && data.route.startsWith('/')) return data.route;
  const branchId = typeof data.branchId === 'string' ? data.branchId : '';
  const entityId = typeof data.entityId === 'string' ? data.entityId : '';
  const type = `${item.type} ${data.entityType ?? ''}`.toLowerCase();
  if (type.includes('prayer')) return branchId ? `/expressions/${branchId}/manage/prayer` : '/general/leadership/pastoral-triage';
  if (type.includes('testimon')) return branchId ? `/expressions/${branchId}/manage/testimonies` : '/general/leadership/pastoral-triage';
  if (type.includes('announcement')) return branchId ? `/expressions/${branchId}/announcements` : '/general/announcements';
  if (type.includes('event')) return branchId ? (entityId ? `/expressions/${branchId}/events/${entityId}` : `/expressions/${branchId}/events`) : (entityId ? `/general/event/${entityId}` : '/general/events');
  return branchId ? `/expressions/${branchId}` : '';
}

export function NotificationsExperience({ forcedExpressionId, onRespondInvitation, onMarkNotificationRead }: NotificationsExperienceProps) {
  const insets = useSafeAreaInsets();
  const { api, mode, context, auth, selectContext } = useSession();
  const { colors } = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeView, setActiveView] = useState<InboxView>('updates');
  const [scope, setScope] = useState<ScopeView>(forcedExpressionId ? 'expression' : 'general');
  const organizationId = context?.organization?.id ?? auth?.organizationId ?? '';

  const invitations = useResource<GovernanceInvitation[]>(`governance:inbox:${mode}`, (signal) => {
    if (mode !== 'authenticated') return Promise.resolve([]);
    return api.request<GovernanceInvitation[]>('governance-invitations', { signal });
  });
  const notifications = useResource<NotificationItem[]>(`notifications:inbox:${mode}:${organizationId || 'none'}`, (signal) => {
    if (mode !== 'authenticated' || !organizationId) return Promise.resolve([]);
    return api.request<NotificationItem[]>('notifications', { signal });
  });

  const pending = useMemo(() => (invitations.data ?? []).filter((item) => item.status === 'pending'), [invitations.data]);
  const history = useMemo(() => (invitations.data ?? []).filter((item) => item.status !== 'pending'), [invitations.data]);
  const scopedNotifications = useMemo(() => (notifications.data ?? []).filter((item) => {
    const dataBranch = typeof item.data?.branchId === 'string' ? item.data.branchId : null;
    if (forcedExpressionId) return itemScope(item) === 'expression' && dataBranch === forcedExpressionId;
    return itemScope(item) === scope;
  }), [forcedExpressionId, notifications.data, scope]);
  const unread = scopedNotifications.filter((item) => !item.read_at);

  const expressionName = (branchId?: string | null) => context?.expressions?.find((item) => item.id === branchId)?.name
    ?? (context?.expression?.id === branchId ? context?.expression?.name : undefined)
    ?? 'Expression';

  const respond = async (invitation: GovernanceInvitation, decision: 'accept' | 'decline') => {
    setBusyId(invitation.id); setMessage('');
    try {
      if (onRespondInvitation) await onRespondInvitation(invitation, decision);
      else await api.request('governance-invitations', { method: 'POST', body: JSON.stringify({ invitationId: invitation.id, decision }) });
      setMessage(decision === 'accept' ? 'Invitation accepted. Your access has been refreshed.' : 'Invitation declined.');
      await invitations.refresh();
      if (decision === 'accept') {
        const targetOrganizationId = invitation.organization_id ?? auth?.organizationId ?? undefined;
        if (targetOrganizationId) await selectContext(targetOrganizationId, invitation.kind === 'expression_role' ? invitation.branch_id ?? undefined : undefined);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to respond to invitation.'); }
    finally { setBusyId(null); }
  };

  const markRead = async (item: NotificationItem) => {
    if (item.read_at) return;
    if (onMarkNotificationRead) await onMarkNotificationRead(item);
    else await api.request('notifications', { method: 'PATCH', body: JSON.stringify({ id: item.id, read: true }) });
  };

  const openNotification = async (item: NotificationItem) => {
    if (busyNotificationId === item.id) return;
    setBusyNotificationId(item.id); setMessage('');
    try {
      await markRead(item);
      const branchId = typeof item.data?.branchId === 'string' ? item.data.branchId : '';
      if (branchId && organizationId && context?.expression?.id !== branchId) await selectContext(organizationId, branchId);
      const route = inferredRoute(item);
      await notifications.refresh();
      if (route) router.push(route as any);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open this notification.'); }
    finally { setBusyNotificationId(null); }
  };

  const views: Array<{ key: InboxView; label: string; icon: string; count: number }> = [
    { key: 'updates', label: 'Updates', icon: 'notifications-outline', count: unread.length },
    { key: 'actions', label: 'Invites', icon: 'flash-outline', count: pending.length },
    { key: 'history', label: 'History', icon: 'time-outline', count: history.length },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 130 }}>
        <ScreenHeader title="Notifications" kicker={forcedExpressionId ? 'EXPRESSION INBOX' : 'COT INBOX'} subtitle={forcedExpressionId ? `Updates only from ${expressionName(forcedExpressionId)}.` : 'General COT and Expression updates stay separated but live in one inbox.'} showBack rightAction={<Pressable onPress={() => router.push('/general/notification-settings')} style={[styles.settings, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name="settings-outline" size={19} color={colors.text} /></Pressable>} />

        <View style={styles.body}>
          {!forcedExpressionId ? (
            <View style={[styles.scopeCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <Text style={[styles.scopeTitle, { color: colors.text }]}>Notification scope</Text>
              <Text style={[styles.scopeText, { color: colors.textSecondary }]}>Expression activity never mixes into the General list.</Text>
              <View style={styles.scopeTabs}>
                <Chip label="Expression" icon="people-outline" selected={scope === 'expression'} count={(notifications.data ?? []).filter((item) => itemScope(item) === 'expression' && !item.read_at).length} onPress={() => { setScope('expression'); setActiveView('updates'); }} />
                <Chip label="General" icon="globe-outline" selected={scope === 'general'} count={(notifications.data ?? []).filter((item) => itemScope(item) === 'general' && !item.read_at).length} onPress={() => { setScope('general'); setActiveView('updates'); }} />
              </View>
            </View>
          ) : null}

          <View style={[styles.segmented, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            {views.map((view) => {
              const selected = activeView === view.key;
              return <Pressable key={view.key} onPress={() => setActiveView(view.key)} accessibilityRole="tab" accessibilityState={{ selected }} style={[styles.segment, selected && { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name={view.icon as any} size={15} color={selected ? colors.interactive : colors.textMuted} /><Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>{view.label}</Text>{view.count ? <View style={[styles.count, { backgroundColor: colors.primarySoft }]}><Text style={[styles.countText, { color: colors.interactive }]}>{view.count}</Text></View> : null}</Pressable>;
            })}
          </View>

          {message ? <Pressable onPress={() => setMessage('')} style={[styles.message, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name="information-circle-outline" size={17} color={colors.interactive} /><Text style={[styles.messageText, { color: colors.text }]}>{message}</Text><Icon name="close" size={15} color={colors.textMuted} /></Pressable> : null}

          {activeView === 'updates' ? (
            <View style={styles.section}>
              <SectionHeader title={forcedExpressionId ? 'Expression updates' : scope === 'expression' ? 'Expression updates' : 'General COT updates'} badge={scopedNotifications.length} subtitle={unread.length ? `${unread.length} unread` : 'You are all caught up'} />
              {notifications.loading ? <Skeleton height={94} count={4} /> : notifications.error && !notifications.data ? <ResourceError message={notifications.error} retry={notifications.refresh} /> : scopedNotifications.length ? scopedNotifications.map((item) => {
                const branchId = typeof item.data?.branchId === 'string' ? item.data.branchId : null;
                const hasRoute = Boolean(inferredRoute(item));
                return (
                  <Pressable key={item.id} onPress={() => void openNotification(item)} disabled={busyNotificationId === item.id} style={({ pressed }) => [styles.notice, { backgroundColor: colors.card, borderColor: item.read_at ? colors.borderSubtle : colors.interactive }, shadows.sm, pressed && styles.pressed]} accessibilityRole="button">
                    <View style={[styles.noticeIcon, { backgroundColor: item.read_at ? colors.bgSecondary : colors.primarySoft }]}><Icon name={item.type.includes('prayer') ? 'heart-outline' : item.type.includes('testimon') ? 'sparkles-outline' : item.type.includes('event') ? 'calendar-outline' : item.type.includes('announcement') ? 'megaphone-outline' : 'notifications-outline'} size={18} color={item.read_at ? colors.textMuted : colors.interactive} /></View>
                    <View style={styles.flex}>
                      <View style={styles.noticeTitleRow}><Text style={[styles.noticeTitle, { color: colors.text }]}>{item.title}</Text>{!item.read_at ? <View style={[styles.dot, { backgroundColor: colors.interactive }]} /> : null}</View>
                      {branchId ? <Text style={[styles.scopeLabel, { color: colors.interactive }]}>{expressionName(branchId)}</Text> : <Text style={[styles.scopeLabel, { color: colors.textMuted }]}>General COT</Text>}
                      <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{item.body}</Text>
                      <Text style={[styles.noticeMeta, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleString()}{hasRoute ? ' · Tap to open' : !item.read_at ? ' · Tap to mark read' : ''}</Text>
                    </View>
                    {hasRoute ? <Icon name="chevron-forward" size={17} color={colors.textMuted} /> : null}
                  </Pressable>
                );
              }) : <EmptyState title={scope === 'expression' ? 'No Expression notifications' : 'No General notifications'} message={scope === 'expression' ? 'Expression announcements, events, prayer and testimony activity will appear here.' : 'General COT announcements, events and account activity will appear here.'} iconName="notifications-off-outline" />}
            </View>
          ) : null}

          {activeView === 'actions' ? (
            <View style={styles.section}>
              <SectionHeader title="Invitations" badge={pending.length} subtitle="Accept or decline ministry access requests." />
              {invitations.loading ? <Skeleton height={140} count={2} /> : invitations.error && !invitations.data ? <ResourceError message={invitations.error} retry={invitations.refresh} /> : pending.length ? pending.map((invite) => <View key={invite.id} style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><View style={styles.inviteTop}><View style={[styles.inviteIcon, { backgroundColor: colors.primarySoft }]}><Icon name={invite.kind === 'expression_role' ? 'people-outline' : 'shield-checkmark-outline'} size={19} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.inviteTitle, { color: colors.text }]}>{invite.role?.name || 'Ministry invitation'}</Text><Text style={[styles.inviteMeta, { color: colors.textMuted }]}>{invite.expression?.name || 'General COT'} · expires {new Date(invite.expires_at).toLocaleDateString()}</Text></View><Badge label="PENDING" variant="primary" /></View>{invite.message ? <Text style={[styles.inviteBody, { color: colors.textSecondary }]}>{invite.message}</Text> : null}<View style={styles.actions}><Button label="Decline" variant="outline" size="sm" disabled={busyId === invite.id} onPress={() => void respond(invite, 'decline')} /><Button label="Accept" size="sm" loading={busyId === invite.id} onPress={() => void respond(invite, 'accept')} /></View></View>) : <EmptyState title="No invitations waiting" message="New Expression or ministry invitations will appear here." iconName="checkmark-circle-outline" />}
            </View>
          ) : null}

          {activeView === 'history' ? (
            <View style={styles.section}>
              <SectionHeader title="Invitation history" badge={history.length} />
              {history.length ? history.map((invite) => <View key={invite.id} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.flex}><Text style={[styles.inviteTitle, { color: colors.text }]}>{invite.role?.name || 'Ministry invitation'}</Text><Text style={[styles.inviteMeta, { color: colors.textMuted }]}>{invite.expression?.name || 'General COT'}</Text></View><Badge label={invite.status.toUpperCase()} variant={invite.status === 'accepted' ? 'success' : 'neutral'} /></View>) : <EmptyState title="No invitation history" message="Completed invitations will remain here for reference." iconName="time-outline" />}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 }, settings: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scopeCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, scopeTitle: { fontSize: 16, fontWeight: '900' }, scopeText: { fontSize: 11.5, lineHeight: 17 }, scopeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmented: { borderWidth: 1, borderRadius: radius.xl, padding: 4, flexDirection: 'row', gap: 4 }, segment: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, segmentText: { fontSize: 10.5, fontWeight: '800' }, count: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, countText: { fontSize: 9, fontWeight: '900' },
  message: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, messageText: { flex: 1, fontSize: 11.5, lineHeight: 17 }, section: { gap: spacing.sm },
  notice: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noticeIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, noticeTitle: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: '900' }, dot: { width: 7, height: 7, borderRadius: 4 }, scopeLabel: { fontSize: 9.5, fontWeight: '800', marginTop: 1 }, noticeBody: { fontSize: 11.5, lineHeight: 17, marginTop: 4 }, noticeMeta: { fontSize: 9.5, lineHeight: 14, marginTop: 6 }, pressed: { opacity: 0.8 },
  inviteCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, inviteTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, inviteIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, inviteTitle: { fontSize: 12.5, fontWeight: '900' }, inviteMeta: { fontSize: 9.5, lineHeight: 14, marginTop: 2 }, inviteBody: { fontSize: 11.5, lineHeight: 17 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm }, historyRow: { minHeight: 60, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

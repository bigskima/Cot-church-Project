import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { LiveFollowUp, PrayerRequest } from '@/types/content';

type PrayerScope = 'general' | 'expression';
type RoutedPrayer = PrayerRequest & {
  organization_id?: string;
  branch_id?: string | null;
  scope?: PrayerScope;
  routing_status?: 'queued' | 'routed' | 'unassigned';
  public_approved_at?: string | null;
  is_publicly_visible?: boolean;
};
type CareFollowUp = LiveFollowUp & {
  branch_id?: string | null;
  stream_title?: string | null;
  user_phone?: string | null;
  user_avatar?: string | null;
};

export default function PastoralTriageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [activeQueue, setActiveQueue] = useState<'prayer' | 'care'>('prayer');
  const [ministryScope, setMinistryScope] = useState<PrayerScope>(expression?.id ? 'expression' : 'general');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!expression?.id && ministryScope === 'expression') setMinistryScope('general');
  }, [expression?.id, ministryScope]);

  const prayerPath = (() => {
    const query = new URLSearchParams({ view: 'moderation', scope: ministryScope });
    if (organizationId) query.set('organizationId', organizationId);
    if (ministryScope === 'expression' && expression?.id) query.set('branchId', expression.id);
    return `prayer-requests?${query.toString()}`;
  })();

  const followupPath = (() => {
    const query = new URLSearchParams({ scope: ministryScope });
    if (ministryScope === 'expression' && expression?.id) query.set('branchId', expression.id);
    return `pastoral-followups?${query.toString()}`;
  })();

  const prayers = useResource<RoutedPrayer[]>(
    `pastoral:prayers:${ministryScope}:${organizationId || 'auto'}:${expression?.id || 'none'}`,
    (signal) => api.request<RoutedPrayer[]>(prayerPath, { signal })
  );

  const followups = useResource<CareFollowUp[]>(
    `pastoral:followups:${ministryScope}:${organizationId || 'none'}:${expression?.id || 'none'}`,
    (signal) => api.request<CareFollowUp[]>(followupPath, { signal })
  );

  const updatePrayer = async (
    id: string,
    patch: { status?: 'praying' | 'answered' | 'archived'; approvePublic?: boolean }
  ) => {
    setWorkingId(id);
    setActionError('');
    try {
      await api.request('prayer-requests', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...patch }),
      });
      prayers.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update this prayer request.');
    } finally {
      setWorkingId(null);
    }
  };

  const updateFollowup = async (id: string, status: 'contacted' | 'resolved' | 'closed') => {
    setWorkingId(id);
    setActionError('');
    try {
      await api.request('pastoral-followups', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      followups.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update this pastoral follow-up.');
    } finally {
      setWorkingId(null);
    }
  };

  const prayerList = prayers.data ?? [];
  const careList = followups.data ?? [];
  const scopeTitle = ministryScope === 'expression' && expression?.name
    ? `${expression.name} Prayer Queue`
    : 'General Prayer Ministry Queue';

  const scopeTabs = expression?.id ? (
    <View style={styles.scopeTabs}>
      <Chip label="General" selected={ministryScope === 'general'} onPress={() => setMinistryScope('general')} />
      <Chip label={expression.name} selected={ministryScope === 'expression'} onPress={() => setMinistryScope('expression')} />
    </View>
  ) : null;

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
            title="Pastoral Care"
            kicker="LEADERSHIP"
            subtitle="Prayer and live-service follow-up stay inside your assigned church or Expression scope."
            showBack
          />
        </View>

        <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Chip label="Prayer Requests" selected={activeQueue === 'prayer'} onPress={() => setActiveQueue('prayer')} count={prayerList.length} />
          <Chip label="Altar & Care Responses" selected={activeQueue === 'care'} onPress={() => setActiveQueue('care')} count={careList.length} />
        </View>

        <View style={styles.body}>
          {actionError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Text style={[styles.errorText, { color: colors.live }]}>{actionError}</Text>
            </View>
          ) : null}
          {activeQueue === 'prayer' ? (
            <View style={styles.queueSection}>
              {scopeTabs}
              <SectionHeader title={scopeTitle} badge={prayerList.length} />
              {prayers.loading && !prayers.data ? (
                <Skeleton height={140} count={2} />
              ) : prayers.error && !prayers.data ? (
                <ResourceError message={prayers.error} retry={prayers.refresh} />
              ) : prayerList.length > 0 ? (
                prayerList.map((p) => {
                  const wallIntent = p.privacy === 'public_approved';
                  const approved = p.is_publicly_visible === true;
                  const busy = workingId === p.id;
                  const badgeLabel = p.privacy === 'pastoral_only'
                    ? 'CONFIDENTIAL PASTORAL'
                    : p.privacy === 'prayer_team'
                      ? 'PRAYER TEAM'
                      : approved
                        ? 'ON PRAYER WALL'
                        : 'WALL APPROVAL PENDING';

                  return (
                    <View key={p.id} style={[styles.triageCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                      <View style={styles.cardHeader}>
                        <Badge label={badgeLabel} variant={p.privacy === 'pastoral_only' ? 'prayer' : 'primary'} />
                        <Text style={[styles.dateText, { color: colors.textMuted }]}>{new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                      </View>
                      <Text style={[styles.title, { color: colors.text }]}>{p.title}</Text>
                      {p.request || p.description ? <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{p.request || p.description}</Text> : null}

                      {wallIntent ? (
                        <View style={[styles.wallNotice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                          <Text style={[styles.wallNoticeText, { color: colors.textSecondary }]}>The submitter allowed this petition to appear on the {ministryScope === 'expression' ? 'Expression' : 'public'} prayer wall. It remains private to the assigned ministry until you approve it.</Text>
                          <Button label={approved ? 'Remove from Wall' : 'Approve for Wall'} onPress={() => updatePrayer(p.id, { approvePublic: !approved })} variant={approved ? 'outline' : 'primary'} size="sm" loading={busy} />
                        </View>
                      ) : null}

                      <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}>
                        <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Status: <Text style={{ color: colors.interactive, fontWeight: '700' }}>{p.status || 'submitted'}</Text></Text>
                        <View style={styles.btnRow}>
                          <Button label="Mark Praying" onPress={() => updatePrayer(p.id, { status: 'praying' })} variant="outline" size="sm" loading={busy} />
                          <Button label="Answered" onPress={() => updatePrayer(p.id, { status: 'answered' })} variant="primary" size="sm" loading={busy} />
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyState title="No Prayer Requests in This Queue" message="New petitions routed to your exact prayer or pastoral scope will appear here." iconName="shield-checkmark-outline" />
              )}
            </View>
          ) : (
            <View style={styles.queueSection}>
              {scopeTabs}
              <SectionHeader title={ministryScope === 'expression' && expression?.name ? `${expression.name} Altar & Care Queue` : 'General Altar & Care Queue'} badge={careList.length} />
              {followups.loading && !followups.data ? (
                <Skeleton height={130} count={2} />
              ) : followups.error && !followups.data ? (
                <ResourceError message={followups.error} retry={followups.refresh} />
              ) : careList.length > 0 ? (
                careList.map((f) => {
                  const busy = workingId === f.id;
                  return (
                    <View key={f.id} style={[styles.triageCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                      <View style={styles.cardHeader}>
                        <Badge label={f.type.replaceAll('_', ' ').toUpperCase()} variant="primary" />
                        <Text style={[styles.dateText, { color: colors.textMuted }]}>{new Date(f.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.title, { color: colors.text }]}>{f.user_name || 'Church Participant'}</Text>
                      {f.stream_title ? <Text style={[styles.bodyText, { color: colors.textSecondary }]}>From: {f.stream_title}</Text> : null}
                      {f.user_phone ? <Text style={[styles.bodyText, { color: colors.interactive }]}>{f.user_phone}</Text> : null}
                      {f.private_note ? <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{f.private_note}</Text> : null}
                      <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}>
                        <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Status: <Text style={{ color: colors.interactive, fontWeight: '700' }}>{f.status}</Text></Text>
                        <View style={styles.btnRow}>
                          <Button label="Contacted" onPress={() => updateFollowup(f.id, 'contacted')} variant="outline" size="sm" loading={busy} />
                          <Button label="Resolved" onPress={() => updateFollowup(f.id, 'resolved')} variant="primary" size="sm" loading={busy} />
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyState title="No Follow-Up Requests" message="Altar responses, counselling requests and other live-service follow-ups routed to this exact scope will appear here." iconName="heart-outline" />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: spacing.md, marginTop: spacing.md, padding: 5, gap: spacing.xs, borderWidth: 1, borderRadius: radius.xl, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg },
  errorBanner: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  queueSection: { gap: spacing.sm },
  scopeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  triageCard: { padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, marginBottom: spacing.sm, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 11 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15 },
  bodyText: { fontSize: 13, lineHeight: 18 },
  wallNotice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.xs },
  wallNoticeText: { fontSize: 11, lineHeight: 16 },
  actionBar: { gap: spacing.sm, paddingTop: spacing.xs + 4, borderTopWidth: 1, marginTop: spacing.xs },
  statusLabel: { fontSize: 12 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

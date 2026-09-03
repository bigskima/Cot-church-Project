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

export default function PastoralTriageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [activeQueue, setActiveQueue] = useState<'prayer' | 'care'>('prayer');
  const [prayerScope, setPrayerScope] = useState<PrayerScope>(expression?.id ? 'expression' : 'general');
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!expression?.id && prayerScope === 'expression') setPrayerScope('general');
  }, [expression?.id, prayerScope]);

  const prayerPath = (() => {
    const query = new URLSearchParams({ view: 'moderation', scope: prayerScope });
    if (organizationId) query.set('organizationId', organizationId);
    if (prayerScope === 'expression' && expression?.id) query.set('branchId', expression.id);
    return `prayer-requests?${query.toString()}`;
  })();

  const prayers = useResource<RoutedPrayer[]>(
    `pastoral:prayers:${prayerScope}:${organizationId || 'auto'}:${expression?.id || 'none'}`,
    (signal) => api.request<RoutedPrayer[]>(prayerPath, { signal })
  );

  // This queue is retained while the broader pastoral follow-up endpoint is audited.
  // Prayer routing itself no longer depends on this legacy feed request.
  const followups = useResource<LiveFollowUp[]>('pastoral:followups', (signal) =>
    api.request<LiveFollowUp[]>('social-feed?type=followups', { signal }).catch(() => [])
  );

  const updatePrayer = async (
    id: string,
    patch: { status?: 'praying' | 'answered' | 'archived'; approvePublic?: boolean }
  ) => {
    setWorkingId(id);
    try {
      await api.request('prayer-requests', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...patch }),
      });
      prayers.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update this prayer request.');
    } finally {
      setWorkingId(null);
    }
  };

  const prayerList = prayers.data ?? [];
  const careList = followups.data ?? [];
  const scopeTitle = prayerScope === 'expression' && expression?.name
    ? `${expression.name} Prayer Queue`
    : 'General Prayer Ministry Queue';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 60 },
        ]}
      >
        <ScreenHeader
          title="Pastoral Triage & Care"
          subtitle="Prayer access follows your assigned ministry role and exact church or Expression scope."
          showBack
        />

        <View style={styles.tabRow}>
          <Chip
            label="Prayer Requests"
            selected={activeQueue === 'prayer'}
            onPress={() => setActiveQueue('prayer')}
            count={prayerList.length}
          />
          <Chip
            label="Altar & Care Responses"
            selected={activeQueue === 'care'}
            onPress={() => setActiveQueue('care')}
            count={careList.length}
          />
        </View>

        <View style={styles.body}>
          {activeQueue === 'prayer' ? (
            <View style={styles.queueSection}>
              {expression?.id ? (
                <View style={styles.scopeTabs}>
                  <Chip label="General" selected={prayerScope === 'general'} onPress={() => setPrayerScope('general')} />
                  <Chip label={expression.name} selected={prayerScope === 'expression'} onPress={() => setPrayerScope('expression')} />
                </View>
              ) : null}

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
                    <View
                      key={p.id}
                      style={[styles.triageCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                    >
                      <View style={styles.cardHeader}>
                        <Badge
                          label={badgeLabel}
                          variant={p.privacy === 'pastoral_only' ? 'prayer' : 'primary'}
                        />
                        <Text style={[styles.dateText, { color: colors.textMuted }]}> 
                          {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>

                      <Text style={[styles.title, { color: colors.text }]}>{p.title}</Text>
                      {p.request || p.description ? (
                        <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                          {p.request || p.description}
                        </Text>
                      ) : null}

                      {wallIntent ? (
                        <View style={[styles.wallNotice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}> 
                          <Text style={[styles.wallNoticeText, { color: colors.textSecondary }]}> 
                            The submitter allowed this petition to appear on the {prayerScope === 'expression' ? 'Expression' : 'public'} prayer wall. It remains private to the assigned ministry until you approve it.
                          </Text>
                          <Button
                            label={approved ? 'Remove from Wall' : 'Approve for Wall'}
                            onPress={() => updatePrayer(p.id, { approvePublic: !approved })}
                            variant={approved ? 'outline' : 'primary'}
                            size="sm"
                            loading={busy}
                          />
                        </View>
                      ) : null}

                      <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}> 
                        <Text style={[styles.statusLabel, { color: colors.textMuted }]}> 
                          Status: <Text style={{ color: colors.interactive, fontWeight: '700' }}>{p.status || 'submitted'}</Text>
                        </Text>

                        <View style={styles.btnRow}>
                          <Button
                            label="Mark Praying"
                            onPress={() => updatePrayer(p.id, { status: 'praying' })}
                            variant="outline"
                            size="sm"
                            loading={busy}
                          />
                          <Button
                            label="Answered"
                            onPress={() => updatePrayer(p.id, { status: 'answered' })}
                            variant="primary"
                            size="sm"
                            loading={busy}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyState
                  title="No Prayer Requests in This Queue"
                  message="New petitions routed to your exact prayer or pastoral scope will appear here."
                  iconName="shield-checkmark-outline"
                />
              )}
            </View>
          ) : (
            <View style={styles.queueSection}>
              <SectionHeader title="Altar Call & Counselling Log" badge={careList.length} />
              {careList.length > 0 ? (
                careList.map((f) => (
                  <View
                    key={f.id}
                    style={[styles.triageCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                  >
                    <View style={styles.cardHeader}>
                      <Badge label={f.type.toUpperCase()} variant="primary" />
                      <Text style={[styles.dateText, { color: colors.textMuted }]}> 
                        {new Date(f.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>{f.user_name || 'Anonymous Visitor'}</Text>
                    {f.user_email ? <Text style={[styles.bodyText, { color: colors.interactive }]}>{f.user_email}</Text> : null}
                    {f.private_note ? <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{f.private_note}</Text> : null}
                  </View>
                ))
              ) : (
                <EmptyState
                  title="No Follow-Up Requests"
                  message="Incoming live-service follow-up requests will appear here once that pastoral queue is available."
                  iconName="heart-outline"
                />
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
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.md },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  queueSection: { gap: spacing.xs },
  scopeTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  triageCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.xs, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 11 },
  title: { fontSize: 15, fontWeight: '700' },
  bodyText: { fontSize: 13, lineHeight: 18 },
  wallNotice: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm, marginTop: spacing.xs },
  wallNoticeText: { fontSize: 11, lineHeight: 16 },
  actionBar: { gap: spacing.sm, paddingTop: spacing.xs + 4, borderTopWidth: 1, marginTop: spacing.xs },
  statusLabel: { fontSize: 12 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

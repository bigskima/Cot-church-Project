import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { toUserFacingErrorMessage } from '@/api';
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
import type { LiveStream } from '@/types/content';

type StreamingReadiness = {
  ready: boolean;
  reason?: string | null;
  providerCode?: string;
  signedPlaybackConfigured?: boolean;
};

type BroadcastScope = 'public' | 'expression';

export default function MediaStudioScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const expressionWorkspace = pathname.startsWith('/expressions/');
  const { api, context, hasCapability, hasPublicCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    context?.creatorOrganizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';

  const canPublicBroadcast = !expressionWorkspace && hasPublicCapability('public.live_stream.create');
  const canExpressionBroadcast = Boolean(expression?.id) && hasCapability('streams.broadcast');
  const hasBroadcastAccess = canPublicBroadcast || canExpressionBroadcast;

  const [broadcastScope, setBroadcastScope] = useState<BroadcastScope>(canExpressionBroadcast ? 'expression' : 'public');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latencyMode, setLatencyMode] = useState<'standard' | 'reduced' | 'low'>('reduced');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createdIngest, setCreatedIngest] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (broadcastScope === 'expression' && !canExpressionBroadcast && canPublicBroadcast) {
      setBroadcastScope('public');
    }
    if (broadcastScope === 'public' && !canPublicBroadcast && canExpressionBroadcast) {
      setBroadcastScope('expression');
    }
  }, [broadcastScope, canExpressionBroadcast, canPublicBroadcast]);

  const targetExpressionId = broadcastScope === 'expression' ? expression?.id : undefined;
  const destinationName = broadcastScope === 'expression'
    ? expression?.name ?? 'Expression'
    : 'General Community';

  const readiness = useResource<StreamingReadiness>(
    `leadership:streaming-readiness:${broadcastScope}:${organizationId || 'auto'}:${targetExpressionId ?? 'none'}`,
    (signal) => {
      const allowed = broadcastScope === 'public' ? canPublicBroadcast : canExpressionBroadcast;
      if (!allowed) return Promise.resolve({ ready: false, reason: 'permission_missing' });
      const query = new URLSearchParams();
      if (organizationId) query.set('organizationId', organizationId);
      if (targetExpressionId) query.set('branchId', targetExpressionId);
      return api.request<StreamingReadiness>(`streaming-broadcasts?${query.toString()}`, { signal, context: 'public' });
    },
  );

  const streams = useResource<LiveStream[]>(
    `leadership:streams:${broadcastScope}:${organizationId || 'auto'}:${targetExpressionId ?? 'none'}`,
    (signal) => {
      const allowed = broadcastScope === 'public' ? canPublicBroadcast : canExpressionBroadcast;
      if (!allowed) return Promise.resolve([]);
      const query = new URLSearchParams();
      query.set('scope', broadcastScope === 'public' ? 'church' : 'expression');
      if (organizationId) query.set('organizationId', organizationId);
      if (targetExpressionId) query.set('expressionId', targetExpressionId);
      return api.request<LiveStream[]>(`live-streams?${query.toString()}`, { signal, context: 'public' });
    },
  );

  const providerReady = readiness.data?.ready === true;
  const streamList = streams.data ?? [];

  const resetCreate = () => {
    setTitle('');
    setDescription('');
    setLatencyMode('reduced');
    setCreatedIngest(null);
    setShowKey(false);
    setErrorMsg('');
  };

  const openCreate = () => {
    resetCreate();
    setCreateOpen(true);
  };

  const changeScope = (next: BroadcastScope) => {
    if (creating) return;
    if (next === 'public' && !canPublicBroadcast) return;
    if (next === 'expression' && !canExpressionBroadcast) return;
    setCreateOpen(false);
    setBroadcastScope(next);
    setActionMsg('');
    setErrorMsg('');
  };

  const handleCreateBroadcast = async () => {
    const allowed = broadcastScope === 'public' ? canPublicBroadcast : canExpressionBroadcast;
    if (!allowed) return setErrorMsg('Live broadcasting isn’t available for this account.');
    if (!providerReady) return setErrorMsg('Live broadcasting is temporarily unavailable.');
    if (broadcastScope === 'expression' && !targetExpressionId) return setErrorMsg('Enter an Expression before creating its broadcast.');
    if (!title.trim()) return setErrorMsg('Enter a broadcast title.');

    setCreating(true);
    setErrorMsg('');
    setActionMsg('');
    try {
      const res = await api.request<{ stream: LiveStream; ingest: { rtmpUrl: string; streamKey: string } }>('streaming-broadcasts', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          organizationId: organizationId || undefined,
          branchId: targetExpressionId,
          title: title.trim(),
          description: description.trim(),
          visibility: broadcastScope === 'public' ? 'public' : 'branch',
          latencyMode,
          record: true,
        }),
      });
      setCreatedIngest(res.ingest);
      setActionMsg(`${res.stream.title} was created for ${destinationName}.`);
      streams.refresh();
    } catch (err) {
      setErrorMsg(toUserFacingErrorMessage(err, 'We couldn’t create this broadcast. Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  const operateStream = async (id: string, action: 'refresh_status' | 'stop') => {
    setBusyId(id);
    setErrorMsg('');
    setActionMsg('');
    try {
      const result = await api.request<{ id: string; status: string }>('streaming-broadcasts', {
        method: 'PATCH',
        context: 'public',
        body: JSON.stringify({ id, action }),
      });
      setActionMsg(action === 'stop' ? 'Broadcast ended.' : `Broadcast status updated: ${result.status}.`);
      streams.refresh();
    } catch (err) {
      setErrorMsg(toUserFacingErrorMessage(err, 'We couldn’t update this broadcast. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!hasBroadcastAccess) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Live Media Studio" kicker="BROADCAST" showBack />
        <View style={styles.emptyPad}>
          <EmptyState
            title="Live broadcasting isn’t available for this account"
            message="You can still watch live services. Broadcasting tools appear when you’re part of the live team for General COT or an Expression."
            iconName="lock-closed-outline"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: expressionWorkspace ? spacing.md : insets.top + spacing.sm, paddingBottom: expressionWorkspace ? insets.bottom + spacing.xl : insets.bottom + 120 },
        ]}
      >
        {!expressionWorkspace ? (
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <ScreenHeader
              title="Live Media Studio"
              kicker="BROADCAST"
              subtitle={broadcastScope === 'public'
                ? 'Create live broadcasts for General COT.'
                : `Create private broadcasts inside ${expression?.name ?? 'your Expression'}.`}
              showBack
              rightAction={providerReady ? <Button label="New broadcast" onPress={openCreate} size="sm" /> : undefined}
            />
          </View>
        ) : null}

        <View style={styles.body}>
          {canPublicBroadcast && canExpressionBroadcast ? (
            <View style={[styles.scopeCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Broadcast destination</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>Choose where this broadcast should appear.</Text>
              </View>
              <View style={styles.chipsRow}>
                <Chip label="General Community" selected={broadcastScope === 'public'} onPress={() => changeScope('public')} />
                <Chip label={expression?.name ?? 'Expression'} selected={broadcastScope === 'expression'} onPress={() => changeScope('expression')} />
              </View>
            </View>
          ) : (
            <View style={[styles.scopeCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={[styles.scopeIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name={broadcastScope === 'public' ? 'globe-outline' : 'people-outline'} size={20} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{destinationName}</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>
                  {broadcastScope === 'public'
                    ? 'You can create live broadcasts for General COT.'
                    : 'You can create live broadcasts inside this Expression.'}
                </Text>
              </View>
              <Badge label={broadcastScope === 'public' ? 'GENERAL COT' : 'EXPRESSION'} variant="primary" />
            </View>
          )}

          {actionMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{actionMsg}</Text>
            </View>
          ) : null}
          {errorMsg && !createOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.readinessCard, { backgroundColor: colors.card, borderColor: providerReady ? colors.success : colors.borderSubtle }, shadows.md]}>
            <View style={[styles.providerIcon, { backgroundColor: providerReady ? colors.successSoft : colors.bgSecondary }]}>
              <Icon name="radio-outline" size={22} color={providerReady ? colors.success : colors.textMuted} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Live broadcasting</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {providerReady ? `Ready for ${destinationName}.` : 'Temporarily unavailable. Existing broadcasts remain visible.'}
              </Text>
            </View>
            <Badge label={providerReady ? 'AVAILABLE' : 'TEMPORARILY UNAVAILABLE'} variant={providerReady ? 'active' : 'neutral'} />
          </View>

          <View style={styles.listSection}>
            <SectionHeader
              title={broadcastScope === 'public' ? 'Public broadcasts' : 'Expression broadcasts'}
              badge={streamList.length}
              subtitle={broadcastScope === 'public' ? 'General COT live broadcasts' : `Live broadcasts for ${expression?.name ?? 'this Expression'}`}
              actionLabel={providerReady ? 'Create' : undefined}
              onAction={providerReady ? openCreate : undefined}
            />
            {streams.loading && !streams.data ? (
              <Skeleton height={112} count={2} />
            ) : streams.error && !streams.data ? (
              <ResourceError message={streams.error} retry={streams.refresh} />
            ) : streamList.length ? (
              streamList.map((stream) => (
                <View key={stream.id} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.tileTop}>
                    <View style={[styles.streamIcon, { backgroundColor: stream.status === 'live' ? colors.liveSoft : colors.primarySoft }]}>
                      <Icon name="radio" size={19} color={stream.status === 'live' ? colors.live : colors.interactive} />
                    </View>
                    <View style={styles.tileInfo}>
                      <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={2}>{stream.title}</Text>
                      <Text style={[styles.tileDate, { color: colors.textMuted }]}>
                        {stream.scheduled_start
                          ? new Date(stream.scheduled_start).toLocaleString()
                          : stream.created_at
                            ? new Date(stream.created_at).toLocaleString()
                            : 'Created recently'}
                      </Text>
                    </View>
                    <Badge label={(stream.status ?? 'broadcast').toUpperCase()} variant={stream.status === 'live' ? 'live' : 'neutral'} pulse={stream.status === 'live'} />
                  </View>
                  <View style={styles.actions}>
                    <Button label="Refresh" onPress={() => void operateStream(stream.id, 'refresh_status')} loading={busyId === stream.id} variant="outline" size="sm" />
                    {!['ended', 'cancelled'].includes(stream.status) ? (
                      <Button label="End broadcast" onPress={() => void operateStream(stream.id, 'stop')} disabled={busyId === stream.id} variant="destructive" size="sm" />
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No broadcasts yet"
                message={providerReady ? `Create the first broadcast for ${destinationName}.` : 'New broadcasts will be available again shortly.'}
                iconName="radio-outline"
                actionLabel={providerReady ? 'Create broadcast' : undefined}
                onAction={providerReady ? openCreate : undefined}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title={createdIngest ? 'Streaming connection details' : 'Create live broadcast'}
        subtitle={createdIngest ? 'Use these details only on the device or software sending the broadcast.' : `Destination: ${destinationName}`}
        maxHeightPercent={94}
      >
        {createdIngest ? (
          <View style={styles.ingestSheet}>
            <View style={[styles.securityNotice, { backgroundColor: colors.warningSoft }]}>
              <Icon name="shield-checkmark-outline" size={18} color={colors.warning} />
              <Text style={[styles.helper, { color: colors.textSecondary }]}>The stream key is sensitive. Do not post or share it publicly.</Text>
            </View>

            <View style={styles.ingestField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SERVER / RTMP URL</Text>
              <Text selectable style={[styles.fieldCode, { backgroundColor: colors.bgSecondary, color: colors.text }]}>{createdIngest.rtmpUrl}</Text>
            </View>
            <View style={styles.ingestField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STREAM KEY</Text>
              <Text selectable={showKey} style={[styles.fieldCode, { backgroundColor: colors.bgSecondary, color: colors.text }]}>
                {showKey ? createdIngest.streamKey : '••••••••••••••••••••••••'}
              </Text>
            </View>
            <Button label={showKey ? 'Hide stream key' : 'Reveal stream key'} onPress={() => setShowKey((value) => !value)} variant="outline" />
            <Button label="Done" onPress={() => setCreateOpen(false)} size="lg" fullWidth />
          </View>
        ) : (
          <View style={styles.form}>
            {errorMsg ? (
              <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
                <Icon name="alert-circle" size={18} color={colors.live} />
                <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={[styles.destinationNotice, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
              <Icon name={broadcastScope === 'public' ? 'globe-outline' : 'people-outline'} size={19} color={colors.interactive} />
              <View style={styles.flex}>
                <Text style={[styles.destinationTitle, { color: colors.text }]}>{destinationName}</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>
                  {broadcastScope === 'public'
                    ? 'This livestream will appear in General COT and can be watched without joining an Expression.'
                    : 'This livestream will stay inside this Expression and won’t appear in General COT.'}
                </Text>
              </View>
            </View>

            <InputField label="Broadcast title" value={title} onChangeText={setTitle} placeholder="Sunday worship, conference, prayer meeting…" />
            <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="Theme, speaker or service notes…" />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LATENCY</Text>
            <View style={styles.chipsRow}>
              <Chip label="Reduced" selected={latencyMode === 'reduced'} onPress={() => setLatencyMode('reduced')} />
              <Chip label="Ultra low" selected={latencyMode === 'low'} onPress={() => setLatencyMode('low')} />
              <Chip label="Standard" selected={latencyMode === 'standard'} onPress={() => setLatencyMode('standard')} />
            </View>
            <Text style={[styles.helper, { color: colors.textMuted }]}>Reduced latency is the recommended default for interactive services.</Text>

            <Button label="Create broadcast" onPress={() => void handleCreateBroadcast()} loading={creating} disabled={!providerReady} size="lg" fullWidth />
          </View>
        )}
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
  scopeCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md, flexWrap: 'wrap' },
  scopeIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  readinessCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md },
  providerIcon: { width: 46, height: 46, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  helper: { fontSize: 11, lineHeight: 17 },
  listSection: { gap: spacing.sm },
  tile: { padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md, marginBottom: spacing.sm },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streamIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tileInfo: { flex: 1, gap: 2 },
  tileTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  tileDate: { fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  form: { gap: spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  destinationNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  destinationTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  ingestSheet: { gap: spacing.md },
  securityNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  ingestField: { gap: 5 },
  fieldCode: { padding: spacing.md, borderRadius: radius.lg, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

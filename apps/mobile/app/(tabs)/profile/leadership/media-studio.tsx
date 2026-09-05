import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { LiveStream } from '@/types/content';

type StreamingReadiness = {
  ready: boolean;
  reason?: string | null;
  providerCode?: string;
  signedPlaybackConfigured?: boolean;
};

export default function MediaStudioScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latencyMode, setLatencyMode] = useState<'standard' | 'reduced' | 'low'>('reduced');
  const [visibility, setVisibility] = useState<'public' | 'branch'>(expression?.id ? 'branch' : 'public');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createdIngest, setCreatedIngest] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const readiness = useResource<StreamingReadiness>(`leadership:streaming-readiness:${organizationId || 'none'}:${expression?.id ?? 'general'}`, (signal) =>
    api.request<StreamingReadiness>('streaming-broadcasts', { signal }),
  );
  const streams = useResource<LiveStream[]>(`leadership:streams:${expression?.id ?? 'none'}`, (signal) =>
    expression?.id ? api.request<LiveStream[]>('live-streams?scope=expression', { signal }) : Promise.resolve([]),
  );

  const providerReady = readiness.data?.ready === true;
  const streamList = streams.data ?? [];

  const resetCreate = () => {
    setTitle('');
    setDescription('');
    setLatencyMode('reduced');
    setVisibility(expression?.id ? 'branch' : 'public');
    setCreatedIngest(null);
    setShowKey(false);
    setErrorMsg('');
  };

  const openCreate = () => {
    resetCreate();
    setCreateOpen(true);
  };

  const handleCreateBroadcast = async () => {
    if (!providerReady) return setErrorMsg('Live broadcasting is temporarily unavailable.');
    if (!expression?.id) return setErrorMsg('Enter an Expression before creating its broadcast.');
    if (!title.trim()) return setErrorMsg('Enter a broadcast title.');

    setCreating(true);
    setErrorMsg('');
    setActionMsg('');
    try {
      const res = await api.request<{ stream: LiveStream; ingest: { rtmpUrl: string; streamKey: string } }>('streaming-broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          visibility,
          latencyMode,
          record: true,
        }),
      });
      setCreatedIngest(res.ingest);
      setActionMsg(`${res.stream.title} was created inside ${expression.name}.`);
      await streams.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create broadcast.');
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
        body: JSON.stringify({ id, action }),
      });
      setActionMsg(action === 'stop' ? 'Broadcast ended.' : `Broadcast status updated: ${result.status}.`);
      await streams.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to operate broadcast.');
    } finally {
      setBusyId(null);
    }
  };

  if (!expression?.id) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Live Media Studio" kicker="LEADERSHIP" showBack />
        <View style={styles.emptyPad}>
          <EmptyState
            title="Enter an Expression first"
            message="Expression broadcasts are created and operated from inside the Expression they belong to."
            iconName="radio-outline"
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
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Live Media Studio"
            kicker="BROADCAST"
            subtitle={`Create and operate live broadcasts for ${expression.name}.`}
            showBack
            rightAction={providerReady ? <Button label="New broadcast" onPress={openCreate} size="sm" /> : undefined}
          />
        </View>

        <View style={styles.body}>
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
              <Text style={[styles.cardTitle, { color: colors.text }]}>Broadcast service</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {providerReady ? 'Ready to create a provider-backed live broadcast.' : 'Temporarily unavailable. Existing broadcasts remain visible.'}
              </Text>
            </View>
            <Badge label={providerReady ? 'READY' : 'OFFLINE'} variant={providerReady ? 'active' : 'neutral'} />
          </View>

          <View style={styles.listSection}>
            <SectionHeader
              title="Broadcasts"
              badge={streamList.length}
              subtitle={`Streams belonging to ${expression.name}`}
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
                message={providerReady ? 'Create the first live broadcast for this Expression.' : 'Broadcast creation will return when the streaming service is ready.'}
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
        title={createdIngest ? 'Encoder credentials' : 'Create live broadcast'}
        subtitle={createdIngest ? 'Use these credentials only on the trusted broadcasting device.' : `Inside ${expression.name}`}
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

            <InputField label="Broadcast title" value={title} onChangeText={setTitle} placeholder="Sunday worship, conference, prayer meeting…" />
            <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="Theme, speaker or service notes…" />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AUDIENCE</Text>
            <View style={styles.chipsRow}>
              <Chip label={expression.name} selected={visibility === 'branch'} onPress={() => setVisibility('branch')} />
              <Chip label="Public" selected={visibility === 'public'} onPress={() => setVisibility('public')} />
            </View>

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
  ingestSheet: { gap: spacing.md },
  securityNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  ingestField: { gap: 5 },
  fieldCode: { padding: spacing.md, borderRadius: radius.lg, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latencyMode, setLatencyMode] = useState<'standard' | 'reduced' | 'low'>('reduced');
  const [visibility, setVisibility] = useState<'public' | 'branch'>('public');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createdIngest, setCreatedIngest] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const readiness = useResource<StreamingReadiness>('leadership:streaming-readiness', (signal) =>
    api.request<StreamingReadiness>('streaming-broadcasts', { signal })
  );
  const streams = useResource<LiveStream[]>(`leadership:streams:${expression?.id ?? 'none'}`, (signal) =>
    api.request<LiveStream[]>('live-streams?scope=expression', { signal })
  );

  const handleCreateBroadcast = async () => {
    if (!readiness.data?.ready) {
      setErrorMsg('Live broadcasting is temporarily unavailable. Please try again later.');
      return;
    }
    if (!expression?.id) {
      setErrorMsg('Select an Expression before creating a broadcast.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter a broadcast title.');
      return;
    }

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
      setTitle('');
      setDescription('');
      setCreatedIngest(res.ingest);
      setActionMsg(`Broadcast created inside ${expression.name}. Use the encoder credentials below to begin sending video.`);
      streams.refresh();
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
      streams.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to operate broadcast.');
    } finally {
      setBusyId(null);
    }
  };

  const streamList = streams.data ?? [];
  const providerReady = readiness.data?.ready === true;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: 70 }]}>
        <ScreenHeader title="Live Media Studio" subtitle={`Create and manage live broadcasts for ${expression?.name ?? 'the selected Expression'}.`} showBack />

        <View style={styles.body}>
          {actionMsg ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{actionMsg}</Text></View> : null}
          {errorMsg ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text></View> : null}

          <View style={[styles.readinessCard, { backgroundColor: colors.card, borderColor: providerReady ? colors.success : colors.border }, shadows.sm]}>
            <View style={styles.readinessHeader}>
              <View style={[styles.providerIcon, { backgroundColor: providerReady ? colors.successSoft : colors.bgSecondary }]}><Icon name="radio-outline" size={20} color={providerReady ? colors.success : colors.textMuted} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Broadcast Service</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{providerReady ? 'Live broadcasting is ready to use.' : 'Live broadcasting is temporarily unavailable.'}</Text>
              </View>
              <Badge label={providerReady ? 'READY' : 'OFFLINE'} variant={providerReady ? 'active' : 'neutral'} />
            </View>
            {!providerReady ? <Text style={[styles.helper, { color: colors.textMuted }]}>Please try again later. Your existing drafts and recordings remain available.</Text> : null}
          </View>

          {createdIngest ? (
            <View style={[styles.ingestCard, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm]}>
              <View style={styles.ingestHeader}><Icon name="key-outline" size={18} color={colors.interactive} /><Text style={[styles.ingestTitle, { color: colors.text }]}>OBS / Encoder Ingest Setup</Text></View>
              <View style={styles.ingestField}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SERVER URL / RTMP</Text><Text selectable style={[styles.fieldCode, { backgroundColor: colors.bgSecondary, color: colors.text }]}>{createdIngest.rtmpUrl}</Text></View>
              <View style={styles.ingestField}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STREAM KEY</Text><Text selectable={showKey} style={[styles.fieldCode, { backgroundColor: colors.bgSecondary, color: colors.text }]}>{showKey ? createdIngest.streamKey : '••••••••••••••••••••••••'}</Text></View>
              <Button label={showKey ? 'Hide Stream Key' : 'Reveal Stream Key'} onPress={() => setShowKey(!showKey)} variant="outline" size="sm" />
              <Text style={[styles.helper, { color: colors.textMuted }]}>Keep this stream key private. Only share it with the trusted person or device used to broadcast this service.</Text>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}><Icon name="radio-outline" size={18} color={colors.interactive} /><Text style={[styles.cardTitle, { color: colors.text }]}>Create Live Service Broadcast</Text></View>
            <InputField label="Broadcast Title" value={title} onChangeText={setTitle} placeholder="e.g. Sunday Morning Worship" />
            <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="Service theme, speaker, notes..." />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AUDIENCE</Text>
            <View style={styles.chipsRow}>
              <Chip label="Public" selected={visibility === 'public'} onPress={() => setVisibility('public')} />
              <Chip label={expression?.name ? `${expression.name} Members` : 'Expression Members'} selected={visibility === 'branch'} onPress={() => setVisibility('branch')} />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LATENCY</Text>
            <View style={styles.chipsRow}>
              <Chip label="Reduced (Recommended)" selected={latencyMode === 'reduced'} onPress={() => setLatencyMode('reduced')} />
              <Chip label="Ultra Low" selected={latencyMode === 'low'} onPress={() => setLatencyMode('low')} />
              <Chip label="Standard" selected={latencyMode === 'standard'} onPress={() => setLatencyMode('standard')} />
            </View>

            <Button label="Create Provider Broadcast & Ingest Keys" onPress={() => void handleCreateBroadcast()} loading={creating} disabled={!providerReady || !expression?.id} variant="primary" size="md" />
          </View>

          <View style={styles.listSection}>
            <SectionHeader title="This Expression’s Streams" badge={streamList.length} />
            {streams.loading && !streams.data ? <Skeleton height={100} count={2} /> : streams.error && !streams.data ? <ResourceError message={streams.error} retry={streams.refresh} /> : streamList.length ? streamList.map((stream) => (
              <View key={stream.id} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <View style={styles.tileTop}>
                  <View style={styles.tileInfo}>
                    <Text style={[styles.tileTitle, { color: colors.text }]}>{stream.title}</Text>
                    <Text style={[styles.tileDate, { color: colors.textMuted }]}>{stream.scheduled_start ? new Date(stream.scheduled_start).toLocaleString() : stream.created_at ? new Date(stream.created_at).toLocaleString() : 'Created recently'}</Text>
                  </View>
                  <Badge label={(stream.status ?? 'broadcast').toUpperCase()} variant={stream.status === 'live' ? 'live' : 'neutral'} pulse={stream.status === 'live'} />
                </View>
                <View style={styles.actions}>
                  <Button label="Refresh Provider Status" onPress={() => void operateStream(stream.id, 'refresh_status')} loading={busyId === stream.id} variant="outline" size="sm" />
                  {!['ended', 'cancelled'].includes(stream.status) ? <Button label="End Broadcast" onPress={() => void operateStream(stream.id, 'stop')} disabled={busyId === stream.id} variant="destructive" size="sm" /> : null}
                </View>
              </View>
            )) : <EmptyState title="No Expression Streams" message={providerReady ? 'Create the first live broadcast above.' : 'Live broadcasting is temporarily unavailable. Please try again later.'} iconName="radio-outline" />}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 }, bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  readinessCard: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm }, readinessHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, providerIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  ingestCard: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm }, ingestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, ingestTitle: { fontSize: 15, fontWeight: '700' }, ingestField: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }, fieldCode: { padding: spacing.sm, borderRadius: radius.sm, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }, helper: { fontSize: 11, lineHeight: 17 },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, cardTitle: { fontSize: 16, fontWeight: '700' }, chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  listSection: { gap: spacing.xs }, tile: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, marginBottom: spacing.xs }, tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, tileInfo: { flex: 1, gap: 2 }, tileTitle: { fontSize: 15, fontWeight: '700' }, tileDate: { fontSize: 11 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
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

export default function MediaStudioScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latencyMode, setLatencyMode] = useState<'standard' | 'reduced' | 'low'>('reduced');
  const [creating, setCreating] = useState(false);
  const [createdIngest, setCreatedIngest] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const streams = useResource<LiveStream[]>('leadership:streams', (signal) =>
    api.request<LiveStream[]>('live-streams', { signal })
  );

  const handleCreateBroadcast = async () => {
    if (!title.trim()) {
      setErrorMsg('Please enter a broadcast title.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    setActionMsg('');
    try {
      const res = await api.request<{
        stream: LiveStream;
        ingest: { rtmpUrl: string; streamKey: string };
      }>('streaming-broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          visibility: 'public',
          latencyMode,
          record: true,
        }),
      });
      setTitle('');
      setDescription('');
      setCreatedIngest(res.ingest);
      setActionMsg('Broadcast created successfully. Use the RTMP credentials below to start encoding.');
      streams.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create broadcast.');
    } finally {
      setCreating(false);
    }
  };

  const streamList = streams.data ?? [];

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
          title="Live Media Studio"
          subtitle="Manage live encoders, RTMP broadcast keys, and live service status."
          showBack
        />

        <View style={styles.body}>
          {actionMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)' }]}>
              <Icon name="checkmark-circle" size={18} color="#16A36A" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#16A36A' }]}>{actionMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
              <Icon name="alert-circle" size={18} color="#E5484D" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#E5484D' }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {createdIngest ? (
            <View style={[styles.ingestCard, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm]}>
              <View style={styles.ingestHeader}>
                <Icon name="key-outline" size={18} color={colors.interactive} />
                <Text style={[styles.ingestTitle, { color: colors.text }]}>OBS / Encoder Ingest Setup</Text>
              </View>

              <View style={styles.ingestField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Server URL / RTMP:</Text>
                <Text style={[styles.fieldCode, { backgroundColor: colors.bgSecondary, color: colors.text }]}>
                  {createdIngest.rtmpUrl}
                </Text>
              </View>

              <View style={styles.ingestField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Stream Key:</Text>
                <Text style={[styles.fieldCode, { backgroundColor: colors.bgSecondary, color: colors.text }]}>
                  {showKey ? createdIngest.streamKey : '••••••••••••••••••••••••'}
                </Text>
              </View>

              <Button
                label={showKey ? 'Hide Stream Key' : 'Reveal Stream Key'}
                onPress={() => setShowKey(!showKey)}
                variant="outline"
                size="sm"
              />
            </View>
          ) : null}

          {/* Create Broadcast Stage */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="radio-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Initialize Live Service Broadcast</Text>
            </View>

            <InputField
              label="Broadcast Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Sunday Morning Worship"
            />

            <InputField
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder="Service theme, speaker, notes..."
            />

            <View style={styles.latencySection}>
              <Text style={[styles.latencyLabel, { color: colors.textSecondary }]}>Latency Optimization</Text>
              <View style={styles.chipsRow}>
                <Chip
                  label="Reduced (Recommended)"
                  selected={latencyMode === 'reduced'}
                  onPress={() => setLatencyMode('reduced')}
                />
                <Chip
                  label="Ultra Low"
                  selected={latencyMode === 'low'}
                  onPress={() => setLatencyMode('low')}
                />
                <Chip
                  label="Standard 1080p"
                  selected={latencyMode === 'standard'}
                  onPress={() => setLatencyMode('standard')}
                />
              </View>
            </View>

            <Button
              label="Generate Ingest Keys & Create Stream"
              onPress={handleCreateBroadcast}
              loading={creating}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Stream Broadcasts List */}
          <View style={styles.listSection}>
            <SectionHeader title="Active & Recent Streams" badge={streamList.length} />
            {streams.loading ? (
              <Skeleton height={80} count={2} />
            ) : streamList.length > 0 ? (
              streamList.map((s) => (
                <View
                  key={s.id}
                  style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                >
                  <View style={styles.tileInfo}>
                    <Text style={[styles.tileTitle, { color: colors.text }]}>{s.title}</Text>
                    <Text style={[styles.tileDate, { color: colors.textMuted }]}>
                      Created: {new Date(s.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Badge
                    label={s.status ? s.status.toUpperCase() : 'BROADCAST'}
                    variant={s.status === 'live' ? 'live' : 'neutral'}
                    pulse={s.status === 'live'}
                  />
                </View>
              ))
            ) : (
              <EmptyState
                title="No Active Streams"
                message="Create a broadcast above to generate live streaming credentials."
                iconName="radio-outline"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  ingestCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  ingestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ingestTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ingestField: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldCode: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  latencySection: {
    gap: spacing.xs,
  },
  latencyLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  listSection: {
    gap: spacing.xs,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  tileInfo: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tileDate: {
    fontSize: 11,
  },
});

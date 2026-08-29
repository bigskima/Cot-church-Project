import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { LiveStream } from '@/types/content';

export default function MediaStudioScreen() {
  const { api } = useSession();
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
      setActionMsg('Broadcast created successfully! Connect your hardware/OBS encoder using the credentials below.');
      streams.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create broadcast.');
    } finally {
      setCreating(false);
    }
  };

  const handleStopStream = async (streamId: string) => {
    try {
      await api.request(`streaming-broadcasts?id=${streamId}`, {
        method: 'DELETE',
      });
      setActionMsg('Broadcast ended successfully. Processing cloud recording...');
      streams.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to stop stream.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Expression Media Studio"
        subtitle="Manage live encoders, RTMP broadcast keys, and convert recordings to sermon drafts."
        showBack
      />

      <View style={styles.body}>
        {/* Create Broadcast Stage */}
        <View style={[styles.createCard, shadows.md]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>CREATE NEW LIVESTREAM</Text>
            <Badge label="ENCODER OPS" variant="gold" />
          </View>

          <InputField
            label="Service / Gathering Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Sunday Celebration Service - 10:00 AM"
          />

          <InputField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Message theme or order of service..."
            multiline
            numberOfLines={2}
          />

          {/* Latency Selection */}
          <Text style={styles.latencyLabel}>STREAM LATENCY TARGET</Text>
          <View style={styles.latencySelector}>
            {[
              ['reduced', 'Reduced (~4s)', 'Best for real-time interaction & prayer'],
              ['standard', 'Standard (~12s)', 'Optimal stability for variable bandwidth'],
            ].map(([key, label, desc]) => {
              const isSelected = latencyMode === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setLatencyMode(key as any)}
                  style={({ pressed }) => [
                    styles.latencyPill,
                    isSelected && styles.latencyPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.latencyPillTitle, isSelected && styles.latencyPillTitleActive]}>
                    {label}
                  </Text>
                  <Text style={styles.latencyPillDesc}>{desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          {actionMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{actionMsg}</Text>
            </View>
          ) : null}

          <Button
            label="Provision Live Broadcast ➔"
            onPress={handleCreateBroadcast}
            variant="gold"
            size="lg"
            loading={creating}
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* RTMP Encoder Ingest Credentials Card */}
        {createdIngest && (
          <View style={[styles.ingestCard, shadows.lg]}>
            <View style={styles.ingestHeader}>
              <Text style={styles.ingestTitle}>OBS / vMix Ingest Credentials</Text>
              <Badge label="CONFIDENTIAL" variant="live" />
            </View>
            <Text style={styles.ingestWarning}>
              Do not share this key publicly. Paste into your broadcasting software (OBS, vMix, ATEM, etc.).
            </Text>

            <View style={styles.credentialField}>
              <Text style={styles.credentialLabel}>RTMP SERVER URL</Text>
              <Text selectable style={styles.credentialValue}>
                {createdIngest.rtmpUrl}
              </Text>
            </View>

            <View style={styles.credentialField}>
              <Text style={styles.credentialLabel}>STREAM KEY</Text>
              <View style={styles.keyRow}>
                <Text selectable style={styles.credentialValue}>
                  {showKey ? createdIngest.streamKey : '••••••••••••••••••••••••••••••••'}
                </Text>
                <Pressable
                  onPress={() => setShowKey(!showKey)}
                  style={styles.showKeyButton}
                >
                  <Text style={styles.showKeyText}>{showKey ? 'Hide' : 'Reveal'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Active & Scheduled Streams List */}
        <SectionHeader title="Expression Streams" badge={streams.data?.length ?? 0} />
        {streams.loading ? (
          <Skeleton height={140} count={2} />
        ) : streams.error && !streams.data ? (
          <ResourceError
            offline={streams.offline}
            message={streams.error}
            retry={streams.refresh}
          />
        ) : streams.data && streams.data.length > 0 ? (
          streams.data.map((stream) => {
            const isLive = stream.status === 'live';
            return (
              <View key={stream.id} style={[styles.streamCard, shadows.sm]}>
                <View style={styles.streamCardHeader}>
                  <Badge
                    label={stream.status.toUpperCase()}
                    variant={isLive ? 'live' : stream.status === 'scheduled' ? 'gold' : 'neutral'}
                    pulse={isLive}
                  />
                  <Text style={styles.streamCreated}>
                    {new Date(stream.created_at || Date.now()).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={styles.streamCardTitle}>{stream.title}</Text>
                {stream.description ? (
                  <Text style={styles.streamCardDescription}>{stream.description}</Text>
                ) : null}

                <View style={styles.streamCardFooter}>
                  {isLive && (
                    <Button
                      label="End Broadcast"
                      onPress={() => handleStopStream(stream.id)}
                      variant="live"
                      size="sm"
                    />
                  )}
                  {stream.status === 'ended' && (
                    <Badge label="RECORDING ARCHIVED" variant="success" />
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            title="No Expression Streams Found"
            message="Provision a livestream above to start broadcasting to your congregation."
            icon="📡"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  createCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    letterSpacing: 0.8,
  },
  latencyLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  latencySelector: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  latencyPill: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSubtle,
    borderWidth: 1,
    borderColor: palette.line,
  },
  latencyPillActive: {
    backgroundColor: '#F8EDCE',
    borderColor: palette.gold,
  },
  latencyPillTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.ink,
  },
  latencyPillTitleActive: {
    color: palette.navy,
    fontWeight: '900',
  },
  latencyPillDesc: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 2,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 4,
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
    borderRadius: radius.md,
    marginVertical: spacing.sm,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '800',
  },
  ingestCard: {
    backgroundColor: palette.midnight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.gold,
  },
  ingestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingestTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.white,
  },
  ingestWarning: {
    fontSize: 12,
    color: '#8E9EB5',
    marginVertical: spacing.sm,
  },
  credentialField: {
    marginTop: spacing.sm,
    backgroundColor: palette.surfaceDarkElevated,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  credentialLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 0.5,
  },
  credentialValue: {
    color: palette.white,
    fontFamily: 'monospace',
    fontSize: 13,
    marginTop: 4,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  showKeyButton: {
    backgroundColor: '#FFFFFF26',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  showKeyText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
  },
  streamCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  streamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  streamCreated: {
    fontSize: 12,
    color: palette.muted,
  },
  streamCardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.ink,
  },
  streamCardDescription: {
    fontSize: 13,
    color: palette.inkSecondary,
    marginTop: 4,
  },
  streamCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

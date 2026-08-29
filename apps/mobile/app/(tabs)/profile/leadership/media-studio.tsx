import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
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
  const { colors, isDark } = useTheme();
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
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Expression Media Studio"
        subtitle="Manage live encoders, RTMP broadcast keys, and convert recordings to sermon drafts."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Create Broadcast Stage */}
        <View
          style={[
            styles.createCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }]}>
              CREATE NEW LIVESTREAM
            </Text>
            <Badge label="ENCODER OPS" variant="gold" />
          </View>

          <InputField
            label="Service / Gathering Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Sunday Celebration Service - 10:00 AM"
            dark={isDark}
          />

          <InputField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Message theme or order of service..."
            multiline
            numberOfLines={2}
            dark={isDark}
          />

          {/* Latency Selection */}
          <Text style={[styles.latencyLabel, { color: colors.text }] as any}>STREAM LATENCY TARGET</Text>
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
                  style={[
                    styles.latencyPill,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : isDark
                        ? '#2E1C11'
                        : '#F1E3D3',
                      borderColor: isSelected ? colors.primaryDark : colors.border,
                    },
                  ] as any}
                >
                  <Text
                    style={[
                      styles.latencyPillTitle,
                      {
                        color: isSelected
                          ? '#140C07'
                          : isDark
                          ? '#FFFDF9'
                          : '#26140A',
                        fontWeight: isSelected ? '900' : '700',
                      },
                    ] as any}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.latencyPillDesc,
                      { color: isSelected ? '#362215' : colors.textMuted },
                    ] as any}
                  >
                    {desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          {actionMsg ? (
            <View
              style={[
                styles.successBox,
                { backgroundColor: isDark ? '#1C3A27' : '#ECFDF5' },
              ] as any}
            >
              <Text style={styles.successText}>{actionMsg}</Text>
            </View>
          ) : null}

          <Button
            label="Provision Live Broadcast ➔"
            onPress={handleCreateBroadcast}
            variant="gold"
            size="lg"
            loading={creating}
            style={{ marginTop: spacing.md } as any}
          />
        </View>

        {/* RTMP Encoder Ingest Credentials Card */}
        {createdIngest && (
          <View style={[styles.ingestCard, shadows.lg] as any}>
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
                  style={styles.showKeyButton as any}
                >
                  <Text style={styles.showKeyText}>{showKey ? 'Hide' : 'Reveal'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Active & Scheduled Streams List */}
        <SectionHeader
          title="Expression Streams"
          badge={streams.data?.length ?? 0}
          dark={isDark}
        />
        {streams.loading ? (
          <Skeleton height={140} count={2} dark={isDark} />
        ) : streams.error && !streams.data ? (
          <ResourceError
            offline={streams.offline}
            message={streams.error}
            retry={streams.refresh}
            dark={isDark}
          />
        ) : streams.data && streams.data.length > 0 ? (
          streams.data.map((stream) => {
            const isLive = stream.status === 'live';
            return (
              <View
                key={stream.id}
                style={[
                  styles.streamCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ] as any}
              >
                <View style={styles.streamCardHeader}>
                  <Badge
                    label={stream.status.toUpperCase()}
                    variant={isLive ? 'live' : stream.status === 'scheduled' ? 'gold' : 'neutral'}
                    pulse={isLive}
                  />
                  <Text style={[styles.streamCreated, { color: colors.textMuted }] as any}>
                    {new Date(stream.created_at || Date.now()).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={[styles.streamCardTitle, { color: colors.text }] as any}>{stream.title}</Text>
                {stream.description ? (
                  <Text style={[styles.streamCardDescription, { color: colors.textSecondary }] as any}>
                    {stream.description}
                  </Text>
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
            dark={isDark}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  createCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
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
    letterSpacing: 0.8,
  },
  latencyLabel: {
    fontSize: 11,
    fontWeight: '900',
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
    borderWidth: 1,
  },
  latencyPillTitle: {
    fontSize: 13,
  },
  latencyPillDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 4,
  },
  successBox: {
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
    backgroundColor: '#140C07',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.yellow,
  },
  ingestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingestTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  ingestWarning: {
    fontSize: 12,
    color: '#E6CCB2',
    marginVertical: spacing.sm,
  },
  credentialField: {
    marginTop: spacing.sm,
    backgroundColor: '#2E1C11',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  credentialLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.yellow,
    letterSpacing: 0.5,
  },
  credentialValue: {
    color: '#FFFDF9',
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
    color: '#FFFDF9',
    fontSize: 11,
    fontWeight: '800',
  },
  streamCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  streamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  streamCreated: {
    fontSize: 12,
  },
  streamCardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  streamCardDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  streamCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
});

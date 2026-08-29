import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSession } from '@/state/session';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import {
  Badge,
  BottomSheet,
  Button,
  InputField,
  ResourceError,
  Skeleton,
} from '@/components';

interface StreamAccess {
  stream: {
    id: string;
    title: string;
    description: string;
    status: string;
    visibility: string;
  };
  playbackUrl: string | null;
  viewerSessionId: string | null;
  canChat: boolean;
  givingEnabled: boolean;
}

export default function LivePlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode } = useSession();
  const [access, setAccess] = useState<StreamAccess | null>(null);
  const [error, setError] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ id: string; user: string; text: string }>>([
    { id: '1', user: 'Pastor David', text: 'Welcome to today’s sanctuary broadcast!' },
    { id: '2', user: 'Sarah M.', text: 'Joining from London. Amen! 🙏' },
  ]);
  const [showSupportSheet, setShowSupportSheet] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  useEffect(() => {
    if (mode === 'visitor') {
      setError('Sign in to request secure broadcast access.');
      return;
    }

    api
      .request<StreamAccess>(`stream-access?id=${id}`, { method: 'POST' })
      .then(setAccess)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unable to join this broadcast')
      );
  }, [id, mode]);

  const player = useVideoPlayer(access?.playbackUrl ?? null, (playerInstance: any) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  // Viewer presence heartbeat
  useEffect(() => {
    if (!access?.viewerSessionId) return;
    const timer = setInterval(
      () =>
        api
          .request('stream-presence', {
            method: 'POST',
            body: JSON.stringify({ sessionId: access.viewerSessionId, action: 'heartbeat' }),
          })
          .catch(() => {}),
      30_000
    );

    return () => {
      clearInterval(timer);
      api
        .request('stream-presence', {
          method: 'POST',
          body: JSON.stringify({ sessionId: access.viewerSessionId, action: 'leave' }),
        })
        .catch(() => {});
    };
  }, [access?.viewerSessionId]);

  const sendInteraction = async (action: string, payload: Record<string, unknown> = {}) => {
    try {
      await api.request('live-interactions', {
        method: 'POST',
        body: JSON.stringify({ streamId: id, action, ...payload }),
      });
    } catch {
      // Non-blocking interaction
    }
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage.trim();
    setChatLog((prev) => [...prev, { id: Date.now().toString(), user: 'You', text: msg }]);
    setChatMessage('');
    sendInteraction('chat', { message: msg });
  };

  const handleFollowUpRequest = async (type: string) => {
    await sendInteraction('follow_up', { type });
    setSupportSent(true);
    setTimeout(() => {
      setShowSupportSheet(false);
      setSupportSent(false);
    }, 1800);
  };

  if (error) {
    return (
      <View style={styles.errorScreen}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>
        <View style={styles.errorWrapper}>
          <ResourceError offline={false} message={error} retry={() => router.back()} dark />
        </View>
      </View>
    );
  }

  if (!access) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton height={280} dark />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={28} width="70%" dark />
          <Skeleton height={16} width="90%" dark />
          <Skeleton height={16} width="50%" dark />
        </View>
      </View>
    );
  }

  const isLive = access.stream.status === 'live';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Video Player Container */}
      <View style={styles.videoPlayerBox}>
        {access.playbackUrl ? (
          <VideoView player={player} style={styles.videoView} allowsPictureInPicture nativeControls />
        ) : (
          <View style={styles.noVideoPlaceholder}>
            <Text style={styles.noVideoIcon}>📡</Text>
            <Text style={styles.noVideoTitle}>
              {isLive ? 'Connecting to live feed...' : 'Broadcast has not started yet'}
            </Text>
            <Text style={styles.noVideoSubtitle}>
              Live worship and sermon will appear when the broadcast begins.
            </Text>
          </View>
        )}

        <Pressable onPress={() => router.back()} style={styles.floatingBackButton}>
          <Text style={styles.floatingBackText}>‹</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stream Metadata Header */}
        <View style={styles.streamMetaBox}>
          <View style={styles.statusRow}>
            <Badge
              label={access.stream.status.toUpperCase()}
              variant={isLive ? 'live' : 'gold'}
              pulse={isLive}
            />
            <Text style={styles.visibilityLabel}>
              {access.stream.visibility === 'public' ? 'Public Broadcast' : 'Sanctuary Members'}
            </Text>
          </View>
          <Text style={styles.streamTitle}>{access.stream.title}</Text>
          {access.stream.description ? (
            <Text style={styles.streamDescription}>{access.stream.description}</Text>
          ) : null}
        </View>

        {/* Live Reaction Bar */}
        <View style={styles.reactionContainer}>
          <Text style={styles.reactionPrompt}>React live:</Text>
          <View style={styles.reactionButtonsRow}>
            {[
              ['❤️', 'heart', 'Amen'],
              ['🙏', 'prayer', 'Praying'],
              ['🔥', 'fire', 'Glory'],
              ['🙌', 'praise', 'Praise'],
            ].map(([emoji, reaction, label]) => (
              <Pressable
                key={reaction}
                onPress={() => sendInteraction('react', { reaction })}
                style={({ pressed }) => [styles.reactionPill, pressed && styles.pressed]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={styles.reactionLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Pastoral Prayer & Decision CTA */}
        <Pressable
          onPress={() => setShowSupportSheet(true)}
          style={({ pressed }) => [styles.altarCallBanner, shadows.glowGold, pressed && styles.pressed]}
        >
          <Text style={styles.altarIcon}>🕊️</Text>
          <View style={styles.altarContent}>
            <Text style={styles.altarTitle}>Need Prayer or Pastoral Support?</Text>
            <Text style={styles.altarSubtitle}>Our ministers are standing by in faith with you.</Text>
          </View>
          <Text style={styles.altarChevron}>›</Text>
        </Pressable>

        {/* Live Chat Stream */}
        {access.canChat && (
          <View style={styles.chatSection}>
            <Text style={styles.chatSectionTitle}>Live Sanctuary Conversation</Text>
            <View style={styles.chatLogBox}>
              {chatLog.map((chat) => (
                <View key={chat.id} style={styles.chatItem}>
                  <Text style={styles.chatUser}>{chat.user}:</Text>
                  <Text style={styles.chatText}>{chat.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chatInputRow}>
              <InputField
                value={chatMessage}
                onChangeText={setChatMessage}
                placeholder="Share a message or blessing..."
                dark
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
              <Button
                label="Send"
                onPress={handleSendChat}
                variant="gold"
                size="sm"
                style={{ marginLeft: spacing.sm, height: 50 }}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Pastoral Support & Altar Response Bottom Sheet */}
      <BottomSheet
        visible={showSupportSheet}
        onClose={() => setShowSupportSheet(false)}
        title="Sanctuary Pastoral Care"
        subtitle="Connect confidentially with our pastoral and prayer team."
      >
        {supportSent ? (
          <View style={styles.sentConfirmation}>
            <Text style={styles.sentEmoji}>🕊️</Text>
            <Text style={styles.sentTitle}>Your request has been received</Text>
            <Text style={styles.sentSubtitle}>
              Our pastoral care team has been notified and is praying with you.
            </Text>
          </View>
        ) : (
          <View style={styles.supportOptionsList}>
            {[
              ['🙏', 'I Need Prayer', 'prayer_request', 'Submit an urgent prayer request for our team.'],
              ['✝️', 'I Grew or Gave My Life to Christ', 'altar_response', 'Make a fresh decision for Jesus today.'],
              ['💬', 'I Request Pastoral Counselling', 'counselling', 'Speak with a pastor regarding life guidance.'],
              ['🏛️', 'I Want to Join This Church', 'membership_interest', 'Become a dedicated member of this congregation.'],
            ].map(([icon, label, type, description]) => (
              <Pressable
                key={type}
                onPress={() => handleFollowUpRequest(type)}
                style={({ pressed }) => [styles.supportCard, pressed && styles.pressed]}
              >
                <Text style={styles.supportCardIcon}>{icon}</Text>
                <View style={styles.supportCardContent}>
                  <Text style={styles.supportCardTitle}>{label}</Text>
                  <Text style={styles.supportCardDescription}>{description}</Text>
                </View>
                <Text style={styles.supportCardChevron}>➔</Text>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.midnight,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: palette.midnight,
    padding: spacing.lg,
    paddingTop: 60,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF1A',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: palette.white,
    fontWeight: '800',
  },
  errorWrapper: {
    marginTop: 40,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: palette.midnight,
  },
  videoPlayerBox: {
    height: 280,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoView: {
    flex: 1,
  },
  noVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noVideoIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  noVideoTitle: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  noVideoSubtitle: {
    color: '#8E9EB5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 48,
    left: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBackText: {
    color: palette.white,
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  streamMetaBox: {
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  visibilityLabel: {
    color: '#8E9EB5',
    fontSize: 12,
    fontWeight: '700',
  },
  streamTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.white,
    letterSpacing: -0.4,
  },
  streamDescription: {
    color: '#B8C4D6',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  reactionContainer: {
    backgroundColor: palette.surfaceDarkElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  reactionPrompt: {
    color: '#8E9EB5',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reactionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  reactionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF12',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  reactionEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  reactionLabel: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
  },
  altarCallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.gold,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  altarIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  altarContent: {
    flex: 1,
  },
  altarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.midnight,
  },
  altarSubtitle: {
    fontSize: 12,
    color: '#3B2F0B',
    marginTop: 2,
  },
  altarChevron: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.midnight,
    marginLeft: spacing.sm,
  },
  chatSection: {
    backgroundColor: palette.surfaceDarkElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chatSectionTitle: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  chatLogBox: {
    minHeight: 120,
    maxHeight: 200,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  chatItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 3,
  },
  chatUser: {
    color: palette.gold,
    fontWeight: '800',
    fontSize: 13,
    marginRight: 6,
  },
  chatText: {
    color: palette.white,
    fontSize: 13,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportOptionsList: {
    gap: spacing.sm,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceSubtle,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
  },
  supportCardIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  supportCardContent: {
    flex: 1,
  },
  supportCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.ink,
  },
  supportCardDescription: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  supportCardChevron: {
    fontSize: 14,
    color: palette.blue,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  sentConfirmation: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  sentEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  sentTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.ink,
    textAlign: 'center',
  },
  sentSubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

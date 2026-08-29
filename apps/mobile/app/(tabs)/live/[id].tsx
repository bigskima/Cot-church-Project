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
    { id: '3', user: 'Emmanuel K.', text: 'Hallelujah, glory to God! 🔥' },
  ]);
  const [showSupportSheet, setShowSupportSheet] = useState(false);
  const [supportName, setSupportName] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [supportSent, setSupportSent] = useState(false);

  useEffect(() => {
    if (mode === 'visitor') {
      // Fetch stream details directly from public-content
      api
        .request<{ data: Array<{ id: string; title: string; description: string; status: string; playback_url: string; visibility: string }> }>(
          `public-content?type=streams`
        )
        .then((res) => {
          const match = res.data?.find((s) => s.id === id) ?? res.data?.[0];
          if (match) {
            setAccess({
              stream: {
                id: match.id,
                title: match.title,
                description: match.description,
                status: match.status,
                visibility: match.visibility,
              },
              playbackUrl: match.playback_url,
              viewerSessionId: `guest_${Date.now()}`,
              canChat: true,
              givingEnabled: true,
            });
          } else {
            // Fallback preview stream
            setAccess({
              stream: {
                id: id ?? 'stream-1',
                title: 'Sunday Sanctuary Live Worship',
                description: 'Join us live for praise, prayer, and word of transformation.',
                status: 'live',
                visibility: 'public',
              },
              playbackUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
              viewerSessionId: `guest_${Date.now()}`,
              canChat: true,
              givingEnabled: true,
            });
          }
        })
        .catch(() => {
          setAccess({
            stream: {
              id: id ?? 'stream-1',
              title: 'Sunday Sanctuary Live Worship',
              description: 'Join us live for praise, prayer, and word of transformation.',
              status: 'live',
              visibility: 'public',
            },
            playbackUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            viewerSessionId: `guest_${Date.now()}`,
            canChat: true,
            givingEnabled: true,
          });
        });
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
    if (!access?.viewerSessionId || mode === 'visitor') return;
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
  }, [access?.viewerSessionId, mode]);

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
    setChatLog((prev) => [...prev, { id: Date.now().toString(), user: mode === 'visitor' ? 'Guest Visitor' : 'You', text: msg }]);
    setChatMessage('');
    sendInteraction('chat', { message: msg });
  };

  const handleFollowUpRequest = async (type: string) => {
    await sendInteraction('follow_up', {
      type,
      name: supportName || 'Sanctuary Participant',
      contact: supportContact,
    });
    setSupportSent(true);
    setTimeout(() => {
      setShowSupportSheet(false);
      setSupportSent(false);
      setSupportName('');
      setSupportContact('');
    }, 1800);
  };

  if (error) {
    return (
      <View style={styles.errorScreen}>
        <Pressable onPress={() => router.back()} style={styles.backButton as any}>
          <Text style={styles.backButtonText as any}>‹ Back</Text>
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
          <Skeleton height={24} width="70%" dark />
          <Skeleton height={16} width="40%" dark />
          <Skeleton height={120} dark />
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
      {/* Top Header Navigation Overlay */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navPill, pressed && styles.pressed] as any}
        >
          <Text style={styles.navPillText as any}>‹ Leave Live Stage</Text>
        </Pressable>
        <Badge
          label={isLive ? '● Live Sanctuary' : 'Broadcast Archive'}
          variant={isLive ? 'live' : 'gold'}
          pulse={isLive}
        />
      </View>

      {/* Video Player Stage */}
      <View style={styles.videoStage}>
        {access.playbackUrl ? (
          <VideoView
            player={player}
            style={styles.videoView}
            nativeControls
            allowsPictureInPicture
          />
        ) : (
          <View style={styles.streamOfflineBox}>
            <Text style={styles.streamOfflineIcon as any}>📡</Text>
            <Text style={styles.streamOfflineTitle as any}>Broadcast Preparing</Text>
            <Text style={styles.streamOfflineDesc as any}>
              The sanctuary audio/video feed is synchronizing. Please stand by.
            </Text>
          </View>
        )}
      </View>

      {/* Broadcast Metadata & Quick Actions */}
      <View style={styles.metadataSection}>
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.streamTitle as any}>{access.stream.title}</Text>
            <Text style={styles.streamDesc as any} numberOfLines={1}>
              {access.stream.description || 'Public live worship gathering.'}
            </Text>
          </View>
          <Button
            label="🤍 Give"
            onPress={() => router.push('/(tabs)/profile/giving')}
            variant="gold"
            size="sm"
          />
        </View>

        {/* Reaction Row */}
        <View style={styles.reactionBar}>
          {[
            ['🙏', 'pray', 'Amen'],
            ['🔥', 'fire', 'Glory'],
            ['❤️', 'love', 'Love'],
            ['✨', 'praise', 'Praise'],
          ].map(([emoji, action, label]) => (
            <Pressable
              key={action}
              onPress={() => sendInteraction('reaction', { emoji })}
              style={({ pressed }) => [styles.reactionPill, pressed && styles.pressed] as any}
            >
              <Text style={styles.reactionEmoji as any}>{emoji}</Text>
              <Text style={styles.reactionLabel as any}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowSupportSheet(true)}
            style={({ pressed }) => [styles.altarCallBtn, pressed && styles.pressed] as any}
          >
            <Text style={styles.altarCallText as any}>🕊️ Altar & Prayer</Text>
          </Pressable>
        </View>
      </View>

      {/* Real-Time Live Chat Feed */}
      <View style={styles.chatContainer}>
        <Text style={styles.chatHeading as any}>LIVE FELLOWSHIP CHAT</Text>
        <ScrollView style={styles.chatLog} contentContainerStyle={styles.chatLogContent}>
          {chatLog.map((chat) => (
            <View key={chat.id} style={styles.chatBubble}>
              <Text style={styles.chatUser as any}>{chat.user}: </Text>
              <Text style={styles.chatText as any}>{chat.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Chat Input Bar */}
        <View style={styles.chatInputRow}>
          <InputField
            value={chatMessage}
            onChangeText={setChatMessage}
            placeholder="Type a message of agreement..."
            style={styles.chatInput as any}
          />
          <Button
            label="Send"
            onPress={handleSendChat}
            variant="gold"
            size="sm"
            style={styles.sendButton as any}
          />
        </View>
      </View>

      {/* Altar Call & Pastoral Care Bottom Sheet */}
      <BottomSheet
        visible={showSupportSheet}
        onClose={() => setShowSupportSheet(false)}
        title="Sanctuary Pastoral Care & Decision"
      >
        {supportSent ? (
          <View style={styles.sheetSuccessBox}>
            <Text style={styles.sheetSuccessIcon as any}>🕊️</Text>
            <Text style={styles.sheetSuccessTitle as any}>We Are Standing In Prayer With You</Text>
            <Text style={styles.sheetSuccessDesc as any}>
              A pastoral team minister has received your response and will reach out with care and confidential prayer.
            </Text>
          </View>
        ) : (
          <View style={styles.sheetBody}>
            <Text style={styles.sheetDesc as any}>
              If God has touched your heart today or you need personal prayer, select an option below:
            </Text>

            {mode === 'visitor' && (
              <View style={{ marginBottom: spacing.md }}>
                <InputField
                  label="Your Name"
                  value={supportName}
                  onChangeText={setSupportName}
                  placeholder="e.g. Michael"
                />
                <InputField
                  label="Phone or Email (for pastoral follow-up)"
                  value={supportContact}
                  onChangeText={setSupportContact}
                  placeholder="michael@example.com / (555) 000-1234"
                />
              </View>
            )}

            <View style={styles.decisionOptions}>
              <Button
                label="✝ I Surrender My Life to Jesus"
                onPress={() => handleFollowUpRequest('salvation_decision')}
                variant="gold"
                size="md"
              />
              <Button
                label="🙏 I Need Confidential Pastoral Prayer"
                onPress={() => handleFollowUpRequest('urgent_prayer')}
                variant="primary"
                size="md"
              />
              <Button
                label="🏛 I Want to Connect with Church Expression"
                onPress={() => handleFollowUpRequest('membership_interest')}
                variant="outline"
                size="md"
              />
            </View>
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
  topBar: {
    paddingTop: 54,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.midnight,
  },
  navPill: {
    backgroundColor: '#0F1F38',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  navPillText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
  },
  videoStage: {
    width: '100%',
    height: 250,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  streamOfflineBox: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  streamOfflineIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  streamOfflineTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.white,
  },
  streamOfflineDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  metadataSection: {
    padding: spacing.md,
    backgroundColor: '#0A172C',
    borderBottomWidth: 1,
    borderBottomColor: '#172B50',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.white,
  },
  streamDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16284C',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.white,
  },
  altarCallBtn: {
    backgroundColor: palette.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginLeft: 'auto',
  },
  altarCallText: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.midnight,
  },
  chatContainer: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: palette.midnight,
  },
  chatHeading: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  chatLog: {
    flex: 1,
  },
  chatLogContent: {
    paddingVertical: spacing.xs,
    gap: 6,
  },
  chatBubble: {
    flexDirection: 'row',
    backgroundColor: '#0D1B33',
    padding: 8,
    borderRadius: radius.sm,
  },
  chatUser: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.gold,
  },
  chatText: {
    fontSize: 12,
    color: palette.white,
    flex: 1,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chatInput: {
    flex: 1,
  },
  sendButton: {
    height: 44,
  },
  sheetBody: {
    gap: spacing.md,
  },
  sheetDesc: {
    fontSize: 14,
    color: palette.inkSecondary,
    lineHeight: 20,
  },
  decisionOptions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetSuccessBox: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  sheetSuccessIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  sheetSuccessTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.ink,
    textAlign: 'center',
  },
  sheetSuccessDesc: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: palette.midnight,
    paddingTop: 54,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
  },
  errorWrapper: {
    padding: spacing.lg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: palette.midnight,
  },
  pressed: {
    opacity: 0.85,
  },
});

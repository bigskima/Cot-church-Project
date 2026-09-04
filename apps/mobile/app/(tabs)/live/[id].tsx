import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Icon,
  InputField,
  ResourceError,
  Skeleton,
} from '@/components';
import type { LiveStream } from '@/types/content';

interface StreamAccess {
  stream: LiveStream;
  playbackUrl: string | null;
  viewerSessionId: string | null;
  canChat: boolean;
  givingEnabled: boolean;
}

export default function LivePlayerScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode, context } = useSession();
  const { colors, isDark } = useTheme();

  const [access, setAccess] = useState<StreamAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ id: string; user: string; text: string; time: string }>>([]);
  const [showSupportSheet, setShowSupportSheet] = useState(false);
  const [supportName, setSupportName] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [interactionError, setInteractionError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    const fetchStream = async () => {
      try {
        if (mode === 'visitor') {
          const res = await api.request<LiveStream[]>(`public-content?type=streams`);
          const match = res.find((s) => s.id === id);
          if (!match) throw new Error('Live broadcast not found.');
          if (isMounted) {
            setAccess({
              stream: match,
              playbackUrl: match.playback_url ?? null,
              viewerSessionId: null,
              canChat: false,
              givingEnabled: true,
            });
          }
        } else {
          const data = await api.request<StreamAccess>('stream-access', {
            method: 'POST',
            context: context?.expression?.id ? 'current' : 'public',
            body: JSON.stringify({ streamId: id }),
          });
          if (isMounted) setAccess(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to connect to live broadcast.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStream();
    return () => {
      isMounted = false;
    };
  }, [api, context?.expression?.id, id, mode]);

  const player = useVideoPlayer(access?.playbackUrl ?? '', (p) => {
    p.loop = false;
    p.play();
  });

  const isLive = access?.stream.status === 'live';

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;
    if (mode === 'visitor' || !access?.canChat) {
      router.push('/(auth)/login');
      return;
    }
    const text = chatMessage.trim();
    setInteractionError('');
    try {
      const result = await api.request<{ id?: string; created_at?: string }>('live-interactions', {
        method: 'POST',
        context: context?.expression?.id ? 'current' : 'public',
        body: JSON.stringify({ action: 'chat', streamId: id, message: text }),
      });
      setChatLog((prev) => [...prev, {
        id: result.id ?? `${id}:${result.created_at ?? Date.now()}`,
        user: context?.profile?.display_name || 'Member',
        text,
        time: new Date(result.created_at ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setChatMessage('');
    } catch (value) {
      setInteractionError(value instanceof Error ? value.message : 'Unable to send this message.');
    }
  };

  const submitSupport = async () => {
    if (!supportName.trim()) return;
    if (mode === 'visitor') {
      setShowSupportSheet(false);
      router.push('/(auth)/login');
      return;
    }
    setInteractionError('');
    try {
      await api.request('live-interactions', {
        method: 'POST',
        context: context?.expression?.id ? 'current' : 'public',
        body: JSON.stringify({
          action: 'follow_up',
          streamId: id,
          userName: supportName.trim(),
          contact: supportContact.trim(),
        }),
      });
    } catch (value) {
      setInteractionError(value instanceof Error ? value.message : 'Unable to submit this prayer request.');
      return;
    }
    setSupportSent(true);
    setTimeout(() => {
      setShowSupportSheet(false);
      setSupportSent(false);
      setSupportName('');
      setSupportContact('');
    }, 1500);
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Skeleton height={240} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={20} width="40%" />
          <Skeleton height={120} />
        </View>
      </View>
    );
  }

  if (error || !access) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back to Live</Text>
        </Pressable>
        <View style={styles.errorPad}>
          <ResourceError message={error || 'Broadcast unavailable.'} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 16:9 Live Video Player Viewport */}
      <View style={[styles.videoContainer, { marginTop: insets.top }]}>
        {access.playbackUrl ? (
          <VideoView
            player={player}
            style={styles.videoView}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Icon name="radio" size={48} color="#5C8FF5" />
            <Text style={styles.placeholderText}>
              {isLive ? 'Connecting to live video stream...' : 'Broadcast is currently offline.'}
            </Text>
          </View>
        )}

        {/* Floating Top Controls */}
        <View style={styles.playerTopBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.playerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close broadcast"
          >
            <Icon name="chevron-down" size={22} color="#FFFFFF" />
          </Pressable>
          <Badge
            label={isLive ? 'LIVE' : 'OFFLINE'}
            variant={isLive ? 'live' : 'neutral'}
            pulse={isLive}
          />
        </View>
      </View>

      {/* Stream Info Header */}
      <View style={[styles.streamInfoBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.infoCol}>
          <Text style={[styles.streamTitle, { color: colors.text }]} numberOfLines={1}>
            {access.stream.title}
          </Text>
          {access.stream.description ? (
            <Text style={[styles.streamDesc, { color: colors.textMuted }]} numberOfLines={1}>
              {access.stream.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionPillsRow}>
          {access.givingEnabled && (
            <Pressable
              onPress={() => router.push('/(tabs)/profile/giving' as any)}
              style={[styles.givingPill, { backgroundColor: colors.primarySoft }]}
            >
              <Icon name="gift-outline" size={14} color={colors.interactive} />
              <Text style={[styles.givingPillText, { color: colors.interactive }]}>Give</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => mode === 'visitor' ? router.push('/(auth)/login') : setShowSupportSheet(true)}
            style={[styles.prayerPill, { backgroundColor: colors.bgSecondary }]}
          >
            <Icon name="heart-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.prayerPillText, { color: colors.textSecondary }]}>Prayer</Text>
          </Pressable>
        </View>
      </View>

      {/* Live Fellowship Chat Feed */}
      <View style={styles.chatSection}>
        {interactionError ? <Text style={[styles.interactionError, { color: colors.live }]} accessibilityRole="alert">{interactionError}</Text> : null}
        <FlatList
          data={chatLog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.chatBubble}>
              <Text style={[styles.chatUser, { color: colors.interactive }]}>
                {item.user}:{' '}
              </Text>
              <Text style={[styles.chatText, { color: colors.text }]}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.chatEmpty}>
              <Text style={[styles.chatEmptyText, { color: colors.textMuted }]}>
                {access.canChat ? 'No confirmed chat messages are loaded yet.' : 'Sign in to participate in live fellowship chat.'}
              </Text>
            </View>
          )}
        />

        {/* Chat Input Box */}
        {access.canChat ? <View style={[styles.chatInputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
          <TextInput
            value={chatMessage}
            onChangeText={setChatMessage}
            placeholder="Type in live fellowship chat..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.chatInput,
              { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
            ]}
          />
          <Pressable
            onPress={handleSendChat}
            disabled={!chatMessage.trim()}
            style={({ pressed }) => [
              styles.sendChatBtn,
              {
                backgroundColor: chatMessage.trim() ? colors.interactive : colors.bgSecondary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Icon name="arrow-up" size={18} color={chatMessage.trim() ? '#FFFFFF' : colors.textMuted} />
          </Pressable>
        </View> : (
          <Pressable onPress={() => router.push('/(auth)/login')} accessibilityRole="button" style={[styles.signInChat, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <Icon name="log-in-outline" size={17} color={colors.interactive} />
            <Text style={[styles.signInChatText, { color: colors.interactive }]}>Sign in to join live chat</Text>
          </Pressable>
        )}
      </View>

      {/* Pastoral Prayer Request Bottom Sheet */}
      <BottomSheet
        visible={showSupportSheet}
        onClose={() => setShowSupportSheet(false)}
        title="Request Pastoral Prayer"
      >
        {supportSent ? (
          <View style={styles.sentWrap}>
            <Icon name="checkmark-circle" size={40} color="#16A36A" />
            <Text style={[styles.sentTitle, { color: colors.text }]}>Prayer Request Received</Text>
            <Text style={[styles.sentSub, { color: colors.textSecondary }]}>
              Our ministerial team is standing in faith with you.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <InputField
              label="Your Name / Request"
              value={supportName}
              onChangeText={setSupportName}
              placeholder="e.g. Prayer for healing / provision"
            />
            <InputField
              label="Contact / WhatsApp (Optional)"
              value={supportContact}
              onChangeText={setSupportContact}
              placeholder="+1 555 0199"
            />
            <Button
              label="Submit Prayer Request"
              onPress={submitSupport}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#061426',
    position: 'relative',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  placeholderText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  playerTopBar: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(6, 20, 38, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  infoCol: {
    flex: 1,
    gap: 1,
  },
  streamTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  streamDesc: {
    fontSize: 11,
  },
  actionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  givingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  givingPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  prayerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  prayerPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chatSection: {
    flex: 1,
  },
  interactionError: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
  },
  chatList: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  chatBubble: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  chatUser: {
    fontSize: 13,
    fontWeight: '700',
  },
  chatText: {
    fontSize: 13,
  },
  chatEmpty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  chatEmptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  chatInput: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  sendChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInChat: {
    minHeight: 52,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  signInChatText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorPad: {
    padding: spacing.lg,
  },
  sentWrap: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sentTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sentSub: {
    fontSize: 13,
    textAlign: 'center',
  },
});

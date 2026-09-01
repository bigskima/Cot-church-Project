import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Icon,
  InputField,
  LoadingSpinner,
  ResourceError,
  ScreenHeader,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import type { LiveStream } from '@/types/content';

interface LiveAccess {
  stream: LiveStream;
  playbackUrl: string | null;
  viewerSessionId: string;
  canChat: boolean;
  givingEnabled: boolean;
}

interface ChatMessage {
  id: string;
  user_name: string;
  avatar_url?: string;
  message: string;
  timestamp: string;
}

export default function LivePlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors, isDark } = useTheme();

  const [access, setAccess] = useState<LiveAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Prayer Sheet Modal
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');
  const [prayerSubmitting, setPrayerSubmitting] = useState(false);
  const [prayerSuccess, setPrayerSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadStream() {
      try {
        setLoading(true);
        setError(null);

        if (mode === 'visitor') {
          const res = await api.request<LiveStream[]>(`public-content?type=streams`);
          const match = res.find((s) => s.id === id) ?? res[0];
          if (!match) throw new Error('Live broadcast not found.');
          if (isMounted) {
            setAccess({
              stream: match,
              playbackUrl: match.playback_url ?? null,
              viewerSessionId: `guest_${Date.now()}`,
              canChat: true,
              givingEnabled: true,
            });
          }
        } else {
          const streamData = await api.request<LiveStream>(`live-streams?id=${id}`);
          let accessData: { playbackUrl: string | null; viewerSessionId: string } = {
            playbackUrl: streamData.playback_url ?? null,
            viewerSessionId: `member_${Date.now()}`,
          };
          try {
            const tokenRes = await api.request<{ playbackUrl: string; viewerSessionId: string }>(
              'stream-access',
              {
                method: 'POST',
                body: JSON.stringify({ streamId: id }),
              }
            );
            if (tokenRes?.playbackUrl) {
              accessData = tokenRes;
            }
          } catch {
            // Fallback to streamData playbackUrl
          }

          if (isMounted) {
            setAccess({
              stream: streamData,
              playbackUrl: accessData.playbackUrl,
              viewerSessionId: accessData.viewerSessionId,
              canChat: true,
              givingEnabled: true,
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to join broadcast.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStream();
    return () => {
      isMounted = false;
    };
  }, [id, mode]);

  const player = useVideoPlayer(access?.playbackUrl || '', (p) => {
    p.loop = false;
    p.play();
  });

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg: ChatMessage = {
      id: `chat_${Date.now()}`,
      user_name: context?.profile?.display_name || 'Fellowship Member',
      avatar_url: context?.profile?.avatar_url,
      message: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [newMsg, ...prev]);
    setChatInput('');
  };

  const handleSendPrayer = async () => {
    if (!prayerTitle.trim()) return;
    setPrayerSubmitting(true);
    try {
      await api.request('prayer-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: prayerTitle.trim(),
          request: prayerRequest.trim(),
          privacy: 'pastoral_only',
        }),
      });
      setPrayerSuccess(true);
      setTimeout(() => {
        setPrayerOpen(false);
        setPrayerSuccess(false);
        setPrayerTitle('');
        setPrayerRequest('');
      }, 1500);
    } catch {
      alert('Unable to submit pastoral prayer request.');
    } finally {
      setPrayerSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <LoadingSpinner label="Connecting to Live Broadcast..." />
      </View>
    );
  }

  if (error || !access) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <ResourceError message={error || 'Stream not found'} />
      </View>
    );
  }

  const stream = access.stream;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {/* 16:9 Live Video Player (Dominant surface) */}
      <View style={[styles.playerFrame, { paddingTop: insets.top, backgroundColor: '#000000' }]}>
        {access.playbackUrl && player ? (
          <VideoView
            player={player}
            style={styles.videoView}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Icon name="radio" size={48} color={colors.interactive} />
            <Text style={styles.placeholderText}>
              {stream.status === 'live' ? 'Connecting to live video feed...' : 'Broadcast Scheduled'}
            </Text>
          </View>
        )}

        {/* Live Top Overlay Bar */}
        <View style={[styles.playerHeaderOverlay, { top: insets.top + spacing.xs }]}>
          <ScreenHeader
            title=""
            showBack
            style={{ backgroundColor: 'transparent' }}
          />
          <View style={styles.liveBadgeRow}>
            <Badge
              label={stream.status.toUpperCase()}
              variant={stream.status === 'live' ? 'live' : 'primary'}
              pulse={stream.status === 'live'}
            />
          </View>
        </View>
      </View>

      {/* Stream Info & Action Bar */}
      <View style={[styles.infoBar, { backgroundColor: colors.card, borderBottomColor: colors.borderSubtle }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.streamTitle, { color: colors.text }]} numberOfLines={1}>
            {stream.title}
          </Text>
          <Text style={[styles.streamMeta, { color: colors.textSecondary }]}>
            {stream.started_at ? `Started ${new Date(stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Church Sanctuary'}
          </Text>
        </View>

        <Button
          label="Pastoral Prayer"
          onPress={() => setPrayerOpen(true)}
          variant="outline"
          size="sm"
          icon={<Icon name="heart-outline" size={14} color={colors.interactive} />}
        />
      </View>

      {/* Fellowship Live Chat */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatArea}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => (
            <View style={styles.chatMessageRow}>
              <Avatar url={item.avatar_url} name={item.user_name} size="xs" />
              <View style={styles.chatBubble}>
                <View style={styles.chatMetaLine}>
                  <Text style={[styles.chatUser, { color: colors.interactive }]}>{item.user_name}</Text>
                  <Text style={[styles.chatTime, { color: colors.textMuted }]}>{item.timestamp}</Text>
                </View>
                <Text style={[styles.chatText, { color: colors.text }]}>{item.message}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                Welcome to fellowship chat! Say amen or share where you're worshipping from.
              </Text>
            </View>
          }
        />

        {/* Chat Input Bar */}
        <View style={[styles.chatInputRow, { backgroundColor: colors.card, borderTopColor: colors.borderSubtle }]}>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Send fellowship message..."
            placeholderTextColor={colors.textMuted}
            style={[styles.chatTextInput, { color: colors.text, backgroundColor: colors.bgSecondary }]}
          />
          <Pressable
            onPress={handleSendMessage}
            disabled={!chatInput.trim()}
            style={[
              styles.sendBtn,
              {
                backgroundColor: colors.interactive,
                opacity: chatInput.trim() ? 1 : 0.4,
              },
            ]}
          >
            <Icon name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Pastoral Prayer Petition Sheet */}
      <BottomSheet
        visible={prayerOpen}
        onClose={() => setPrayerOpen(false)}
        title="Live Pastoral Prayer"
      >
        <View style={styles.prayerSheetBody}>
          {prayerSuccess ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Icon name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={{ color: '#10B981', fontWeight: '600' }}>
                Your prayer petition has been received by the pastoral team.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.prayerSubtitle, { color: colors.textSecondary }]}>
                Submit a confidential prayer request to our pastoral ministry team during this service.
              </Text>

              <InputField
                label="Prayer Title / Focus"
                value={prayerTitle}
                onChangeText={setPrayerTitle}
                placeholder="e.g. Healing, Family Breakthrough"
              />

              <InputField
                label="Petition Details"
                value={prayerRequest}
                onChangeText={setPrayerRequest}
                multiline
                numberOfLines={3}
                placeholder="Share your specific request..."
              />

              <Button
                label="Submit Confidential Petition"
                onPress={handleSendPrayer}
                loading={prayerSubmitting}
                variant="primary"
                size="md"
                style={{ marginTop: spacing.xs }}
              />
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#000000',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  playerHeaderOverlay: {
    position: 'absolute',
    left: 0,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  liveBadgeRow: {
    marginTop: spacing.sm,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  streamMeta: {
    fontSize: 12,
  },
  chatArea: {
    flex: 1,
  },
  chatList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  chatMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  chatBubble: {
    flex: 1,
    gap: 2,
  },
  chatMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatUser: {
    fontSize: 12,
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 10,
  },
  chatText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyChat: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyChatText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  chatTextInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayerSheetBody: {
    gap: spacing.md,
  },
  prayerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
});

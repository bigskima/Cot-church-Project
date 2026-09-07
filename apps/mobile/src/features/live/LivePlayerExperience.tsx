import React, { useCallback, useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Chip,
  Icon,
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

interface LiveChatMessage {
  id: string;
  profileId?: string | null;
  user: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: string;
}

type FollowUpType = 'prayer_request' | 'altar_response' | 'counselling' | 'membership_interest';

const followUpOptions: Array<{ value: FollowUpType; label: string; description: string }> = [
  { value: 'prayer_request', label: 'Prayer request', description: 'Ask the pastoral or prayer team to stand with you.' },
  { value: 'altar_response', label: 'Altar response', description: 'Let the ministry team know you responded during the service.' },
  { value: 'counselling', label: 'Counselling', description: 'Request a private pastoral conversation or follow-up.' },
  { value: 'membership_interest', label: 'Membership / next steps', description: 'Ask for help connecting more deeply with the church.' },
];

function streamPresentation(stream: LiveStream) {
  const scheduled = stream.scheduled_start
    ? new Date(stream.scheduled_start).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  switch (stream.status) {
    case 'scheduled':
      return {
        label: 'SCHEDULED',
        variant: 'primary' as const,
        icon: 'calendar-outline' as const,
        message: scheduled ? `Scheduled for ${scheduled}.` : 'This broadcast is scheduled and will open when it begins.',
      };
    case 'provisioning':
      return {
        label: 'PREPARING',
        variant: 'warning' as const,
        icon: 'cloud-upload-outline' as const,
        message: 'COT is preparing the broadcast service. You can remain on this page and try again shortly.',
      };
    case 'ready':
      return {
        label: 'READY',
        variant: 'active' as const,
        icon: 'radio-outline' as const,
        message: scheduled ? `Broadcast setup is ready for ${scheduled}.` : 'Broadcast setup is ready. Video will begin when the service goes live.',
      };
    case 'live':
      return {
        label: 'LIVE',
        variant: 'live' as const,
        icon: 'radio' as const,
        message: 'You are watching the live COT broadcast.',
      };
    case 'ended':
      return {
        label: 'ENDED',
        variant: 'neutral' as const,
        icon: 'time-outline' as const,
        message: 'The live service has ended. Its replay will appear when recording preparation is complete.',
      };
    case 'processing':
      return {
        label: 'PROCESSING',
        variant: 'warning' as const,
        icon: 'hourglass-outline' as const,
        message: 'The service has ended and its replay is being prepared.',
      };
    case 'replay_ready':
      return {
        label: 'REPLAY',
        variant: 'primary' as const,
        icon: 'play-circle-outline' as const,
        message: 'The replay is ready to watch.',
      };
    case 'failed':
      return {
        label: 'UNAVAILABLE',
        variant: 'neutral' as const,
        icon: 'alert-circle-outline' as const,
        message: 'This broadcast could not be completed. Please check back later or choose another service.',
      };
    default:
      return {
        label: stream.status.replace(/_/g, ' ').toUpperCase(),
        variant: 'neutral' as const,
        icon: 'radio-outline' as const,
        message: 'This broadcast is not currently available for playback.',
      };
  }
}

export function LivePlayerExperience({ streamId: id, scope = 'general', embedded = false }: { streamId: string; scope?: 'general' | 'expression'; embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [access, setAccess] = useState<StreamAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState<LiveChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [showSupportSheet, setShowSupportSheet] = useState(false);
  const [supportType, setSupportType] = useState<FollowUpType>('prayer_request');
  const [supportSent, setSupportSent] = useState(false);
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [interactionError, setInteractionError] = useState('');

  const expressionMode = scope === 'expression';
  const topInset = embedded ? 0 : insets.top;
  const activeExpressionId = expressionMode ? context?.expression?.id : undefined;
  const requestContext = expressionMode ? 'current' : 'public';
  const returnTo = expressionMode && activeExpressionId ? `/expressions/${activeExpressionId}/live/${id}` : `/live/${id}`;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    const fetchStream = async () => {
      try {
        // Discovery is public, but playback always resolves through stream-access
        // so signed provider URLs are never exposed directly in catalogue data.
        if (expressionMode && !activeExpressionId) {
          throw new Error('Enter this Expression to view its internal broadcast.');
        }
        const data = await api.request<StreamAccess>(
          `stream-access?id=${encodeURIComponent(id)}`,
          { method: 'POST', context: mode === 'visitor' ? 'public' : requestContext },
        );
        if (expressionMode) {
          const streamExpressionId = data.stream.expression_id ?? data.stream.branch_id ?? null;
          if (streamExpressionId !== activeExpressionId) {
            throw new Error('This broadcast is not part of this Expression.');
          }
        }
        if (isMounted) setAccess(data);
      } catch (value) {
        if (isMounted) {
          setError(value instanceof Error ? value.message : 'Unable to connect to live broadcast.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchStream();
    return () => {
      isMounted = false;
    };
  }, [activeExpressionId, api, expressionMode, id, mode, requestContext]);

  const player = useVideoPlayer(access?.playbackUrl ?? '', (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.play();
  });

  const isLive = access?.stream.status === 'live';
  const showFellowshipHistory = Boolean(access && ['live', 'ended', 'processing', 'replay_ready'].includes(access.stream.status));
  const presentation = access ? streamPresentation(access.stream) : null;

  const loadChat = useCallback(async (showLoading = false) => {
    if (mode !== 'authenticated' || !id || !showFellowshipHistory) return;
    if (showLoading) setChatLoading(true);
    try {
      const messages = await api.request<LiveChatMessage[]>(
        `live-interactions?streamId=${encodeURIComponent(id)}`,
        { context: requestContext },
      );
      setChatLog(messages);
    } catch (value) {
      if (showLoading) {
        setInteractionError(value instanceof Error ? value.message : 'Unable to load live chat.');
      }
    } finally {
      if (showLoading) setChatLoading(false);
    }
  }, [api, id, mode, requestContext, showFellowshipHistory]);

  useEffect(() => {
    if (mode !== 'authenticated' || !access?.stream.id || !showFellowshipHistory) {
      setChatLog([]);
      return;
    }
    void loadChat(true);
    if (!isLive) return;

    const interval = setInterval(() => {
      void loadChat(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [access?.stream.id, isLive, loadChat, mode, showFellowshipHistory]);

  useEffect(() => {
    const viewerSessionId = access?.viewerSessionId;
    if (mode !== 'authenticated' || !viewerSessionId) return;

    const updatePresence = (action: 'heartbeat' | 'leave') =>
      api.request('stream-presence', {
        method: 'POST',
        context: requestContext,
        body: JSON.stringify({ sessionId: viewerSessionId, action }),
      });

    const interval = setInterval(() => {
      void updatePresence('heartbeat').catch(() => {});
    }, 30_000);

    return () => {
      clearInterval(interval);
      void updatePresence('leave').catch(() => {});
    };
  }, [access?.viewerSessionId, api, mode, requestContext]);

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;
    if (mode === 'visitor') {
      router.push({ pathname: '/(auth)/login', params: { returnTo } } as any);
      return;
    }
    if (!access?.canChat) {
      setInteractionError('Live chat is available to active church members while the broadcast is live.');
      return;
    }

    const text = chatMessage.trim();
    setInteractionError('');
    try {
      await api.request('live-interactions', {
        method: 'POST',
        context: requestContext,
        body: JSON.stringify({ action: 'chat', streamId: id, message: text }),
      });
      setChatMessage('');
      await loadChat(false);
    } catch (value) {
      setInteractionError(value instanceof Error ? value.message : 'Unable to send this message.');
    }
  };

  const submitSupport = async () => {
    if (mode === 'visitor') {
      setShowSupportSheet(false);
      router.push({ pathname: '/(auth)/login', params: { returnTo } } as any);
      return;
    }

    setInteractionError('');
    setSupportSubmitting(true);
    try {
      await api.request('live-interactions', {
        method: 'POST',
        context: requestContext,
        body: JSON.stringify({
          action: 'follow_up',
          streamId: id,
          type: supportType,
        }),
      });
      setSupportSent(true);
    } catch (value) {
      setInteractionError(value instanceof Error ? value.message : 'Unable to submit this follow-up request.');
    } finally {
      setSupportSubmitting(false);
    }
  };

  const closeSupport = () => {
    if (supportSubmitting) return;
    setShowSupportSheet(false);
    setSupportSent(false);
    setSupportType('prayer_request');
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: topInset }]}>
        <Skeleton height={240} />
        <View style={styles.loadingBody}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={20} width="40%" />
          <Skeleton height={120} />
        </View>
      </View>
    );
  }

  if (error || !access) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: topInset }]}>
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
      <View style={[styles.videoContainer, { marginTop: topInset }]}>
        {access.playbackUrl ? (
          <VideoView player={player} style={styles.videoView} />
        ) : (
          <View style={styles.videoPlaceholder}>
            <View style={styles.placeholderIcon}>
              <Icon name={presentation?.icon ?? 'radio-outline'} size={42} color="#168FF0" />
            </View>
            <Text style={styles.placeholderTitle}>{presentation?.label ?? 'BROADCAST'}</Text>
            <Text style={styles.placeholderText}>{presentation?.message ?? 'This broadcast is currently unavailable.'}</Text>
          </View>
        )}

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
            label={presentation?.label ?? 'BROADCAST'}
            variant={presentation?.variant ?? 'neutral'}
            pulse={isLive}
          />
        </View>
      </View>

      <View style={[styles.streamInfoBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        <View style={styles.infoCol}>
          <Text style={[styles.streamTitle, { color: colors.text }]} numberOfLines={2}>{access.stream.title}</Text>
          {access.stream.description ? (
            <Text style={[styles.streamDesc, { color: colors.textMuted }]} numberOfLines={2}>{access.stream.description}</Text>
          ) : null}
          {!isLive && presentation ? (
            <View style={[styles.lifecycleRow, { backgroundColor: colors.bgSecondary }]}>
              <Icon name={presentation.icon} size={14} color={colors.interactive} />
              <Text style={[styles.lifecycleText, { color: colors.textSecondary }]}>{presentation.message}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionPillsRow}>
          {access.givingEnabled ? (
            <Pressable
              onPress={() => router.push('/(tabs)/profile/giving' as any)}
              style={[styles.actionPill, { backgroundColor: colors.primarySoft }]}
            >
              <Icon name="gift-outline" size={14} color={colors.interactive} />
              <Text style={[styles.actionPillText, { color: colors.interactive }]}>Give</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => mode === 'visitor' ? router.push({ pathname: '/(auth)/login', params: { returnTo } } as any) : setShowSupportSheet(true)}
            style={[styles.actionPill, { backgroundColor: colors.bgSecondary }]}
          >
            <Icon name="heart-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.actionPillText, { color: colors.textSecondary }]}>Care</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chatSection}>
        <View style={styles.chatHeading}>
          <Text style={[styles.chatHeadingText, { color: colors.text }]}>Live fellowship</Text>
          {chatLoading ? <Text style={[styles.chatStatus, { color: colors.textMuted }]}>Loading…</Text> : null}
        </View>

        {interactionError ? (
          <View style={[styles.interactionErrorCard, { backgroundColor: colors.liveSoft }]}>
            <Icon name="alert-circle-outline" size={15} color={colors.live} />
            <Text style={[styles.interactionError, { color: colors.live }]} accessibilityRole="alert">{interactionError}</Text>
          </View>
        ) : null}

        <FlatList
          data={chatLog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.chatBubble}>
              <Avatar url={item.avatarUrl} name={item.user} size="xs" />
              <View style={styles.chatCopy}>
                <View style={styles.chatMetaRow}>
                  <Text style={[styles.chatUser, { color: colors.text }]}>{item.user}</Text>
                  <Text style={[styles.chatTime, { color: colors.textMuted }]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={[styles.chatText, { color: colors.textSecondary }]}>{item.text}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.chatEmpty}>
              <Icon name="chatbubbles-outline" size={24} color={colors.textMuted} />
              <Text style={[styles.chatEmptyText, { color: colors.textMuted }]}>
                {mode === 'visitor'
                  ? isLive
                    ? 'Sign in to see and participate in live fellowship chat.'
                    : 'Sign in when you want to join live fellowship during a broadcast.'
                  : !showFellowshipHistory
                    ? 'Live fellowship opens when this broadcast begins.'
                    : isLive
                      ? 'No chat messages yet.'
                      : 'No fellowship messages were saved for this broadcast.'}
              </Text>
            </View>
          )}
        />

        {access.canChat ? (
          <View style={[styles.chatInputBar, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, marginBottom: Math.max(insets.bottom, spacing.sm) }, shadows.floating]}>
            <TextInput
              value={chatMessage}
              onChangeText={setChatMessage}
              placeholder="Message live fellowship…"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.chatInput,
                { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.borderSubtle },
              ]}
            />
            <Pressable
              onPress={() => void handleSendChat()}
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
          </View>
        ) : mode === 'visitor' ? (
          <Pressable
            onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo } } as any)}
            accessibilityRole="button"
            style={[styles.signInChat, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, marginBottom: Math.max(insets.bottom, spacing.sm) }, shadows.floating]}
          >
            <Icon name="log-in-outline" size={17} color={colors.interactive} />
            <Text style={[styles.signInChatText, { color: colors.interactive }]}>Sign in for live fellowship</Text>
          </Pressable>
        ) : (
          <View style={[styles.memberChatNotice, { backgroundColor: colors.card, borderColor: colors.borderSubtle, marginBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <Icon name="people-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.memberChatNoticeText, { color: colors.textSecondary }]}>
              Chat posting is available to active members during a live broadcast.
            </Text>
          </View>
        )}
      </View>

      <BottomSheet
        visible={showSupportSheet}
        onClose={closeSupport}
        title={supportSent ? 'Follow-up requested' : 'Pastoral follow-up'}
        subtitle={supportSent ? 'Your request is now in the appropriate ministry queue.' : 'Choose the kind of support or next step you need.'}
        maxHeightPercent={88}
      >
        {supportSent ? (
          <View style={styles.sentWrap}>
            <View style={[styles.sentIcon, { backgroundColor: colors.successSoft }]}>
              <Icon name="checkmark-circle" size={34} color={colors.success} />
            </View>
            <Text style={[styles.sentTitle, { color: colors.text }]}>Your request was received</Text>
            <Text style={[styles.sentSub, { color: colors.textSecondary }]}>
              The ministry team will see the request with your COT profile and the broadcast it came from.
            </Text>
            <Button label="Done" onPress={closeSupport} size="lg" fullWidth />
          </View>
        ) : (
          <View style={styles.supportForm}>
            {followUpOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setSupportType(option.value)}
                style={[
                  styles.supportOption,
                  {
                    backgroundColor: supportType === option.value ? colors.primarySoft : colors.card,
                    borderColor: supportType === option.value ? colors.interactive : colors.borderSubtle,
                  },
                ]}
              >
                <Icon
                  name={supportType === option.value ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={supportType === option.value ? colors.interactive : colors.textMuted}
                />
                <View style={styles.chatCopy}>
                  <Text style={[styles.supportOptionTitle, { color: colors.text }]}>{option.label}</Text>
                  <Text style={[styles.supportOptionText, { color: colors.textSecondary }]}>{option.description}</Text>
                </View>
              </Pressable>
            ))}
            <Button label="Request follow-up" onPress={() => void submitSupport()} loading={supportSubmitting} size="lg" fullWidth />
          </View>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

export default function GeneralLivePlayerExperience({ streamId }: { streamId: string }) {
  return <LivePlayerExperience streamId={streamId} scope="general" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingBody: { padding: spacing.lg, gap: spacing.md },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoView: { width: '100%', height: '100%' },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
  },
  placeholderIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(22,143,240,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22,143,240,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  placeholderText: { color: '#CBD5E1', fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center', maxWidth: 360 },
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
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  infoCol: { flex: 1, gap: 2 },
  streamTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.25 },
  streamDesc: { fontSize: 11, lineHeight: 16 },
  lifecycleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: spacing.xs, padding: spacing.sm, borderRadius: radius.md },
  lifecycleText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  actionPillsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  actionPillText: { fontSize: 12, fontWeight: '700' },
  chatSection: { flex: 1, paddingTop: spacing.sm },
  chatHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chatHeadingText: { fontSize: 14, fontWeight: '800' },
  chatStatus: { fontSize: 11 },
  interactionErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.lg,
  },
  interactionError: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  chatList: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  chatBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 7,
  },
  chatCopy: { flex: 1, minWidth: 0 },
  chatMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chatUser: { fontSize: 12, fontWeight: '800' },
  chatTime: { fontSize: 10 },
  chatText: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  chatEmpty: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  chatEmptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xxl,
    gap: spacing.sm,
  },
  chatInput: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxHeight: 96,
    fontSize: 13,
  },
  sendChatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInChat: {
    minHeight: 52,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  signInChatText: { fontSize: 13, fontWeight: '700' },
  memberChatNotice: {
    minHeight: 52,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  memberChatNoticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.md },
  backText: { fontSize: 14, fontWeight: '600' },
  errorPad: { padding: spacing.lg },
  sentWrap: { paddingVertical: spacing.md, alignItems: 'center', gap: spacing.md },
  sentIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontSize: 18, fontWeight: '800' },
  sentSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  supportForm: { gap: spacing.sm },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  supportOptionTitle: { fontSize: 13, fontWeight: '800' },
  supportOptionText: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});

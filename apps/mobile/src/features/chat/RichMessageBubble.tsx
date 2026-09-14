import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AudioPlayer, Avatar, Icon, VideoPlayer } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import type { ChatAttachment, RichChatMessage } from './rich-chat-types';

const QUICK_REACTIONS = ['❤️', '🙏', '😂', '👍', '🔥'];

function attachmentLabel(type?: ChatAttachment['type'] | null) {
  if (type === 'audio') return 'Voice or audio message';
  if (type === 'video') return 'Video';
  if (type === 'gif') return 'GIF';
  if (type === 'image') return 'Photo';
  return 'Message';
}

function MessageAttachment({ attachment }: { attachment: ChatAttachment }) {
  const { colors } = useTheme();
  if (!attachment.url) {
    return (
      <View style={[styles.missingMedia, { backgroundColor: colors.bgSecondary }]}>
        <Icon name="cloud-offline-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.missingMediaText, { color: colors.textMuted }]}>Media unavailable</Text>
      </View>
    );
  }
  if (attachment.type === 'image' || attachment.type === 'gif') {
    return (
      <Image
        source={{ uri: attachment.url }}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel={attachment.type === 'gif' ? 'GIF attachment' : 'Photo attachment'}
      />
    );
  }
  if (attachment.type === 'video') {
    return (
      <VideoPlayer
        title={attachment.fileName || 'Chat video'}
        sourceUrl={attachment.url}
        durationSeconds={attachment.durationSeconds}
        style={styles.player}
      />
    );
  }
  return (
    <AudioPlayer
      title={attachment.fileName || 'Voice note'}
      sourceUrl={attachment.url}
      durationSeconds={attachment.durationSeconds}
      style={styles.player}
    />
  );
}

export function RichMessageBubble({
  message,
  mine,
  showSender = false,
  canPin = true,
  onReply,
  onReact,
  onPin,
  onJumpToMessage,
}: {
  message: RichChatMessage;
  mine: boolean;
  showSender?: boolean;
  canPin?: boolean;
  onReply: (message: RichChatMessage) => void;
  onReact: (message: RichChatMessage, emoji: string) => void;
  onPin: (message: RichChatMessage, pinned: boolean) => void;
  onJumpToMessage: (messageId: string) => void;
}) {
  const { colors } = useTheme();
  const [actionsOpen, setActionsOpen] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const senderName = message.sender?.display_name || message.sender?.username || 'Member';
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      gesture.dx > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4
    ),
    onPanResponderMove: (_, gesture) => {
      translateX.setValue(Math.min(72, Math.max(0, gesture.dx)));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx >= 54) onReply(message);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [message, onReply, translateX]);

  return (
    <View style={[styles.outer, mine && styles.outerMine]}>
      <View style={[styles.swipeReply, mine ? styles.swipeReplyMine : styles.swipeReplyTheirs]}>
        <Icon name="arrow-undo" size={17} color={colors.interactive} />
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.row, mine && styles.rowMine, { transform: [{ translateX }] }]}
      >
        {!mine && showSender ? (
          <Avatar url={message.sender?.avatar_url ?? undefined} name={senderName} size="xs" />
        ) : null}
        <View style={styles.messageColumn}>
          <Pressable
            onLongPress={() => setActionsOpen((value) => !value)}
            delayLongPress={260}
            style={[
              styles.bubble,
              mine ? styles.mine : styles.theirs,
              {
                backgroundColor: mine ? colors.interactive : colors.card,
                borderColor: message.pinned_at ? colors.interactive : colors.borderSubtle,
              },
            ]}
            accessibilityHint="Long press for reply, reaction, and pin actions"
          >
            <View style={styles.bubbleMeta}>
              {!mine && showSender ? (
                <Text style={[styles.senderName, { color: colors.interactive }]} numberOfLines={1}>
                  {message.sender?.username ? `@${message.sender.username}` : senderName}
                </Text>
              ) : <View style={styles.flex} />}
              {message.pinned_at ? <Icon name="pin" size={13} color={mine ? '#FFFFFF' : colors.interactive} /> : null}
              {message.optimistic ? <Icon name="time-outline" size={13} color={mine ? '#DDEEFF' : colors.textMuted} /> : null}
            </View>

            {message.replyTo ? (
              <Pressable
                onPress={() => onJumpToMessage(message.replyTo!.id)}
                style={[
                  styles.replyPreview,
                  { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : colors.bgSecondary },
                ]}
              >
                <Text style={[styles.replySender, { color: mine ? '#FFFFFF' : colors.interactive }]} numberOfLines={1}>
                  {message.replyTo.sender?.display_name || message.replyTo.sender?.username || 'Original message'}
                </Text>
                <Text style={[styles.replyBody, { color: mine ? '#EAF4FF' : colors.textSecondary }]} numberOfLines={2}>
                  {message.replyTo.body || attachmentLabel(message.replyTo.attachmentType)}
                </Text>
              </Pressable>
            ) : null}

            {(message.attachments ?? []).length ? (
              <View style={styles.attachments}>
                {(message.attachments ?? []).map((attachment) => (
                  <MessageAttachment key={attachment.uploadId} attachment={attachment} />
                ))}
              </View>
            ) : null}

            {message.body ? (
              <Text style={[styles.messageText, { color: mine ? '#FFFFFF' : colors.text }]}>
                {message.body}
              </Text>
            ) : null}
            <Text style={[styles.time, { color: mine ? '#DDEEFF' : colors.textMuted }]}>
              {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>

          {(message.reactions ?? []).length ? (
            <View style={[styles.reactions, mine && styles.reactionsMine]}>
              {(message.reactions ?? []).map((reaction) => (
                <Pressable
                  key={reaction.emoji}
                  onPress={() => onReact(message, reaction.emoji)}
                  style={[
                    styles.reactionChip,
                    {
                      backgroundColor: reaction.reactedByMe ? colors.primarySoft : colors.card,
                      borderColor: reaction.reactedByMe ? colors.interactive : colors.borderSubtle,
                    },
                  ]}
                >
                  <Text style={styles.reactionText}>{reaction.emoji} {reaction.count}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {actionsOpen ? (
            <View style={[styles.actions, mine && styles.actionsMine, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Pressable onPress={() => { onReply(message); setActionsOpen(false); }} style={styles.actionButton}>
                <Icon name="arrow-undo-outline" size={17} color={colors.textSecondary} />
                <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Reply</Text>
              </Pressable>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable key={emoji} onPress={() => { onReact(message, emoji); setActionsOpen(false); }} style={styles.emojiButton}>
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              ))}
              {canPin ? (
                <Pressable onPress={() => { onPin(message, !message.pinned_at); setActionsOpen(false); }} style={styles.actionButton}>
                  <Icon name={message.pinned_at ? 'pin-outline' : 'pin'} size={17} color={colors.textSecondary} />
                  <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{message.pinned_at ? 'Unpin' : 'Pin'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  outerMine: { alignItems: 'flex-end' },
  swipeReply: { position: 'absolute', top: 18, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  swipeReplyMine: { left: 4 },
  swipeReplyTheirs: { left: 36 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, maxWidth: '92%' },
  rowMine: { justifyContent: 'flex-end' },
  messageColumn: { flexShrink: 1, gap: 4 },
  bubble: { minWidth: 76, maxWidth: '100%', borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, overflow: 'hidden' },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  flex: { flex: 1 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 13 },
  senderName: { flex: 1, fontSize: 10, fontWeight: '800', marginBottom: 2 },
  messageText: { fontSize: 15, lineHeight: 20, marginTop: 3 },
  time: { fontSize: 9, lineHeight: 12, alignSelf: 'flex-end', marginTop: 3 },
  replyPreview: { borderLeftWidth: 3, borderLeftColor: '#38A8FF', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  replySender: { fontSize: 10, fontWeight: '800' },
  replyBody: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  attachments: { gap: 6, marginBottom: 4 },
  image: { width: 238, maxWidth: '100%', height: 190, borderRadius: radius.md, backgroundColor: '#0B1220' },
  player: { width: 270, maxWidth: '100%', marginVertical: 0 },
  missingMedia: { minWidth: 180, minHeight: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  missingMediaText: { fontSize: 11, fontWeight: '700' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -2, marginLeft: 8 },
  reactionsMine: { justifyContent: 'flex-end', marginLeft: 0, marginRight: 8 },
  reactionChip: { minHeight: 25, borderRadius: 13, borderWidth: 1, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  reactionText: { fontSize: 12, color: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, borderWidth: 1, borderRadius: radius.lg, padding: 5, alignSelf: 'flex-start' },
  actionsMine: { alignSelf: 'flex-end' },
  actionButton: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  actionLabel: { fontSize: 10, fontWeight: '800' },
  emojiButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 17 },
});

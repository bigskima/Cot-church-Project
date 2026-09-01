import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';
import type { ContentComment } from '@/types/content';

export interface CommentSheetProps {
  visible: boolean;
  onClose: () => void;
  comments: ContentComment[];
  onSubmitComment: (body: string, parentCommentId?: string | null) => Promise<void>;
  loading?: boolean;
}

export function CommentSheet({
  visible,
  onClose,
  comments,
  onSubmitComment,
  loading = false,
}: CommentSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ContentComment | null>(null);

  const handleSend = async () => {
    if (!text.trim() || loading) return;
    const bodyToSend = text.trim();
    setText('');
    const parentId = replyingTo?.id;
    setReplyingTo(null);
    await onSubmitComment(bodyToSend, parentId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
            shadows.lg,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Comments ({comments.length})
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isReply = !!item.parent_comment_id;
              const timeStr = new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View
                  style={[
                    styles.commentItem,
                    isReply && styles.replyItem,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                >
                  <Avatar
                    url={item.profiles?.avatar_url}
                    name={item.profiles?.display_name}
                    size="sm"
                  />
                  <View style={styles.commentContent}>
                    <View style={styles.authorRow}>
                      <Text style={[styles.authorName, { color: colors.text }]}>
                        {item.profiles?.display_name ?? 'Church Member'}
                      </Text>
                      <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                        {timeStr}
                      </Text>
                    </View>
                    <Text style={[styles.commentBody, { color: colors.text }]}>
                      {item.body}
                    </Text>
                    <Pressable
                      onPress={() => setReplyingTo(item)}
                      hitSlop={4}
                      style={styles.replyTrigger}
                    >
                      <Text style={[styles.replyTriggerText, { color: colors.interactive }]}>
                        Reply
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No comments yet. Share your thoughts or encouragement below.
                </Text>
              </View>
            )}
          />

          {/* Replying Banner */}
          {replyingTo ? (
            <View style={[styles.replyBanner, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.replyBannerText, { color: colors.interactive }]}>
                Replying to {replyingTo.profiles?.display_name ?? 'Member'}
              </Text>
              <Pressable onPress={() => setReplyingTo(null)} hitSlop={6}>
                <Icon name="close" size={16} color={colors.interactive} />
              </Pressable>
            </View>
          ) : null}

          {/* Composer Input Bar */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyingTo ? 'Write a reply...' : 'Add a thoughtful comment...'}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || loading}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: text.trim() ? colors.interactive : colors.bgSecondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
            >
              <Icon
                name="arrow-up"
                size={18}
                color={text.trim() ? '#FFFFFF' : colors.textMuted}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 20, 38, 0.65)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    height: '75%',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...typography.h3,
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  commentItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  replyItem: {
    paddingLeft: spacing.xl,
  },
  commentContent: {
    flex: 1,
    gap: 3,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 11,
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyTrigger: {
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  replyTriggerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  replyBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 80,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

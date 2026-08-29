import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { ContentComment } from '@/types/content';

interface CommentSheetProps {
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
      <View style={styles.backdrop as any}>
        <Pressable style={styles.dismissArea as any} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: isDark ? '#1C1008' : '#FFFDF9', borderColor: isDark ? '#3D2415' : palette.line },
            shadows.lg,
          ] as any}
        >
          {/* Sheet Header */}
          <View style={styles.header as any}>
            <View style={styles.dragHandle as any} />
            <View style={styles.headerRow as any}>
              <Text style={[styles.headerTitle, { color: colors.text }] as any}>
                💬 Fellowship & Comments ({comments.length})
              </Text>
              <Pressable onPress={onClose} style={styles.closeBtn as any}>
                <Text style={[styles.closeText, { color: colors.textMuted }] as any}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent as any}
            renderItem={({ item }) => {
              const isReply = !!item.parent_comment_id;
              return (
                <View
                  style={[
                    styles.commentItem,
                    isReply ? styles.replyItem : null,
                    { borderBottomColor: isDark ? '#2E1C11' : '#F4EAE0' },
                  ] as any}
                >
                  <View style={styles.commentAvatar as any}>
                    <Text style={{ fontSize: 13 } as any}>👤</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.authorRow as any}>
                      <Text style={[styles.authorName, { color: colors.text }] as any}>
                        {item.profiles?.display_name ?? 'Church Member'}
                      </Text>
                      <Text style={[styles.commentTime, { color: colors.textMuted }] as any}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={[styles.commentBody, { color: colors.text }] as any}>
                      {item.body}
                    </Text>
                    <Pressable onPress={() => setReplyingTo(item)} style={styles.replyTrigger as any}>
                      <Text style={styles.replyTriggerText as any}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyState as any}>
                <Text style={{ fontSize: 32 } as any}>🕊️</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }] as any}>
                  Be the first to share an encouragement or prayer.
                </Text>
              </View>
            )}
          />

          {/* Replying Banner if set */}
          {replyingTo ? (
            <View style={styles.replyBanner as any}>
              <Text style={styles.replyBannerText as any}>
                Replying to {replyingTo.profiles?.display_name ?? 'Member'}
              </Text>
              <Pressable onPress={() => setReplyingTo(null)}>
                <Text style={styles.cancelReplyText as any}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Input Bar */}
          <View
            style={[
              styles.inputBar,
              { backgroundColor: isDark ? '#140C07' : '#F8EDE2', borderTopColor: isDark ? '#2E1C11' : palette.line },
            ] as any}
          >
            <TextInput
              style={[
                styles.inputField,
                { backgroundColor: isDark ? '#22140C' : '#FFFDF9', color: colors.text, borderColor: isDark ? '#3D2415' : palette.line },
              ] as any}
              placeholder="Write an encouragement..."
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || loading}
              style={[
                styles.sendBtn,
                !text.trim() ? styles.sendBtnDisabled : null,
              ] as any}
            >
              <Text style={styles.sendBtnText as any}>➔</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    height: '65%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.md,
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A68A75',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  listContent: {
    padding: spacing.md,
    gap: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  replyItem: {
    marginLeft: 32,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '800',
  },
  commentTime: {
    fontSize: 10,
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyTrigger: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  replyTriggerText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  replyBannerText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  cancelReplyText: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '800',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: 10,
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    fontSize: 13,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#140C07',
    fontSize: 16,
    fontWeight: '900',
  },
});

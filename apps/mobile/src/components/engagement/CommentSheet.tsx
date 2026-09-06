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

const MAX_COMMENT_LENGTH = 3000;

export function CommentSheet({ visible, onClose, comments, onSubmitComment, loading = false }: CommentSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ContentComment | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);

  const identityFor = (item: ContentComment) => {
    const row = item as any;
    const author = row.author ?? {};
    return {
      displayName: author.displayName || author.display_name || item.profiles?.display_name || 'Church Member',
      username: author.username || author.handle || undefined,
      avatarUrl: author.avatarUrl || author.avatar_url || item.profiles?.avatar_url,
      badges: Array.isArray(author.badges) ? author.badges : [],
    };
  };

  const canSend = Boolean(text.trim()) && !loading;
  const remainingCharacters = MAX_COMMENT_LENGTH - text.length;
  const replyIdentity = replyingTo ? identityFor(replyingTo) : null;

  const handleSend = async () => {
    if (!canSend) return;
    const bodyToSend = text.trim();
    const parentId = replyingTo?.id;
    setSubmitError('');
    try {
      await onSubmitComment(bodyToSend, parentId);
      setText('');
      setReplyingTo(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to post this comment.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
            shadows.lg,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <View style={styles.titleRow}>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>Conversation</Text>
                  <View style={[styles.countPill, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.countText, { color: colors.interactive }]}>{comments.length}</Text>
                  </View>
                </View>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  Share encouragement, context, or a thoughtful reply.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close comments"
              >
                <Icon name="close" size={19} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, comments.length === 0 && styles.emptyListContent]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isReply = Boolean(item.parent_comment_id);
              const identity = identityFor(item);
              const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <View
                  style={[
                    styles.commentItem,
                    isReply && styles.replyItem,
                    {
                      backgroundColor: isReply ? colors.bgSecondary : colors.cardElevated,
                      borderColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <Avatar url={identity.avatarUrl} name={identity.displayName} size="sm" />
                  <View style={styles.commentContent}>
                    <View style={styles.authorRow}>
                      <View style={styles.authorIdentity}>
                        <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                          {identity.displayName}
                        </Text>
                        {identity.username ? (
                          <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>
                            @{identity.username}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.commentTime, { color: colors.textMuted }]}>{timeStr}</Text>
                    </View>

                    {identity.badges.length ? (
                      <View style={styles.badgeRow}>
                        {identity.badges.map((badge: any, index: number) => (
                          <View
                            key={badge.id || badge.code || `${badge.label}-${index}`}
                            style={[styles.badge, { backgroundColor: badge.backgroundColor }]}
                          >
                            <Text style={[styles.badgeText, { color: badge.textColor }]}>{badge.label}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <Text style={[styles.commentBody, { color: colors.text }]}>{item.body}</Text>

                    <Pressable
                      onPress={() => {
                        setReplyingTo(item);
                        setSubmitError('');
                      }}
                      hitSlop={5}
                      style={({ pressed }) => [
                        styles.replyTrigger,
                        { backgroundColor: colors.primarySoft },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Reply to ${identity.displayName}`}
                    >
                      <Text style={[styles.replyTriggerText, { color: colors.interactive }]}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="chatbubble-ellipses-outline" size={27} color={colors.interactive} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {loading ? 'Opening the conversation…' : 'Start the conversation'}
                </Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {loading
                    ? 'Comments are loading.'
                    : 'Be the first to share encouragement or add helpful context.'}
                </Text>
              </View>
            )}
          />

          {replyIdentity ? (
            <View style={[styles.replyBanner, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
              <View style={styles.replyBannerCopy}>
                <Text style={[styles.replyKicker, { color: colors.interactive }]}>REPLYING TO</Text>
                <Text style={[styles.replyBannerText, { color: colors.text }]} numberOfLines={1}>
                  {replyIdentity.displayName}
                </Text>
              </View>
              <Pressable
                onPress={() => setReplyingTo(null)}
                hitSlop={6}
                style={({ pressed }) => [styles.replyClose, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Icon name="close" size={16} color={colors.interactive} />
              </Pressable>
            </View>
          ) : null}

          {submitError ? (
            <Pressable
              onPress={() => setSubmitError('')}
              style={({ pressed }) => [
                styles.submitError,
                { backgroundColor: colors.liveSoft, borderColor: colors.live },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss comment error"
            >
              <Icon name="alert-circle-outline" size={16} color={colors.live} />
              <Text style={[styles.submitErrorText, { color: colors.live }]}>{submitError}</Text>
              <Icon name="close" size={14} color={colors.live} />
            </Pressable>
          ) : null}

          <View style={[styles.inputBar, { backgroundColor: colors.glass, borderTopColor: colors.borderSubtle }]}>
            <View
              style={[
                styles.composer,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: composerFocused ? colors.interactive : colors.borderSubtle,
                },
                composerFocused && shadows.sm,
              ]}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                placeholder={replyingTo ? 'Write a reply…' : 'Add a thoughtful comment…'}
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.text }]}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                accessibilityLabel={replyingTo ? 'Write a reply' : 'Write a comment'}
              />
              <View style={styles.composerMeta}>
                <Text style={[styles.composerHint, { color: colors.textMuted }]}>
                  {replyingTo ? 'Reply' : 'Comment'}
                </Text>
                <Text style={[styles.characterCount, { color: remainingCharacters < 150 ? colors.interactive : colors.textMuted }]}>
                  {remainingCharacters}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => void handleSend()}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: canSend ? colors.interactive : colors.bgSecondary,
                  borderColor: canSend ? colors.interactive : colors.borderSubtle,
                  opacity: loading ? 0.72 : 1,
                },
                pressed && canSend && styles.sendPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={loading ? 'Posting comment' : 'Send comment'}
              accessibilityState={{ disabled: !canSend }}
            >
              <Icon name="arrow-up" size={20} color={canSend ? '#FFFFFF' : colors.textMuted} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.62)' },
  dismissArea: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    height: '82%',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md, borderBottomWidth: 1 },
  dragHandle: { width: 42, height: 4, borderRadius: radius.pill, alignSelf: 'center', marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...typography.h3, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  countPill: { minWidth: 28, height: 24, borderRadius: radius.pill, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '900' },
  closeBtn: { width: 38, height: 38, borderWidth: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
  commentItem: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.xl, marginBottom: spacing.sm },
  replyItem: { marginLeft: spacing.xl },
  commentContent: { flex: 1, minWidth: 0, gap: 5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  authorIdentity: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  authorName: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  username: { fontSize: 11, flexShrink: 1 },
  commentTime: { fontSize: 10, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  commentBody: { fontSize: 13, lineHeight: 19 },
  replyTrigger: { alignSelf: 'flex-start', minHeight: 28, borderRadius: radius.pill, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  replyTriggerText: { fontSize: 11, fontWeight: '800' },
  emptyWrap: { padding: spacing.xl, alignItems: 'center' },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  emptyText: { maxWidth: 290, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 8, borderWidth: 1, borderRadius: radius.lg },
  replyBannerCopy: { flex: 1, minWidth: 0 },
  replyKicker: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  replyBannerText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  replyClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  submitError: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 8, borderWidth: 1, borderRadius: radius.lg },
  submitErrorText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: spacing.sm, borderTopWidth: 1 },
  composer: { flex: 1, minHeight: 54, maxHeight: 132, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6 },
  textInput: { minHeight: 26, maxHeight: 86, padding: 0, fontSize: 14, lineHeight: 19 },
  composerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  composerHint: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  characterCount: { fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sendBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sendPressed: { opacity: 0.9, transform: [{ scale: 0.95 }] },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});

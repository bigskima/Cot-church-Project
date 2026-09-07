import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { ContentComment } from '@/types/content';
import { Avatar } from '../primitives/Avatar';
import { Icon } from '../primitives/Icon';

const MAX_COMMENT_LENGTH = 3000;

export interface CommentsThreadProps {
  comments: ContentComment[];
  loading?: boolean;
  canComment?: boolean;
  focusRequest?: number;
  onRequireSignIn?: () => void;
  onSubmitComment: (body: string, parentCommentId?: string | null) => Promise<void>;
}

function commentIdentity(item: ContentComment) {
  const row = item as any;
  const author = row.author ?? {};
  return {
    displayName: author.displayName || author.display_name || item.profiles?.display_name || 'Church Member',
    username: author.username || author.handle || undefined,
    avatarUrl: author.avatarUrl || author.avatar_url || item.profiles?.avatar_url,
    badges: Array.isArray(author.badges) ? author.badges : [],
  };
}

function commentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function CommentsThread({
  comments,
  loading = false,
  canComment = true,
  focusRequest = 0,
  onRequireSignIn,
  onSubmitComment,
}: CommentsThreadProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ContentComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);

  const roots = useMemo(() => comments.filter((item) => !item.parent_comment_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ContentComment[]>();
    for (const item of comments) {
      if (!item.parent_comment_id) continue;
      const current = map.get(item.parent_comment_id) ?? [];
      current.push(item);
      map.set(item.parent_comment_id, current);
    }
    return map;
  }, [comments]);

  useEffect(() => {
    if (!focusRequest || !canComment) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [focusRequest, canComment]);

  const replyIdentity = replyingTo ? commentIdentity(replyingTo) : null;
  const remaining = MAX_COMMENT_LENGTH - text.length;
  const canSend = canComment && Boolean(text.trim()) && !submitting;

  const startReply = (comment: ContentComment) => {
    if (!canComment) {
      onRequireSignIn?.();
      return;
    }
    setReplyingTo(comment);
    setSubmitError('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async () => {
    if (!canComment) {
      onRequireSignIn?.();
      return;
    }
    if (!canSend) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmitComment(text.trim(), replyingTo?.id ?? null);
      setText('');
      setReplyingTo(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to post this comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = (item: ContentComment, isReply = false) => {
    const identity = commentIdentity(item);
    return (
      <View
        key={item.id}
        style={[
          styles.comment,
          isReply && styles.reply,
          {
            backgroundColor: isReply ? colors.bgSecondary : colors.card,
            borderColor: colors.borderSubtle,
          },
        ]}
      >
        <Avatar url={identity.avatarUrl} name={identity.displayName} size="sm" />
        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <View style={styles.identityLine}>
              <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>{identity.displayName}</Text>
              {identity.username ? <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>@{identity.username}</Text> : null}
            </View>
            <Text style={[styles.time, { color: colors.textMuted }]}>{commentTime(item.created_at)}</Text>
          </View>

          {identity.badges.length ? (
            <View style={styles.badges}>
              {identity.badges.slice(0, 3).map((badge: any, index: number) => (
                <View key={badge.id || badge.code || `${badge.label}-${index}`} style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
                  <Text style={[styles.badgeText, { color: badge.textColor }]}>{badge.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[styles.bodyText, { color: colors.text }]}>{item.body}</Text>

          <Pressable
            onPress={() => startReply(item)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${identity.displayName}`}
            style={({ pressed }) => [styles.replyAction, pressed && styles.pressed]}
          >
            <Icon name="arrow-undo-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.replyActionText, { color: colors.textSecondary }]}>Reply</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={[styles.heading, { color: colors.text }]}>Comments</Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            {comments.length ? `${comments.length} ${comments.length === 1 ? 'response' : 'responses'}` : 'Join the conversation'}
          </Text>
        </View>
        <View style={[styles.count, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.countText, { color: colors.interactive }]}>{comments.length}</Text>
        </View>
      </View>

      {loading && !comments.length ? (
        <View style={[styles.stateCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="chatbubble-ellipses-outline" size={22} color={colors.interactive} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Loading comments…</Text>
        </View>
      ) : !comments.length ? (
        <View style={[styles.stateCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="chatbubble-ellipses-outline" size={22} color={colors.interactive} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>No comments yet</Text>
          <Text style={[styles.stateCopy, { color: colors.textMuted }]}>Be the first to add something meaningful.</Text>
        </View>
      ) : (
        <View style={styles.thread}>
          {roots.map((root) => (
            <View key={root.id} style={styles.threadGroup}>
              {renderComment(root)}
              {(repliesByParent.get(root.id) ?? []).map((reply) => renderComment(reply, true))}
            </View>
          ))}
          {comments.filter((item) => item.parent_comment_id && !comments.some((parent) => parent.id === item.parent_comment_id)).map((item) => renderComment(item, true))}
        </View>
      )}

      <View style={[styles.composerShell, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        {replyIdentity ? (
          <View style={[styles.replyingBanner, { backgroundColor: colors.primarySoft }]}>
            <View style={styles.replyingCopy}>
              <Text style={[styles.replyingKicker, { color: colors.interactive }]}>Replying to</Text>
              <Text style={[styles.replyingName, { color: colors.text }]} numberOfLines={1}>{replyIdentity.displayName}</Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Cancel reply">
              <Icon name="close-circle" size={19} color={colors.interactive} />
            </Pressable>
          </View>
        ) : null}

        {submitError ? (
          <Pressable onPress={() => setSubmitError('')} style={[styles.error, { backgroundColor: colors.liveSoft }]} accessibilityRole="button">
            <Icon name="alert-circle-outline" size={15} color={colors.live} />
            <Text style={[styles.errorText, { color: colors.live }]}>{submitError}</Text>
            <Icon name="close" size={13} color={colors.live} />
          </Pressable>
        ) : null}

        {canComment ? (
          <View style={styles.composerRow}>
            <View style={[
              styles.inputShell,
              {
                backgroundColor: colors.inputBg,
                borderColor: composerFocused ? colors.interactive : colors.borderSubtle,
              },
            ]}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                placeholder={replyingTo ? 'Write a reply…' : 'Add a comment…'}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel={replyingTo ? 'Write a reply' : 'Write a comment'}
              />
              {composerFocused || text.length > 0 ? (
                <Text style={[styles.remaining, { color: remaining < 150 ? colors.interactive : colors.textMuted }]}>{remaining}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={submitting ? 'Posting comment' : 'Send comment'}
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [
                styles.send,
                {
                  backgroundColor: canSend ? colors.interactive : colors.bgSecondary,
                  borderColor: canSend ? colors.interactive : colors.borderSubtle,
                },
                pressed && canSend && styles.sendPressed,
              ]}
            >
              <Icon name={submitting ? 'hourglass-outline' : 'arrow-up'} size={19} color={canSend ? '#FFFFFF' : colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onRequireSignIn}
            accessibilityRole="button"
            style={({ pressed }) => [styles.signInRow, { backgroundColor: colors.bgSecondary }, pressed && styles.pressed]}
          >
            <Icon name="person-circle-outline" size={19} color={colors.interactive} />
            <Text style={[styles.signInText, { color: colors.text }]}>Sign in to comment</Text>
            <Icon name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 19, lineHeight: 24, fontWeight: '800', letterSpacing: -0.35 },
  subheading: { fontSize: 11, lineHeight: 16, marginTop: 1 },
  count: { minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800' },
  stateCard: { minHeight: 118, borderWidth: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.xs },
  stateTitle: { fontSize: 14, fontWeight: '800' },
  stateCopy: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  thread: { gap: spacing.md },
  threadGroup: { gap: spacing.sm },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  reply: { marginLeft: 34, borderRadius: radius.lg },
  commentBody: { flex: 1, minWidth: 0 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  identityLine: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorName: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  username: { fontSize: 11, flexShrink: 1 },
  time: { fontSize: 10, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  bodyText: { fontSize: 13, lineHeight: 19, marginTop: 7 },
  replyAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, minHeight: 28, paddingHorizontal: 2 },
  replyActionText: { fontSize: 11, fontWeight: '700' },
  composerShell: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, gap: spacing.sm },
  replyingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.lg },
  replyingCopy: { flex: 1, minWidth: 0 },
  replyingKicker: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  replyingName: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  inputShell: { flex: 1, minHeight: 46, maxHeight: 132, borderWidth: 1, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 8 },
  input: { minHeight: 26, maxHeight: 92, fontSize: 13, lineHeight: 18, padding: 0 },
  remaining: { alignSelf: 'flex-end', fontSize: 9, fontWeight: '700', marginTop: 3 },
  send: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sendPressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
  signInRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  signInText: { flex: 1, fontSize: 12, fontWeight: '700' },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.md },
  errorText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});

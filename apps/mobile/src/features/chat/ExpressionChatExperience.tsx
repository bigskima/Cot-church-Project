import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BottomSheet, Button, Chip, Icon, InputField, ResourceError } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { PLATFORM_KEYBOARD_BEHAVIOR, PLATFORM_KEYBOARD_DISMISS_MODE } from '@/utils/keyboard';
import { RichChatComposer } from './RichChatComposer';
import { RichMessageBubble } from './RichMessageBubble';
import type { ChatReaction, ChatReply, ChatSendPayload, RichChatMessage } from './rich-chat-types';
import { ChatCallActions } from '@/features/calls/ChatCallActions';
import { CallHistoryBubble } from '@/features/calls/CallHistoryBubble';
import type { CallHistoryPayload } from '@/features/calls/call-types';

type ExpressionChatMember = {
  id: string;
  profile_id: string;
  status: string;
  chat_restricted_until?: string | null;
  chat_banned_at?: string | null;
  chat_moderation_reason?: string | null;
  profile?: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
};

type ExpressionChatPayload = {
  expression: { id: string; name: string };
  membership: { chat_restricted_until?: string | null; chat_banned_at?: string | null; chat_moderation_reason?: string | null };
  permissions: { moderateMembers: boolean; pinMessages: boolean };
  members: ExpressionChatMember[];
  messages: RichChatMessage[];
};

type ExpressionTimelineItem =
  | { kind: 'message'; id: string; at: string; message: RichChatMessage }
  | { kind: 'call'; id: string; at: string; entry: CallHistoryPayload['history'][number] };

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function ExpressionChatExperience({ expressionId }: { expressionId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const [messages, setMessages] = useState<RichChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatReply | null>(null);
  const [actionError, setActionError] = useState('');
  const [moderationOpen, setModerationOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ExpressionChatMember | null>(null);
  const [reason, setReason] = useState('');
  const [moderating, setModerating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const listRef = useRef<FlatList<ExpressionTimelineItem>>(null);
  const key = `expression-chat:${expressionId}`;

  const resource = useResource<ExpressionChatPayload>(key, (signal) => {
    if (mode !== 'authenticated' || !expressionId) return Promise.reject(new Error('Join this Expression to use its discussion.'));
    return api.request<ExpressionChatPayload>(`expression-chat?branchId=${encodeURIComponent(expressionId)}`, { signal, context: 'current' });
  });

  const callHistory = useResource<CallHistoryPayload>(
    `chat-call:history:expression:${expressionId}`,
    (signal) => {
      if (mode !== 'authenticated' || !expressionId) return Promise.resolve({ history: [] });
      return api.request<CallHistoryPayload>(
        `noop?service=calls&history=true&scope=expression&expressionId=${encodeURIComponent(expressionId)}`,
        { signal, context: 'current' },
      );
    },
  );

  useEffect(() => {
    if (resource.data?.messages) setMessages(resource.data.messages);
  }, [resource.data?.messages]);

  useEffect(() => {
    setSelectedMember(null);
    setReason('');
    setConfirmRemove(false);
  }, [moderationOpen]);

  const send = async (payload: ChatSendPayload) => {
    const optimisticId = `local-${Date.now()}`;
    const optimistic: RichChatMessage = {
      id: optimisticId,
      body: payload.body,
      sent_at: new Date().toISOString(),
      sender_profile_id: context?.profile?.id ?? 'me',
      sender: context?.profile ? { id: context.profile.id, username: context.profile.username, display_name: context.profile.display_name, avatar_url: context.profile.avatar_url } : null,
      reply_to_id: payload.replyToId,
      replyTo,
      attachments: payload.attachments,
      reactions: [],
      optimistic: true,
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const created = await api.request<RichChatMessage>('expression-chat', {
        method: 'POST',
        context: 'current',
        body: JSON.stringify({ action: 'send', branchId: expressionId, body: payload.body, replyToId: payload.replyToId, attachmentIds: payload.attachments.map((item) => item.uploadId) }),
      });
      setMessages((current) => current.map((item) => item.id === optimisticId ? created : item));
      invalidate(key);
    } catch (error) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      throw error;
    }
  };

  const react = async (message: RichChatMessage, emoji: string) => {
    const before = message.reactions ?? [];
    const existing = before.find((item) => item.emoji === emoji);
    const next: ChatReaction[] = existing?.reactedByMe
      ? before.map((item) => item.emoji === emoji ? { ...item, count: item.count - 1, reactedByMe: false } : item).filter((item) => item.count > 0)
      : existing
        ? before.map((item) => item.emoji === emoji ? { ...item, count: item.count + 1, reactedByMe: true } : item)
        : [...before, { emoji, count: 1, reactedByMe: true }];
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, reactions: next } : item));
    try {
      await api.request('expression-chat', { method: 'POST', context: 'current', body: JSON.stringify({ action: 'react', branchId: expressionId, messageId: message.id, emoji }) });
      invalidate(key);
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, reactions: before } : item));
      setActionError(error instanceof Error ? error.message : 'Unable to update reaction.');
    }
  };

  const pin = async (message: RichChatMessage, pinned: boolean) => {
    const before = { pinned_at: message.pinned_at, pinned_by_profile_id: message.pinned_by_profile_id };
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, pinned_at: pinned ? new Date().toISOString() : null, pinned_by_profile_id: pinned ? context?.profile?.id ?? null : null } : item));
    try {
      await api.request('expression-chat', { method: 'POST', context: 'current', body: JSON.stringify({ action: 'pin', branchId: expressionId, messageId: message.id, pinned }) });
      invalidate(key);
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...before } : item));
      setActionError(error instanceof Error ? error.message : 'Unable to update pin.');
    }
  };

  const moderate = async (action: 'restrict_member' | 'ban_member' | 'remove_member', extra: Record<string, unknown> = {}) => {
    if (!selectedMember || moderating) return;
    setModerating(true);
    setActionError('');
    try {
      await api.request('expression-chat', {
        method: 'POST',
        context: 'current',
        body: JSON.stringify({ action, branchId: expressionId, targetProfileId: selectedMember.profile_id, reason: reason.trim(), ...extra }),
      });
      setSelectedMember(null);
      setReason('');
      setConfirmRemove(false);
      await resource.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update this member.');
    } finally {
      setModerating(false);
    }
  };

  const restrictedUntil = resource.data?.membership.chat_restricted_until;
  const disabledReason = resource.data?.membership.chat_banned_at
    ? `Discussion access disabled${resource.data.membership.chat_moderation_reason ? ` · ${resource.data.membership.chat_moderation_reason}` : ''}`
    : restrictedUntil && new Date(restrictedUntil) > new Date()
      ? `Posting restricted until ${new Date(restrictedUntil).toLocaleString()}${resource.data?.membership.chat_moderation_reason ? ` · ${resource.data.membership.chat_moderation_reason}` : ''}`
      : null;
  const pinned = messages.filter((message) => message.pinned_at);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleMessages = useMemo(() => messages.filter((message) => {
    if (pinnedOnly && !message.pinned_at) return false;
    if (!normalizedSearch) return true;
    const author = `${message.sender?.display_name ?? ''} ${message.sender?.username ?? ''}`.toLowerCase();
    return (message.body ?? '').toLowerCase().includes(normalizedSearch) || author.includes(normalizedSearch);
  }), [messages, normalizedSearch, pinnedOnly]);
  const memberList = useMemo(() => (resource.data?.members ?? []).filter((member) => member.status === 'active'), [resource.data?.members]);
  const fullTimeline = useMemo<ExpressionTimelineItem[]>(() => {
    const messageItems = messages.map((message) => ({ kind: 'message' as const, id: `message:${message.id}`, at: message.sent_at, message }));
    const callItems = (callHistory.data?.history ?? []).map((entry) => ({ kind: 'call' as const, id: `call:${entry.call.id}`, at: entry.call.created_at, entry }));
    return [...messageItems, ...callItems].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  }, [callHistory.data?.history, messages]);
  const visibleTimeline = useMemo<ExpressionTimelineItem[]>(() => {
    if (!normalizedSearch && !pinnedOnly) return fullTimeline;
    return visibleMessages.map((message) => ({ kind: 'message' as const, id: `message:${message.id}`, at: message.sent_at, message }));
  }, [fullTimeline, normalizedSearch, pinnedOnly, visibleMessages]);

  const beginReply = (message: RichChatMessage) => setReplyTo({ id: message.id, body: message.body, sender_profile_id: message.sender_profile_id, sender: message.sender, attachmentType: message.attachments?.[0]?.type ?? null });
  const jumpToMessage = (id: string) => {
    setPinnedOnly(false);
    setSearchQuery('');
    const index = fullTimeline.findIndex((item) => item.kind === 'message' && item.message.id === id);
    if (index >= 0) requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }));
  };
  if (resource.loading && !resource.data) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.interactive} /></View>;
  if (resource.error && !resource.data) return <View style={[styles.screen, { backgroundColor: colors.bg }]}><View style={styles.state}><ResourceError message={resource.error} retry={resource.refresh} /></View></View>;

  const expressionName = resource.data?.expression.name ?? context?.expression?.name ?? 'Expression';
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={PLATFORM_KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={Platform.select({ ios: insets.top, android: 0, web: 0, default: 0 })}
    >
      <ExpressionPeopleHeader expressionId={expressionId} expressionName={expressionName} active="chat" title="General discussion" subtitle="One conversation for everyone in this Expression." icon="chatbubbles-outline" />
      <View style={styles.quickTools}>
        <Pressable onPress={() => setSearchOpen((current) => !current)} style={[styles.quickTool, { backgroundColor: searchOpen || !!normalizedSearch ? colors.primarySoft : colors.card, borderColor: searchOpen || !!normalizedSearch ? colors.interactive : colors.borderSubtle }]} accessibilityRole="button" accessibilityState={{ selected: searchOpen || !!normalizedSearch }}>
          <Icon name="search-outline" size={14} color={searchOpen || !!normalizedSearch ? colors.interactive : colors.textSecondary} />
          <Text style={[styles.quickToolText, { color: searchOpen || !!normalizedSearch ? colors.interactive : colors.textSecondary }]}>Search</Text>
        </Pressable>
        <Pressable onPress={() => setPinnedOnly((current) => !current)} style={[styles.quickTool, { backgroundColor: pinnedOnly ? colors.primarySoft : colors.card, borderColor: pinnedOnly ? colors.interactive : colors.borderSubtle }]} accessibilityRole="button" accessibilityState={{ selected: pinnedOnly }}>
          <Icon name="pin-outline" size={14} color={pinnedOnly ? colors.interactive : colors.textSecondary} />
          <Text style={[styles.quickToolText, { color: pinnedOnly ? colors.interactive : colors.textSecondary }]}>Pinned {pinned.length ? `(${pinned.length})` : ''}</Text>
        </Pressable>
        <ChatCallActions scope="expression" expressionId={expressionId} />
        {resource.data?.permissions.moderateMembers ? (
          <Pressable onPress={() => setModerationOpen(true)} style={[styles.quickTool, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]} accessibilityRole="button" accessibilityLabel="Moderate discussion">
            <Icon name="shield-checkmark-outline" size={14} color={colors.interactive} />
            <Text style={[styles.quickToolText, { color: colors.interactive }]}>Moderate</Text>
          </Pressable>
        ) : null}
      </View>

      {searchOpen ? (
        <View style={styles.searchWrap}>
          <InputField label="Search discussion" value={searchQuery} onChangeText={setSearchQuery} placeholder="Message or member name" autoCapitalize="none" />
        </View>
      ) : null}

      {pinned.length && !pinnedOnly && !normalizedSearch ? <Pressable onPress={() => jumpToMessage(pinned[0].id)} style={[styles.pinned, { backgroundColor: colors.primarySoft }]}><Icon name="pin" size={14} color={colors.interactive} /><Text style={[styles.pinnedText, { color: colors.textSecondary }]} numberOfLines={1}>{pinned[0].body || 'Pinned media message'}</Text></Pressable> : null}
      <FlatList
        ref={listRef}
        data={visibleTimeline}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE}
        onContentSizeChange={() => { if (!normalizedSearch && !pinnedOnly) listRef.current?.scrollToEnd({ animated: true }); }}
        onScrollToIndexFailed={({ index, averageItemLength }) => listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })}
        ListEmptyComponent={<View style={styles.empty}><Icon name={normalizedSearch || pinnedOnly ? 'search-outline' : 'chatbubbles-outline'} size={30} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{normalizedSearch || pinnedOnly ? 'No matching messages' : 'No messages yet'}</Text></View>}
        renderItem={({ item }) => item.kind === 'call'
          ? <CallHistoryBubble entry={item.entry} viewerId={context?.profile?.id ?? ''} />
          : <RichMessageBubble message={item.message} mine={item.message.sender_profile_id === context?.profile?.id} showSender canPin={resource.data?.permissions.pinMessages === true} onReply={beginReply} onReact={(target, emoji) => void react(target, emoji)} onPin={(target, value) => void pin(target, value)} onJumpToMessage={jumpToMessage} />}
      />
      {actionError ? <Text style={[styles.error, { color: colors.live }]} accessibilityRole="alert">{actionError}</Text> : null}
      <RichChatComposer endpoint="expression-chat" requestContext="current" scope={{ branchId: expressionId }} replyTo={replyTo} disabledReason={disabledReason} bottomInset={Math.max(insets.bottom, 10)} onCancelReply={() => setReplyTo(null)} onSend={send} />

      <BottomSheet visible={moderationOpen} onClose={() => setModerationOpen(false)} title="Expression discussion controls" subtitle="Manage posting access without confusing this with Group roles." maxHeightPercent={90}>
        {!selectedMember ? (
          <View style={styles.memberList}>
            <Text style={[styles.sheetHint, { color: colors.textMuted }]}>Choose a member. Your own account is intentionally excluded from self-moderation actions.</Text>
            {memberList.filter((member) => member.profile_id !== context?.profile?.id).map((member) => {
              const name = member.profile?.display_name || member.profile?.username || 'Expression member';
              const restricted = member.chat_restricted_until && new Date(member.chat_restricted_until) > new Date();
              return (
                <Pressable key={member.id} onPress={() => setSelectedMember(member)} style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  <Avatar url={member.profile?.avatar_url ?? undefined} name={name} size="sm" />
                  <View style={styles.flex}><Text style={[styles.memberName, { color: colors.text }]}>{name}</Text><Text style={[styles.memberMeta, { color: colors.textMuted }]}>{member.chat_banned_at ? 'Discussion banned' : restricted ? `Posting restricted until ${new Date(member.chat_restricted_until!).toLocaleString()}` : 'Can participate normally'}</Text></View>
                  <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.moderationForm}>
            <Pressable onPress={() => { setSelectedMember(null); setReason(''); setConfirmRemove(false); }} style={styles.backRow}><Icon name="arrow-back" size={16} color={colors.interactive} /><Text style={[styles.backText, { color: colors.interactive }]}>All members</Text></Pressable>
            <View style={[styles.selectedCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Avatar url={selectedMember.profile?.avatar_url ?? undefined} name={selectedMember.profile?.display_name || selectedMember.profile?.username || 'Member'} size="md" /><View style={styles.flex}><Text style={[styles.selectedName, { color: colors.text }]}>{selectedMember.profile?.display_name || selectedMember.profile?.username || 'Expression member'}</Text><Text style={[styles.memberMeta, { color: colors.textMuted }]}>{selectedMember.profile?.username ? `@${selectedMember.profile.username}` : 'Expression member'}</Text></View></View>
            <InputField label="Reason / note" value={reason} onChangeText={setReason} multiline numberOfLines={3} placeholder="Optional moderation note" />
            <Text style={[styles.actionTitle, { color: colors.textSecondary }]}>POSTING RESTRICTION</Text>
            <View style={styles.chips}><Chip label="1 hour" onPress={() => void moderate('restrict_member', { restrictedUntil: futureIso(1) })} /><Chip label="24 hours" onPress={() => void moderate('restrict_member', { restrictedUntil: futureIso(24) })} /><Chip label="7 days" onPress={() => void moderate('restrict_member', { restrictedUntil: futureIso(168) })} /><Chip label="Release" selected={!selectedMember.chat_restricted_until} onPress={() => void moderate('restrict_member', { restrictedUntil: null })} /></View>
            <View style={styles.moderationButtons}>
              <Button label={selectedMember.chat_banned_at ? 'Restore discussion access' : 'Ban from discussion'} variant="outline" loading={moderating} onPress={() => void moderate('ban_member', { banned: !selectedMember.chat_banned_at })} />
              <Button label={confirmRemove ? 'Confirm remove from Expression' : 'Remove from Expression'} variant="outline" loading={moderating} onPress={() => confirmRemove ? void moderate('remove_member') : setConfirmRemove(true)} />
            </View>
          </View>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, state: { flex: 1, padding: spacing.lg, justifyContent: 'center' }, flex: { flex: 1, minWidth: 0 },
  quickTools: { marginHorizontal: spacing.sm, marginVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickTool: { minHeight: 32, flex: 1, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickToolText: { fontSize: 9, lineHeight: 12, fontWeight: '900' }, searchWrap: { marginHorizontal: spacing.md, marginBottom: spacing.xs },
  pinned: { marginHorizontal: spacing.md, borderRadius: radius.md, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, pinnedText: { flex: 1, fontSize: 11, fontWeight: '700' },
  messages: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, flexGrow: 1, justifyContent: 'flex-end' }, empty: { paddingVertical: 54, paddingHorizontal: spacing.lg, alignItems: 'center', gap: 7 }, emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' }, emptyCopy: { fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 320 }, error: { paddingHorizontal: spacing.md, paddingVertical: 5, fontSize: 11 },
  memberList: { gap: spacing.sm }, sheetHint: { fontSize: 11, lineHeight: 16, marginBottom: spacing.xs }, memberRow: { minHeight: 64, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, memberName: { fontSize: 12.5, fontWeight: '900' }, memberMeta: { fontSize: 10, lineHeight: 14, marginTop: 2 }, moderationForm: { gap: spacing.md }, backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }, backText: { fontSize: 11, fontWeight: '900' }, selectedCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, selectedName: { fontSize: 14, fontWeight: '900' }, actionTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, moderationButtons: { gap: spacing.sm },
});

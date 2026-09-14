import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, ResourceError, ScreenHeader } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { RichChatComposer } from './RichChatComposer';
import { RichMessageBubble } from './RichMessageBubble';
import type { ChatReaction, ChatReply, ChatSendPayload, RichChatMessage } from './rich-chat-types';

type GroupChatPayload = {
  group: { id: string; name: string; branch_id?: string | null };
  membership: { chat_restricted_until?: string | null; moderation_reason?: string | null };
  permissions: { pinMessages: boolean };
  messages: RichChatMessage[];
};

export function GroupChatExperience({ groupId }: { groupId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const [messages, setMessages] = useState<RichChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatReply | null>(null);
  const [actionError, setActionError] = useState('');
  const listRef = useRef<FlatList<RichChatMessage>>(null);
  const key = `group-chat:${groupId}:main`;

  const resource = useResource<GroupChatPayload>(key, (signal) => {
    if (mode !== 'authenticated' || !groupId) return Promise.reject(new Error('Join this Group to use its chat.'));
    return api.request<GroupChatPayload>(`group-chat?groupId=${encodeURIComponent(groupId)}`, { signal, context: 'current' });
  });

  useEffect(() => {
    if (resource.data?.messages) setMessages(resource.data.messages);
  }, [resource.data?.messages]);

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
      const created = await api.request<RichChatMessage>('group-chat', {
        method: 'POST',
        context: 'current',
        body: JSON.stringify({ action: 'send', groupId, body: payload.body, replyToId: payload.replyToId, attachmentIds: payload.attachments.map((item) => item.uploadId) }),
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
      await api.request('group-chat', { method: 'POST', context: 'current', body: JSON.stringify({ action: 'react', groupId, messageId: message.id, emoji }) });
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
      await api.request('group-chat', { method: 'POST', context: 'current', body: JSON.stringify({ action: 'pin', groupId, messageId: message.id, pinned }) });
      invalidate(key);
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...before } : item));
      setActionError(error instanceof Error ? error.message : 'Unable to update pin.');
    }
  };

  const beginReply = (message: RichChatMessage) => setReplyTo({ id: message.id, body: message.body, sender_profile_id: message.sender_profile_id, sender: message.sender, attachmentType: message.attachments?.[0]?.type ?? null });
  const jumpToMessage = (id: string) => {
    const index = messages.findIndex((message) => message.id === id);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  };

  if (resource.loading && !resource.data) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.interactive} /></View>;
  if (resource.error && !resource.data) return <View style={[styles.screen, { backgroundColor: colors.bg }]}><View style={{ paddingTop: insets.top }}><ScreenHeader title='Group chat' showBack /></View><View style={styles.state}><ResourceError message={resource.error} retry={resource.refresh} /></View></View>;

  const restrictedUntil = resource.data?.membership.chat_restricted_until;
  const restriction = restrictedUntil && new Date(restrictedUntil) > new Date()
    ? `Chat restricted until ${new Date(restrictedUntil).toLocaleString()}${resource.data?.membership.moderation_reason ? ` · ${resource.data.membership.moderation_reason}` : ''}`
    : null;
  const pinned = messages.filter((message) => message.pinned_at);

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}><ScreenHeader title={resource.data?.group.name ?? 'Group chat'} kicker='GROUP CHAT' subtitle='Replies, media, voice notes, reactions and pins.' showBack /></View>
      <View style={[styles.scope, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
        <Icon name='people-circle-outline' size={17} color={colors.interactive} />
        <Text style={[styles.scopeText, { color: colors.textSecondary }]}>This conversation stays inside the Group.</Text>
        {context?.expression?.id ? <Pressable onPress={() => router.push(`/expressions/${context.expression!.id}/groups/${groupId}` as any)}><Text style={[styles.link, { color: colors.interactive }]}>Group home</Text></Pressable> : null}
      </View>
      {pinned.length ? <Pressable onPress={() => jumpToMessage(pinned[0].id)} style={[styles.pinned, { backgroundColor: colors.primarySoft }]}><Icon name='pin' size={14} color={colors.interactive} /><Text style={[styles.pinnedText, { color: colors.textSecondary }]} numberOfLines={1}>{pinned[0].body || 'Pinned media message'}</Text></Pressable> : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps='handled'
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onScrollToIndexFailed={({ index, averageItemLength }) => listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })}
        ListEmptyComponent={<View style={styles.empty}><Icon name='chatbubbles-outline' size={30} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text></View>}
        renderItem={({ item }) => <RichMessageBubble message={item} mine={item.sender_profile_id === context?.profile?.id} showSender canPin={resource.data?.permissions.pinMessages === true} onReply={beginReply} onReact={(target, emoji) => void react(target, emoji)} onPin={(target, value) => void pin(target, value)} onJumpToMessage={jumpToMessage} />}
      />
      {actionError ? <Text style={[styles.error, { color: colors.live }]}>{actionError}</Text> : null}
      <RichChatComposer endpoint='group-chat' requestContext='current' scope={{ groupId }} replyTo={replyTo} disabledReason={restriction} bottomInset={Math.max(insets.bottom, 10)} onCancelReply={() => setReplyTo(null)} onSend={send} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, state: { flex: 1, padding: spacing.lg },
  scope: { marginHorizontal: spacing.md, marginBottom: spacing.xs, padding: spacing.sm, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scopeText: { flex: 1, fontSize: 11, fontWeight: '600' }, link: { fontSize: 11, fontWeight: '800' },
  pinned: { marginHorizontal: spacing.md, borderRadius: radius.md, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, pinnedText: { flex: 1, fontSize: 11, fontWeight: '700' },
  messages: { padding: spacing.md, gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' }, empty: { paddingVertical: 60, alignItems: 'center', gap: 6 }, emptyTitle: { fontSize: 17, fontWeight: '800' }, error: { paddingHorizontal: spacing.md, paddingVertical: 5, fontSize: 11 },
});

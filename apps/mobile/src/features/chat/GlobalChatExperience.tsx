import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, CompactIdentityBadge, Icon, ScreenHeader } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { PLATFORM_KEYBOARD_BEHAVIOR, PLATFORM_KEYBOARD_DISMISS_MODE, PLATFORM_KEYBOARD_VERTICAL_OFFSET } from '@/utils/keyboard';
import { RichChatComposer } from './RichChatComposer';
import { RichMessageBubble } from './RichMessageBubble';
import type { ChatReaction, ChatReply, ChatSendPayload, RichChatMessage } from './rich-chat-types';
import { ChatCallActions } from '@/features/calls/ChatCallActions';

type Person = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  badges?: Array<{
    id: string;
    code: string;
    label: string;
    backgroundColor: string;
    textColor: string;
    priority: number;
    badgeVariant?: string;
  }>;
};

type Conversation = {
  id: string;
  other?: Person | null;
  lastMessage?: { body: string; sent_at: string; sender_profile_id?: string } | null;
  updated_at: string;
  unreadCount?: number;
};

type InboxPayload = { people: Person[]; conversations: Conversation[] };
type MessagesPayload = { conversation?: Conversation; messages: RichChatMessage[]; pinnedMessages?: RichChatMessage[] };
type InboxItem =
  | { kind: 'label'; id: string; label: string }
  | { kind: 'person'; id: string; person: Person }
  | { kind: 'conversation'; id: string; conversation: Conversation };

export function GlobalChatExperience({ embeddedExpression = false }: { embeddedExpression?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const expression = context?.expression;
  const routeParams = useLocalSearchParams<{ username?: string; forwardText?: string }>();
  const [selected, setSelected] = useState<{ id: string; person: Person } | null>(null);
  const [filter, setFilter] = useState('');
  const [autoOpened, setAutoOpened] = useState('');
  const [replyTo, setReplyTo] = useState<ChatReply | null>(null);
  const [localMessages, setLocalMessages] = useState<RichChatMessage[]>([]);
  const [messageOverrides, setMessageOverrides] = useState<Map<string, Partial<RichChatMessage>>>(new Map());
  const messageListRef = useRef<FlatList<RichChatMessage>>(null);

  const [normalizedFilter, setNormalizedFilter] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingForwardText, setPendingForwardText] = useState(
    typeof routeParams.forwardText === 'string' ? routeParams.forwardText : '',
  );

  useEffect(() => {
    if (typeof routeParams.forwardText === 'string' && routeParams.forwardText.trim()) {
      setPendingForwardText(routeParams.forwardText);
    }
  }, [routeParams.forwardText]);
  const generalThreadBottomInset = embeddedExpression
    ? 0
    : 75 + Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8);
  useEffect(() => {
    const timer = setTimeout(() => setNormalizedFilter(filter.trim().replace(/^@/, '').toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [filter]);
  const viewerKey = `${mode}:${context?.profile?.id ?? 'pending'}`;
  const listKey = `chat:global:${viewerKey}:${normalizedFilter || 'inbox'}`;

  const inbox = useResource<InboxPayload>(listKey, (signal) => {
    if (mode !== 'authenticated') return Promise.resolve({ people: [], conversations: [] });
    const query = normalizedFilter ? `chat?search=${encodeURIComponent(normalizedFilter)}` : 'chat';
    return api.request<InboxPayload>(query, { signal, context: 'public' });
  });

  const threadKey = selected ? `chat:conversation:${viewerKey}:${selected.id}` : 'chat:conversation:none';
  const thread = useResource<MessagesPayload>(threadKey, (signal) => {
    if (!selected || mode !== 'authenticated') return Promise.resolve({ messages: [] });
    return api.request<MessagesPayload>(
      `chat?conversationId=${encodeURIComponent(selected.id)}`,
      { signal, context: 'public' },
    );
  });

  useEffect(() => {
    setReplyTo(null);
    setLocalMessages([]);
    setMessageOverrides(new Map());
  }, [selected?.id]);

  useEffect(() => {
    const serverIds = new Set((thread.data?.messages ?? []).map((message) => message.id));
    setLocalMessages((current) => current.filter((message) => !serverIds.has(message.id)));
    setMessageOverrides(new Map());
  }, [thread.data?.messages]);

  const openUsername = async (username: string, fallback?: Person) => {
    const result = await api.request<{ conversationId: string; other?: Person }>('chat', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({ action: 'open_direct', username }),
    });
    setSelected({
      id: result.conversationId,
      person: result.other ?? fallback ?? { id: username, username },
    });
    invalidate('chat:');
  };

  const openPerson = async (person: Person) => {
    setActionError('');
    try { await openUsername(person.username, person); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Unable to open this conversation.'); }
  };

  useEffect(() => {
    const username = typeof routeParams.username === 'string'
      ? routeParams.username.trim().replace(/^@/, '').toLowerCase()
      : '';
    if (!username || autoOpened === `${viewerKey}:${username}` || mode !== 'authenticated') return;
    setAutoOpened(`${viewerKey}:${username}`);
    void openUsername(username).catch((error) => {
      setActionError(error instanceof Error ? error.message : 'Unable to open this conversation.');
      setFilter(username);
    });
  }, [autoOpened, mode, viewerKey, routeParams.username]);

  const send = async (payload: ChatSendPayload) => {
    if (!selected) throw new Error('Open a conversation first.');
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: RichChatMessage = {
      id: optimisticId,
      body: payload.body,
      sent_at: new Date().toISOString(),
      sender_profile_id: context?.profile?.id ?? 'me',
      sender: context?.profile ? {
        id: context.profile.id,
        username: context.profile.username,
        display_name: context.profile.display_name,
        avatar_url: context.profile.avatar_url,
      } : null,
      reply_to_id: payload.replyToId,
      replyTo,
      attachments: payload.attachments,
      reactions: [],
      optimistic: true,
    };
    setLocalMessages((current) => [...current, optimistic]);
    setActionError('');
    try {
      const created = await api.request<RichChatMessage>('chat', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: 'send',
          conversationId: selected.id,
          body: payload.body,
          replyToId: payload.replyToId,
          attachmentIds: payload.attachments.map((attachment) => attachment.uploadId),
        }),
      });
      setLocalMessages((current) => current.map((message) => message.id === optimisticId ? created : message));
      invalidate(threadKey);
      invalidate('chat:global:');
      if (pendingForwardText) setPendingForwardText('');
    } catch (error) {
      setLocalMessages((current) => current.filter((message) => message.id !== optimisticId));
      setActionError(error instanceof Error ? error.message : 'Message was not sent. Please try again.');
      throw error;
    }
  };

  const updateMessage = (messageId: string, patcher: (message: RichChatMessage) => Partial<RichChatMessage>) => {
    const source = [...(thread.data?.messages ?? []), ...localMessages].find((message) => message.id === messageId);
    if (!source) return;
    const current = { ...source, ...(messageOverrides.get(messageId) ?? {}) };
    setMessageOverrides((previous) => {
      const next = new Map(previous);
      next.set(messageId, { ...(next.get(messageId) ?? {}), ...patcher(current) });
      return next;
    });
  };

  const react = async (message: RichChatMessage, emoji: string) => {
    const before = message.reactions ?? [];
    const existing = before.find((reaction) => reaction.emoji === emoji);
    const after: ChatReaction[] = existing?.reactedByMe
      ? before.map((reaction) => reaction.emoji === emoji
        ? { ...reaction, count: reaction.count - 1, reactedByMe: false }
        : reaction).filter((reaction) => reaction.count > 0)
      : existing
        ? before.map((reaction) => reaction.emoji === emoji
          ? { ...reaction, count: reaction.count + 1, reactedByMe: true }
          : reaction)
        : [...before, { emoji, count: 1, reactedByMe: true }];
    updateMessage(message.id, () => ({ reactions: after }));
    try {
      await api.request('chat', {
        method: 'POST', context: 'public',
        body: JSON.stringify({ action: 'react', conversationId: selected?.id, messageId: message.id, emoji }),
      });
      invalidate(threadKey);
    } catch (error) {
      updateMessage(message.id, () => ({ reactions: before }));
      setActionError(error instanceof Error ? error.message : 'Unable to update that reaction.');
    }
  };

  const pin = async (message: RichChatMessage, pinned: boolean) => {
    const before = { pinned_at: message.pinned_at, pinned_by_profile_id: message.pinned_by_profile_id };
    updateMessage(message.id, () => ({
      pinned_at: pinned ? new Date().toISOString() : null,
      pinned_by_profile_id: pinned ? context?.profile?.id ?? null : null,
    }));
    try {
      await api.request('chat', {
        method: 'POST', context: 'public',
        body: JSON.stringify({ action: 'pin', conversationId: selected?.id, messageId: message.id, pinned }),
      });
      invalidate(threadKey);
    } catch (error) {
      updateMessage(message.id, () => before);
      setActionError(error instanceof Error ? error.message : 'Unable to update that pin.');
    }
  };

  const list = useMemo<InboxItem[]>(() => {
    if (normalizedFilter) {
      return (inbox.data?.people ?? []).map((person) => ({ kind: 'person' as const, id: `p:${person.id}`, person }));
    }
    const conversations = (inbox.data?.conversations ?? []).map((conversation) => ({
      kind: 'conversation' as const,
      id: `c:${conversation.id}`,
      conversation,
    }));
    const conversationPeople = new Set(
      (inbox.data?.conversations ?? []).map((conversation) => conversation.other?.id).filter(Boolean),
    );
    const connections = (inbox.data?.people ?? [])
      .filter((person) => !conversationPeople.has(person.id))
      .map((person) => ({ kind: 'person' as const, id: `p:${person.id}`, person }));
    const items: InboxItem[] = [];
    if (conversations.length) {
      items.push({ kind: 'label', id: 'label:recent', label: 'RECENT MESSAGES' });
      items.push(...conversations);
    }
    if (connections.length) {
      items.push({ kind: 'label', id: 'label:connections', label: 'PEOPLE YOU KNOW' });
      items.push(...connections);
    }
    return items;
  }, [inbox.data, normalizedFilter]);

  const displayedMessages = useMemo(() => {
    const server = (thread.data?.messages ?? []).map((message) => ({
      ...message,
      ...(messageOverrides.get(message.id) ?? {}),
    }));
    const ids = new Set(server.map((message) => message.id));
    return [...server, ...localMessages.filter((message) => !ids.has(message.id)).map((message) => ({
      ...message,
      ...(messageOverrides.get(message.id) ?? {}),
    }))];
  }, [localMessages, messageOverrides, thread.data?.messages]);

  const beginReply = (message: RichChatMessage) => setReplyTo({
    id: message.id,
    body: message.body,
    sender_profile_id: message.sender_profile_id,
    sender: message.sender,
    attachmentType: message.attachments?.[0]?.type ?? null,
  });

  const jumpToMessage = (messageId: string) => {
    const index = displayedMessages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    messageListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  };

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Icon name="chatbubbles-outline" size={38} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to chat</Text>
        <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Direct messages are available to signed-in COT users.</Text>
      </View>
    );
  }

  if (selected) {
    const pinnedMessages = displayedMessages.filter((message) => message.pinned_at);
    const threadPerson = thread.data?.conversation?.other ?? selected.person;
    const threadBadge = threadPerson?.badges?.[0];
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.bg, paddingBottom: generalThreadBottomInset }]}
        behavior={PLATFORM_KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={PLATFORM_KEYBOARD_VERTICAL_OFFSET}
      >
        <View style={[styles.threadHeader, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.card, borderBottomColor: colors.borderSubtle }]}>
          <Pressable onPress={() => setSelected(null)} style={styles.iconButton}><Icon name="arrow-back" size={22} color={colors.text} /></Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/general/member/[username]', params: { username: threadPerson.username } } as any)}
            accessibilityRole="link"
            accessibilityLabel={`Open ${threadPerson.display_name || threadPerson.username} profile`}
          >
            <Avatar url={threadPerson.avatar_url ?? undefined} name={threadPerson.display_name || threadPerson.username} size="sm" />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/general/member/[username]', params: { username: threadPerson.username } } as any)}
            style={styles.headerCopy}
            accessibilityRole="link"
            accessibilityLabel={`Open ${threadPerson.display_name || threadPerson.username} profile`}
          >
            <View style={styles.threadIdentityLine}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{threadPerson.display_name || `@${threadPerson.username}`}</Text>
              {threadBadge ? <CompactIdentityBadge badge={threadBadge} size={15} /> : null}
            </View>
            <Text style={[styles.username, { color: colors.textSecondary }]}>@{threadPerson.username}</Text>
          </Pressable>
          <ChatCallActions scope="direct" conversationId={selected.id} compact />
        </View>

        {pinnedMessages.length ? (
          <Pressable onPress={() => jumpToMessage(pinnedMessages[0].id)} style={[styles.pinnedBanner, { backgroundColor: colors.primarySoft, borderBottomColor: colors.borderSubtle }]}>
            <Icon name="pin" size={15} color={colors.interactive} />
            <Text style={[styles.pinnedText, { color: colors.textSecondary }]} numberOfLines={1}>
              {pinnedMessages.length === 1 ? 'Pinned: ' : `${pinnedMessages.length} pinned · `}{pinnedMessages[0].body || 'Media attachment'}
            </Text>
          </Pressable>
        ) : null}

        {thread.loading && !thread.data ? (
          <View style={styles.center}><ActivityIndicator color={colors.interactive} /></View>
        ) : thread.error && !thread.data ? (
          <Pressable onPress={thread.refresh} style={styles.center}>
            <Icon name="refresh" size={22} color={colors.interactive} />
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Tap to retry this conversation.</Text>
          </Pressable>
        ) : (
          <FlatList
            ref={messageListRef}
            data={displayedMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE}
            onContentSizeChange={() => { if (localMessages.length) messageListRef.current?.scrollToEnd({ animated: true }); }}
            onScrollToIndexFailed={({ index, averageItemLength }) => { messageListRef.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * index), animated: true }); }}
            renderItem={({ item }) => {
              const mine = item.sender_profile_id === context?.profile?.id;
              return (
                <RichMessageBubble
                  message={item}
                  mine={mine}
                  onReply={beginReply}
                  onReact={(target, emoji) => void react(target, emoji)}
                  onPin={(target, pinned) => void pin(target, pinned)}
                  onJumpToMessage={jumpToMessage}
                />
              );
            }}
          />
        )}

        {actionError ? <Text style={{ color: colors.live, padding: 12 }}>{actionError}</Text> : null}
        <RichChatComposer
          endpoint="chat"
          requestContext="public"
          scope={{ conversationId: selected.id }}
          replyTo={replyTo}
          bottomInset={embeddedExpression ? Math.max(insets.bottom, 10) : 8}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
          initialText={pendingForwardText}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {embeddedExpression && expression?.id ? (
        <ExpressionPeopleHeader
          expressionId={expression.id}
          expressionName={expression.name}
          active="chat"
          title="Chat"
          subtitle="Private messages are global across COT. Group conversations stay inside each Group."
          icon="chatbubbles-outline"
        />
      ) : (
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader title="Messages" compact />
        </View>
      )}

      {pendingForwardText ? (
        <View style={[styles.forwardNote, { backgroundColor: colors.primarySoft }]}>
          <Icon name="arrow-redo-outline" size={15} color={colors.interactive} />
          <Text style={[styles.forwardNoteText, { color: colors.textSecondary }]}>Choose a person to forward this message.</Text>
        </View>
      ) : null}

      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search anyone by @username or name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {actionError ? <Text style={{ color: colors.live, padding: 12 }}>{actionError}</Text> : null}
      {inbox.error ? (
        <Pressable onPress={inbox.refresh} style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Icon name="refresh" size={18} color={colors.interactive} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{inbox.error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={normalizedFilter ? (
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SEARCH RESULTS</Text>
        ) : null}
        ListEmptyComponent={
          inbox.loading
            ? <ActivityIndicator color={colors.interactive} />
            : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{normalizedFilter ? 'No matching account' : 'No chat connections yet'}</Text>
                <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}> 
                  {normalizedFilter
                    ? 'Try another username or name.'
                    : 'People you have messaged will appear here automatically. You can also search any COT account above.'}
                </Text>
              </View>
            )
        }
        renderItem={({ item }) => {
          if (item.kind === 'label') {
            return <Text style={[styles.inboxLabel, { color: colors.textMuted }]}>{item.label}</Text>;
          }
          const person = item.kind === 'conversation' ? item.conversation.other : item.person;
          if (!person) return null;
          const lastMessage = item.kind === 'conversation' ? item.conversation.lastMessage?.body : null;
          const unreadCount = item.kind === 'conversation' ? Number(item.conversation.unreadCount ?? 0) : 0;
          return (
            <Pressable
              onPress={() => item.kind === 'conversation'
                ? setSelected({ id: item.conversation.id, person })
                : void openPerson(person)}
              style={[styles.personRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <Avatar url={person.avatar_url ?? undefined} name={person.display_name || person.username} size="md" />
              <View style={styles.personCopy}>
                <Text style={[styles.personName, unreadCount > 0 && styles.personNameUnread, { color: colors.text }]} numberOfLines={1}>{person.display_name || `@${person.username}`}</Text>
                <Text style={[styles.personMeta, unreadCount > 0 && styles.personMetaUnread, { color: unreadCount > 0 ? colors.text : colors.textSecondary }]} numberOfLines={1}>{lastMessage || `@${person.username}`}</Text>
              </View>
              {unreadCount > 0 ? (
                <View style={[styles.unreadBadge, { backgroundColor: colors.interactive }]}>
                  <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  forwardNote: { marginHorizontal: spacing.sm, marginBottom: 4, minHeight: 36, borderRadius: radius.lg, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 7 },
  forwardNoteText: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  search: { marginHorizontal: spacing.sm, minHeight: 44, borderWidth: 1, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  errorCard: { margin: spacing.lg, padding: spacing.md, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  errorText: { flex: 1, fontSize: 13 },
  list: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: spacing.sm },
  inboxLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.05, paddingTop: spacing.md, paddingBottom: 7 },
  personRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { fontSize: 15, fontWeight: '800' },
  personNameUnread: { fontWeight: '900' },
  personMeta: { fontSize: 12, marginTop: 3 },
  personMetaUnread: { fontWeight: '800' },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyCopy: { fontSize: 13, textAlign: 'center', maxWidth: 320 },
  threadHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingBottom: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  threadIdentityLine: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  username: { fontSize: 11, marginTop: 1 },
  pinnedBanner: { minHeight: 38, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pinnedText: { flex: 1, fontSize: 11, fontWeight: '700' },
  messages: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '84%', borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  messageText: { fontSize: 15, lineHeight: 20 },
  sender: { fontSize: 10, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
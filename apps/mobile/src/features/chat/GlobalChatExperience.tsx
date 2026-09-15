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
import { useLocalSearchParams } from 'expo-router';
import { Avatar, Icon, ScreenHeader } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { RichChatComposer } from './RichChatComposer';
import { RichMessageBubble } from './RichMessageBubble';
import type { ChatReaction, ChatReply, ChatSendPayload, RichChatMessage } from './rich-chat-types';

type Person = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
};

type Conversation = {
  id: string;
  other?: Person | null;
  lastMessage?: { body: string; sent_at: string; sender_profile_id?: string } | null;
  updated_at: string;
};

type InboxPayload = { people: Person[]; conversations: Conversation[] };
type MessagesPayload = { conversation?: Conversation; messages: RichChatMessage[]; pinnedMessages?: RichChatMessage[] };
type InboxItem =
  | { kind: 'person'; id: string; person: Person }
  | { kind: 'conversation'; id: string; conversation: Conversation };

export function GlobalChatExperience({ embeddedExpression = false }: { embeddedExpression?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const expression = context?.expression;
  const routeParams = useLocalSearchParams<{ username?: string }>();
  const [selected, setSelected] = useState<{ id: string; person: Person } | null>(null);
  const [filter, setFilter] = useState('');
  const [autoOpened, setAutoOpened] = useState('');
  const [replyTo, setReplyTo] = useState<ChatReply | null>(null);
  const [localMessages, setLocalMessages] = useState<RichChatMessage[]>([]);
  const [messageOverrides, setMessageOverrides] = useState<Map<string, Partial<RichChatMessage>>>(new Map());
  const messageListRef = useRef<FlatList<RichChatMessage>>(null);

  const [normalizedFilter, setNormalizedFilter] = useState('');
  const [actionError, setActionError] = useState('');
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
    return [...conversations, ...connections];
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
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.bg, paddingBottom: generalThreadBottomInset }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.threadHeader, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.card, borderBottomColor: colors.borderSubtle }]}>
          <Pressable onPress={() => setSelected(null)} style={styles.iconButton}><Icon name="arrow-back" size={22} color={colors.text} /></Pressable>
          <Avatar url={selected.person.avatar_url ?? undefined} name={selected.person.display_name || selected.person.username} size="sm" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{selected.person.display_name || `@${selected.person.username}`}</Text>
            <Text style={[styles.username, { color: colors.textSecondary }]}>@{selected.person.username}</Text>
          </View>
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
          <ScreenHeader title="Chat" kicker="DIRECT MESSAGES" subtitle="Private one-to-one conversations across COT." />
        </View>
      )}

      <View style={[styles.scopeNote, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
        <Icon name="people-outline" size={16} color={colors.interactive} />
        <Text style={[styles.scopeNoteText, { color: colors.textSecondary }]}>
          Your inbox shows people you follow or who follow you. Search can find any COT account you are allowed to message. Group chat remains inside each Group.
        </Text>
      </View>

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
        ListHeaderComponent={
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {normalizedFilter ? 'SEARCH RESULTS' : 'MESSAGES & CONNECTIONS'}
          </Text>
        }
        ListEmptyComponent={
          inbox.loading
            ? <ActivityIndicator color={colors.interactive} />
            : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{normalizedFilter ? 'No matching account' : 'No chat connections yet'}</Text>
                <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
                  {normalizedFilter
                    ? 'Try another username or name.'
                    : 'People you follow or who follow you will appear here. You can still search any COT account above.'}
                </Text>
              </View>
            )
        }
        renderItem={({ item }) => {
          const person = item.kind === 'conversation' ? item.conversation.other : item.person;
          if (!person) return null;
          const lastMessage = item.kind === 'conversation' ? item.conversation.lastMessage?.body : null;
          return (
            <Pressable
              onPress={() => item.kind === 'conversation'
                ? setSelected({ id: item.conversation.id, person })
                : void openPerson(person)}
              style={[styles.personRow, { borderBottomColor: colors.borderSubtle }]}
            >
              <Avatar url={person.avatar_url ?? undefined} name={person.display_name || person.username} size="md" />
              <View style={styles.personCopy}>
                <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>{person.display_name || `@${person.username}`}</Text>
                <Text style={[styles.personMeta, { color: colors.textSecondary }]} numberOfLines={1}>{lastMessage || `@${person.username}`}</Text>
              </View>
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
  scopeNote: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scopeNoteText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  search: { marginHorizontal: spacing.lg, minHeight: 48, borderWidth: 1, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  errorCard: { margin: spacing.lg, padding: spacing.md, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  errorText: { flex: 1, fontSize: 13 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: spacing.sm },
  personRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { fontSize: 15, fontWeight: '800' },
  personMeta: { fontSize: 12, marginTop: 3 },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyCopy: { fontSize: 13, textAlign: 'center', maxWidth: 320 },
  threadHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  username: { fontSize: 11, marginTop: 1 },
  pinnedBanner: { minHeight: 38, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pinnedText: { flex: 1, fontSize: 11, fontWeight: '700' },
  messages: { padding: spacing.md, gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '84%', borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  messageText: { fontSize: 15, lineHeight: 20 },
  sender: { fontSize: 10, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
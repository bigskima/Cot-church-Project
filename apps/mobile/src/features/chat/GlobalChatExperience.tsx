import React, { useEffect, useMemo, useState } from 'react';
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

type Message = {
  id: string;
  body: string;
  sent_at: string;
  sender_profile_id: string;
  sender?: Person | null;
};

type InboxPayload = { people: Person[]; conversations: Conversation[] };
type MessagesPayload = { conversation?: Conversation; messages: Message[] };

export function GlobalChatExperience({ embeddedExpression = false }: { embeddedExpression?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const expression = context?.expression;
  const routeParams = useLocalSearchParams<{ username?: string }>();
  const [selected, setSelected] = useState<{ id: string; person: Person } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('');
  const [autoOpened, setAutoOpened] = useState(false);

  const normalizedFilter = filter.trim().replace(/^@/, '').toLowerCase();
  const listKey = `chat:global:${normalizedFilter || 'inbox'}`;

  const inbox = useResource<InboxPayload>(listKey, (signal) => {
    if (mode !== 'authenticated') return Promise.resolve({ people: [], conversations: [] });
    const query = normalizedFilter ? `chat?search=${encodeURIComponent(normalizedFilter)}` : 'chat';
    return api.request<InboxPayload>(query, { signal, context: 'public' });
  });

  const threadKey = selected ? `chat:conversation:${selected.id}` : 'chat:conversation:none';
  const thread = useResource<MessagesPayload>(threadKey, (signal) => {
    if (!selected || mode !== 'authenticated') return Promise.resolve({ messages: [] });
    return api.request<MessagesPayload>(
      `chat?conversationId=${encodeURIComponent(selected.id)}`,
      { signal, context: 'public' },
    );
  });

  const openUsername = async (username: string, fallback?: Person) => {
    const result = await api.request<{ conversationId: string; other: Person }>('chat', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({ action: 'open_direct', username }),
    });
    setSelected({
      id: result.conversationId,
      person: result.other ?? fallback ?? { id: result.other?.id ?? username, username },
    });
    invalidate('chat:');
  };

  const openPerson = async (person: Person) => {
    await openUsername(person.username, person);
  };

  useEffect(() => {
    const username = typeof routeParams.username === 'string'
      ? routeParams.username.trim().replace(/^@/, '').toLowerCase()
      : '';
    if (!username || autoOpened || mode !== 'authenticated') return;
    setAutoOpened(true);
    void openUsername(username).catch(() => {
      setAutoOpened(false);
      setFilter(username);
    });
  }, [autoOpened, mode, routeParams.username]);

  const send = async () => {
    const value = draft.trim();
    if (!value || !selected || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.request('chat', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: 'send',
          conversationId: selected.id,
          body: value,
        }),
      });
      invalidate(threadKey);
      invalidate('chat:global:');
    } catch {
      setDraft(value);
    } finally {
      setSending(false);
    }
  };

  const list = useMemo(() => {
    if (normalizedFilter) {
      return (inbox.data?.people ?? []).map((person) => ({
        kind: 'person' as const,
        id: `p:${person.id}`,
        person,
      }));
    }
    const conversations = (inbox.data?.conversations ?? []).map((conversation) => ({
      kind: 'conversation' as const,
      id: `c:${conversation.id}`,
      conversation,
    }));
    if (conversations.length) return conversations;
    return (inbox.data?.people ?? []).slice(0, 40).map((person) => ({
      kind: 'person' as const,
      id: `p:${person.id}`,
      person,
    }));
  }, [inbox.data, normalizedFilter]);

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Icon name="chatbubbles-outline" size={38} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to chat</Text>
        <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
          Direct messages are available to signed-in COT users.
        </Text>
      </View>
    );
  }

  if (selected) {
    const messages = thread.data?.messages ?? [];
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.threadHeader,
            {
              paddingTop: Math.max(insets.top, 10),
              backgroundColor: colors.card,
              borderBottomColor: colors.borderSubtle,
            },
          ]}
        >
          <Pressable onPress={() => setSelected(null)} style={styles.iconButton}>
            <Icon name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Avatar
            url={selected.person.avatar_url ?? undefined}
            name={selected.person.display_name || selected.person.username}
            size="sm"
          />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {selected.person.display_name || `@${selected.person.username}`}
            </Text>
            <Text style={[styles.username, { color: colors.textSecondary }]}>
              @{selected.person.username}
            </Text>
          </View>
        </View>

        {thread.loading && !thread.data ? (
          <View style={styles.center}><ActivityIndicator color={colors.interactive} /></View>
        ) : thread.error && !thread.data ? (
          <Pressable onPress={thread.refresh} style={styles.center}>
            <Icon name="refresh" size={22} color={colors.interactive} />
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Tap to retry this conversation.</Text>
          </Pressable>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            renderItem={({ item }) => {
              const mine = item.sender_profile_id === context?.profile?.id;
              return (
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.mine : styles.theirs,
                    {
                      backgroundColor: mine ? colors.interactive : colors.card,
                      borderColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <Text style={[styles.messageText, { color: mine ? '#FFFFFF' : colors.text }]}>
                    {item.body}
                  </Text>
                  {!mine && item.sender?.username ? (
                    <Text style={[styles.sender, { color: colors.textMuted }]}>
                      @{item.sender.username}
                    </Text>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <View
          style={[
            styles.composer,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: colors.card,
              borderTopColor: colors.borderSubtle,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderSubtle,
              },
            ]}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            style={[
              styles.sendButton,
              {
                backgroundColor: colors.interactive,
                opacity: !draft.trim() || sending ? 0.45 : 1,
              },
            ]}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Icon name="send" size={20} color="#FFFFFF" />}
          </Pressable>
        </View>
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
          <ScreenHeader
            title="Chat"
            kicker="DIRECT MESSAGES"
            subtitle="Private one-to-one conversations across COT."
          />
        </View>
      )}

      <View style={[styles.scopeNote, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
        <Icon name="people-outline" size={16} color={colors.interactive} />
        <Text style={[styles.scopeNoteText, { color: colors.textSecondary }]}>
          Direct chat is global. Group chat is separate and remains inside the Group.
        </Text>
      </View>

      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search @username or name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {inbox.error ? (
        <Pressable
          onPress={inbox.refresh}
          style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
        >
          <Icon name="refresh" size={18} color={colors.interactive} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {inbox.error} Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {normalizedFilter ? 'PEOPLE' : (inbox.data?.conversations?.length ? 'MESSAGES' : 'PEOPLE')}
          </Text>
        }
        ListEmptyComponent={
          inbox.loading
            ? <ActivityIndicator color={colors.interactive} />
            : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {normalizedFilter ? 'No matching username' : 'No conversations yet'}
                </Text>
                <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
                  {normalizedFilter
                    ? 'Try another username or name.'
                    : 'Search a username to start a private conversation.'}
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
              <Avatar
                url={person.avatar_url ?? undefined}
                name={person.display_name || person.username}
                size="md"
              />
              <View style={styles.personCopy}>
                <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                  {person.display_name || `@${person.username}`}
                </Text>
                <Text style={[styles.personMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {lastMessage || `@${person.username}`}
                </Text>
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

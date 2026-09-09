import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/primitives/Avatar';
import { Icon } from '@/components/primitives/Icon';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';

type Person = { id: string; username: string; display_name?: string | null; avatar_url?: string | null };
type Conversation = { id: string; other?: Person | null; lastMessage?: { body: string; sent_at: string } | null; updated_at: string };
type Message = { id: string; body: string; sent_at: string; sender?: Person | null };
type InboxPayload = { people: Person[]; conversations: Conversation[] };
type MessagesPayload = { messages: Message[] };

export default function GeneralChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const [selected, setSelected] = useState<{ id: string; person: Person } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('');
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const listKey = `chat:general:${organizationId}`;

  const inbox = useResource<InboxPayload>(listKey, (signal) => {
    if (!organizationId || mode !== 'authenticated') return Promise.resolve({ people: [], conversations: [] });
    return api.request(`chat?organizationId=${encodeURIComponent(organizationId)}`, { signal, context: 'public' });
  });

  const messageKey = selected ? `chat:conversation:${selected.id}` : 'chat:conversation:none';
  const thread = useResource<MessagesPayload>(messageKey, (signal) => {
    if (!selected || !organizationId) return Promise.resolve({ messages: [] });
    return api.request(`chat?organizationId=${encodeURIComponent(organizationId)}&conversationId=${encodeURIComponent(selected.id)}`, { signal, context: 'public' });
  });

  const searchResults = useMemo(() => {
    const value = filter.trim().toLowerCase();
    if (!value) return inbox.data?.people ?? [];
    return (inbox.data?.people ?? []).filter((person) => `${person.display_name ?? ''} ${person.username ?? ''}`.toLowerCase().includes(value));
  }, [filter, inbox.data?.people]);

  const openPerson = async (person: Person) => {
    const result = await api.request<{ conversationId: string; other: Person }>('chat', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({ action: 'open_direct', organizationId, username: person.username }),
    });
    setSelected({ id: result.conversationId, person: result.other ?? person });
    invalidate('chat:');
  };

  const send = async () => {
    const value = draft.trim();
    if (!value || !selected || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.request('chat', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ action: 'send', organizationId, conversationId: selected.id, body: value }),
      });
      invalidate(`chat:conversation:${selected.id}`);
      invalidate(listKey);
    } catch {
      setDraft(value);
    } finally {
      setSending(false);
    }
  };

  if (mode !== 'authenticated') {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><Icon name="chatbubbles-outline" size={38} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to chat</Text><Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Chat is available to signed-in COT members.</Text></View>;
  }

  if (selected) {
    const messages = thread.data?.messages ?? [];
    return (
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.threadHeader, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.borderSubtle, backgroundColor: colors.card }]}>
          <Pressable onPress={() => setSelected(null)} style={styles.iconButton}><Icon name="arrow-back" size={22} color={colors.text} /></Pressable>
          <Avatar url={selected.person.avatar_url ?? undefined} name={selected.person.display_name || selected.person.username} size="sm" />
          <View style={styles.headerCopy}><Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{selected.person.display_name || `@${selected.person.username}`}</Text><Text style={[styles.username, { color: colors.textSecondary }]}>@{selected.person.username}</Text></View>
        </View>
        {thread.loading && !thread.data ? <View style={styles.center}><ActivityIndicator color={colors.interactive} /></View> : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            renderItem={({ item }) => {
              const mine = item.sender?.id === context?.profile?.id;
              return <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? colors.interactive : colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.messageText, { color: mine ? '#FFFFFF' : colors.text }]}>{item.body}</Text>{!mine && item.sender?.username ? <Text style={[styles.sender, { color: colors.textMuted }]}>@{item.sender.username}</Text> : null}</View>;
            }}
          />
        )}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: colors.borderSubtle, backgroundColor: colors.card }]}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message…" placeholderTextColor={colors.textMuted} multiline style={[styles.input, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]} />
          <Pressable onPress={send} disabled={!draft.trim() || sending} style={[styles.sendButton, { backgroundColor: colors.interactive, opacity: !draft.trim() || sending ? 0.45 : 1 }]}><Icon name="send" size={20} color="#FFFFFF" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.pageHeader}><View><Text style={[styles.pageTitle, { color: colors.text }]}>Chat</Text><Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Message people in General COT by username.</Text></View><View style={[styles.liveDot, { backgroundColor: colors.interactive }]} /></View>
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name="search" size={18} color={colors.textMuted} /><TextInput value={filter} onChangeText={setFilter} placeholder="Search @username or name" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.text }]} autoCapitalize="none" /></View>

      {inbox.error ? <Pressable onPress={inbox.refresh} style={[styles.errorCard, { borderColor: colors.borderSubtle, backgroundColor: colors.card }]}><Icon name="refresh" size={18} color={colors.interactive} /><Text style={[styles.errorText, { color: colors.textSecondary }]}>{inbox.error} Tap to retry.</Text></Pressable> : null}

      <FlatList
        data={filter.trim() ? searchResults.map((person) => ({ kind: 'person' as const, person, id: `p:${person.id}` })) : [
          ...(inbox.data?.conversations ?? []).map((conversation) => ({ kind: 'conversation' as const, conversation, id: `c:${conversation.id}` })),
          ...(inbox.data?.conversations?.length ? [] : searchResults.slice(0, 30).map((person) => ({ kind: 'person' as const, person, id: `p:${person.id}` }))),
        ]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 96 + insets.bottom }]}
        ListHeaderComponent={<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{filter.trim() ? 'PEOPLE' : (inbox.data?.conversations?.length ? 'MESSAGES' : 'PEOPLE IN COT')}</Text>}
        ListEmptyComponent={inbox.loading ? <ActivityIndicator color={colors.interactive} /> : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: colors.text }]}>No conversations yet</Text><Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Search a username to start a private chat.</Text></View>}
        renderItem={({ item }) => {
          const person = item.kind === 'conversation' ? item.conversation.other : item.person;
          if (!person) return null;
          const lastMessage = item.kind === 'conversation' ? item.conversation.lastMessage?.body : null;
          return <Pressable onPress={() => item.kind === 'conversation' ? setSelected({ id: item.conversation.id, person }) : void openPerson(person)} style={[styles.personRow, { borderBottomColor: colors.borderSubtle }]}><Avatar url={person.avatar_url ?? undefined} name={person.display_name || person.username} size="md" /><View style={styles.personCopy}><Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>{person.display_name || `@${person.username}`}</Text><Text style={[styles.personMeta, { color: colors.textSecondary }]} numberOfLines={1}>{lastMessage || `@${person.username}`}</Text></View><Icon name="chevron-forward" size={18} color={colors.textMuted} /></Pressable>;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  pageHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
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
  emptyCopy: { fontSize: 13, textAlign: 'center', maxWidth: 300 },
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

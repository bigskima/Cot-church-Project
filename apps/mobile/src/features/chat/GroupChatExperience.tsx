import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Icon, ResourceError, ScreenHeader } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Person = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type GroupMessage = {
  id: string;
  group_id: string;
  sender_profile_id: string;
  body: string;
  sent_at: string;
  sender?: Person | null;
};

type GroupChatPayload = {
  group: { id: string; name: string; branch_id?: string | null; isLeader?: boolean };
  messages: GroupMessage[];
};

export function GroupChatExperience({ groupId }: { groupId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const key = `group-chat:${groupId}`;

  const resource = useResource<GroupChatPayload>(key, (signal) => {
    if (mode !== 'authenticated' || !groupId) {
      return Promise.reject(new Error('Join this group to use its chat.'));
    }
    return api.request<GroupChatPayload>(
      `group-chat?groupId=${encodeURIComponent(groupId)}`,
      { signal, context: 'current' },
    );
  });

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.request('group-chat', {
        method: 'POST',
        context: 'current',
        body: JSON.stringify({ action: 'send', groupId, body }),
      });
      invalidate(key);
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  if (resource.loading && !resource.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.interactive} />
      </View>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader title="Group chat" showBack />
        </View>
        <View style={styles.stateBody}>
          <ResourceError message={resource.error} retry={resource.refresh} />
        </View>
      </View>
    );
  }

  const group = resource.data?.group;
  const messages = resource.data?.messages ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title={group?.name ?? 'Group chat'}
          kicker="GROUP CHAT"
          subtitle="A shared conversation for active members of this Group."
          showBack
        />
      </View>

      <View style={[styles.scopeCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
        <Icon name="people-circle-outline" size={17} color={colors.interactive} />
        <Text style={[styles.scopeText, { color: colors.textSecondary }]}>
          This is Group chat, not your private Direct Messages.
        </Text>
        <Pressable onPress={() => router.push('/general/chat' as any)} hitSlop={8}>
          <Text style={[styles.scopeLink, { color: colors.interactive }]}>DMs</Text>
        </Pressable>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="chatbubbles-outline" size={30} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No group messages yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
              Start the conversation for this Group.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.sender_profile_id === context?.profile?.id;
          const senderName = item.sender?.display_name || item.sender?.username || 'Member';
          return (
            <View style={[styles.row, mine && styles.rowMine]}>
              {!mine ? (
                <Avatar url={item.sender?.avatar_url ?? undefined} name={senderName} size="xs" />
              ) : null}
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
                {!mine ? (
                  <Text style={[styles.senderName, { color: colors.interactive }]}>
                    {item.sender?.username ? `@${item.sender.username}` : senderName}
                  </Text>
                ) : null}
                <Text style={[styles.messageText, { color: mine ? '#FFFFFF' : colors.text }]}>
                  {item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />

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
          placeholder="Message the Group…"
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stateBody: { flex: 1, padding: spacing.lg },
  scopeCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scopeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  scopeLink: { fontSize: 12, fontWeight: '800' },
  messages: { padding: spacing.md, gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { borderBottomRightRadius: 5 },
  theirs: { borderBottomLeftRadius: 5 },
  senderName: { fontSize: 10, fontWeight: '800', marginBottom: 3 },
  messageText: { fontSize: 15, lineHeight: 20 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyCopy: { fontSize: 12, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

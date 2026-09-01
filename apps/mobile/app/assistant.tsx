import React, { useState } from 'react';
import {
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
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Button, Chip, Icon, ScreenHeader } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
};

const suggestedPrompts = [
  'What was last Sunday’s sermon about?',
  'Where can I read scripture on divine peace?',
  'What are the upcoming church fellowship events?',
  'How do I submit a confidential prayer request?',
];

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode } = useSession();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Grace and peace to you. I am your church assistant. You can ask me about recent sermon teachings, scripture references, service schedules, prayer support, or campus locations.',
    },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSend(customPrompt?: string) {
    const promptToSend = (customPrompt || text).trim();
    if (!promptToSend || loading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      text: promptToSend,
    };
    const pendingMsg: Message = {
      id: `pending_${Date.now()}`,
      role: 'assistant',
      text: 'Searching sermon teachings and scriptures...',
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setText('');
    setError('');
    setLoading(true);

    try {
      const result = await api.request<{ content?: string; text?: string; response?: string }>('ai-gateway', {
        method: 'POST',
        body: JSON.stringify({ capability: 'assistant.answer', prompt: promptToSend }),
      });
      const responseText = result.content || result.text || result.response || 'I am currently unable to retrieve an answer.';
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pendingMsg.id
            ? { ...item, text: responseText, pending: false }
            : item
        )
      );
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== pendingMsg.id));
      setError(err instanceof Error ? err.message : 'The assistant is temporarily unreachable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + spacing.xs }}>
        <ScreenHeader
          title="Spiritual Assistant"
          subtitle="Scriptures, sermon insights, and church ministry guidance."
          showBack
        />
      </View>

      {/* Messages Feed */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => (
          messages.length <= 2 ? (
            <View style={styles.suggestionsWrap}>
              <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>
                Suggested Questions
              </Text>
              <View style={styles.chipsWrap}>
                {suggestedPrompts.map((p, idx) => (
                  <Chip
                    key={idx}
                    label={p}
                    onPress={() => handleSend(p)}
                  />
                ))}
              </View>
            </View>
          ) : null
        )}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View
              style={[
                styles.bubbleRow,
                isUser ? styles.userRow : styles.assistantRow,
              ]}
            >
              {!isUser && (
                <View style={[styles.assistantIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="sparkles" size={16} color={colors.interactive} />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? { backgroundColor: colors.interactive }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                  shadows.sm,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isUser ? '#FFFFFF' : colors.text },
                    item.pending && { color: colors.textMuted, fontStyle: 'italic' },
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Error Alert */}
      {error ? (
        <View style={[styles.errorBar, { backgroundColor: 'rgba(229, 72, 77, 0.12)' }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Input Composer Bar */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask about sermons, scriptures, prayer..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBg,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          multiline
          maxLength={400}
        />
        <Pressable
          onPress={() => handleSend()}
          disabled={!text.trim() || loading}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: text.trim() ? colors.interactive : colors.bgSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send prompt"
        >
          <Icon
            name="arrow-up"
            size={18}
            color={text.trim() ? '#FFFFFF' : colors.textMuted}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  chatList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  assistantIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionsWrap: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  errorBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  errorText: {
    color: '#E5484D',
    fontSize: 12,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

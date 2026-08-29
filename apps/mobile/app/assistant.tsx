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
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { palette, radius, spacing } from '@/design-system/tokens';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
};

export default function AssistantScreen() {
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello. I can help with verified service times, sermon insights, expression directions, prayer support, and church events.',
    },
  ]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function send() {
    const prompt = text.trim();
    if (!prompt || mode !== 'authenticated') return;
    const user = {
      id: Math.random().toString(36).substring(2),
      role: 'user' as const,
      text: prompt,
    };
    const pending = {
      id: Math.random().toString(36).substring(2),
      role: 'assistant' as const,
      text: 'Seeking verified church information…',
      pending: true,
    };

    setMessages((prev) => [...prev, user, pending]);
    setText('');
    setError('');

    try {
      const result = await api.request<{ content: string }>('ai-gateway', {
        method: 'POST',
        body: JSON.stringify({ capability: 'assistant.answer', prompt }),
      });
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pending.id
            ? { ...item, text: result.content, pending: false }
            : item
        )
      );
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== pending.id));
      setError(err instanceof Error ? err.message : 'The assistant is unavailable.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }] as any}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: isDark ? '#140C07' : '#22140C' }] as any}>
        <Pressable onPress={() => router.back()} style={styles.backBtn as any}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Sanctuary Assistant</Text>
          <Text style={styles.headerSubtitle}>Verified Church AI Guidance</Text>
        </View>
      </View>

      {mode === 'visitor' ? (
        <View style={styles.visitorGate}>
          <Text style={[styles.visitorTitle, { color: colors.text }] as any}>Sign in for church assistant</Text>
          <Text style={[styles.visitorSubtitle, { color: colors.textMuted }] as any}>
            Sign in with your member account to access pastoral study summaries and personal schedule assistance.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View
                  style={[
                    styles.messageBubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: isDark ? '#78350F' : '#26140A' }]
                      : [styles.assistantBubble, { backgroundColor: isDark ? '#22140C' : '#FFFDF9', borderColor: isDark ? '#452A1A' : '#E8D5C4' }],
                    item.pending ? styles.pendingBubble : null,
                  ] as any}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser
                        ? styles.userText
                        : [styles.assistantText, { color: isDark ? '#FFFDF9' : '#26140A' }],
                    ] as any}
                  >
                    {item.text}
                  </Text>
                </View>
              );
            }}
          />

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }] as any}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Ask about sermons, services, or events…"
              placeholderTextColor={colors.textMuted}
              style={[styles.inputField, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }] as any}
            />
            <Pressable
              onPress={send}
              style={({ pressed }) => [
                styles.sendBtn,
                { opacity: pressed || !text.trim() ? 0.6 : 1 },
              ] as any}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  backIcon: {
    color: '#FFFDF9',
    fontSize: 28,
    lineHeight: 28,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFDF9',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  visitorGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  visitorTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  visitorSubtitle: {
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  pendingBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFDF9',
    fontWeight: '600',
  },
  assistantText: {
    fontWeight: '500',
  },
  errorBanner: {
    color: palette.live,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    fontSize: 12,
  },
  inputRow: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
  },
  inputField: {
    flex: 1,
    maxHeight: 90,
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#140C07',
  },
});

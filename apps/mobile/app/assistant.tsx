import React, { useEffect, useState } from 'react';
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
import { Badge, Button, Chip, Icon, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
};

type AiReadiness = {
  capability: string;
  ready: boolean;
  reason?: string | null;
  providerCode?: string;
  providerName?: string;
  modelKey?: string;
  modelName?: string;
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

  const [readiness, setReadiness] = useState<AiReadiness | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(true);
  const [readinessError, setReadinessError] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Grace and peace to you. I am your church assistant. Ask me about verified church schedules, announcements, sermon teachings, scripture references, and member support pathways.',
    },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReadiness = async () => {
    if (mode !== 'authenticated') {
      setReadiness(null);
      setCheckingReadiness(false);
      return;
    }
    setCheckingReadiness(true);
    setReadinessError('');
    try {
      const state = await api.request<AiReadiness>('ai-gateway?capability=assistant.answer');
      setReadiness(state);
    } catch (value) {
      setReadiness(null);
      setReadinessError(value instanceof Error ? value.message : 'Unable to verify assistant availability.');
    } finally {
      setCheckingReadiness(false);
    }
  };

  useEffect(() => {
    void loadReadiness();
  }, [api, mode]);

  async function handleSend(customPrompt?: string) {
    const promptToSend = (customPrompt || text).trim();
    if (!promptToSend || loading || !readiness?.ready) return;

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: promptToSend };
    const pendingMsg: Message = {
      id: `pending_${Date.now()}`,
      role: 'assistant',
      text: 'Checking verified church information…',
      pending: true,
    };

    setMessages((previous) => [...previous, userMsg, pendingMsg]);
    setText('');
    setError('');
    setLoading(true);

    try {
      const result = await api.request<{ content?: unknown; text?: string; response?: string }>('ai-gateway', {
        method: 'POST',
        body: JSON.stringify({ capability: 'assistant.answer', prompt: promptToSend }),
      });
      const responseText =
        typeof result.content === 'string'
          ? result.content
          : result.content !== undefined
            ? JSON.stringify(result.content)
            : result.text || result.response || 'I am currently unable to retrieve an answer.';
      setMessages((previous) => previous.map((item) => item.id === pendingMsg.id ? { ...item, text: responseText, pending: false } : item));
    } catch (value) {
      setMessages((previous) => previous.filter((item) => item.id !== pendingMsg.id));
      setError(value instanceof Error ? value.message : 'The assistant is temporarily unreachable.');
      await loadReadiness();
    } finally {
      setLoading(false);
    }
  }

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xs }]}>
        <ScreenHeader title="COT Assistant" subtitle="Verified church information and ministry guidance." showBack />
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}><Icon name="sparkles" size={30} color={colors.interactive} /></View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Sign in to use the church assistant</Text>
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>The assistant uses your active church context so it can answer only from information you are allowed to access.</Text>
          <Button label="Sign In" onPress={() => router.replace('/(auth)/login')} variant="primary" size="lg" />
        </View>
      </View>
    );
  }

  if (checkingReadiness) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xs }]}>
        <ScreenHeader title="COT Assistant" subtitle="Getting things ready…" showBack />
        <View style={styles.stateWrap}><Skeleton height={80} count={3} /></View>
      </View>
    );
  }

  if (!readiness?.ready) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xs }]}>
        <ScreenHeader title="COT Assistant" subtitle="Helpful answers based on available church information." showBack />
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="sparkles-outline" size={30} color={colors.textMuted} /></View>
          <Badge label="UNAVAILABLE" variant="neutral" />
          <Text style={[styles.stateTitle, { color: colors.text }]}>The church assistant is temporarily unavailable</Text>
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>Please try again later. You can continue using sermons, events, prayer and the rest of the app while this feature is unavailable.</Text>
          {readinessError ? <Text style={[styles.readinessError, { color: colors.textMuted }]}>We couldn’t confirm availability right now.</Text> : null}
          <Button label="Check Again" onPress={() => void loadReadiness()} variant="outline" size="md" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.assistantHeader, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
        <ScreenHeader title="COT Assistant" kicker="VERIFIED CHURCH AI" subtitle="Scriptures, sermons, schedules and church guidance." showBack />
        <View style={styles.providerRow}>
          <Badge label="AVAILABLE" variant="active" />
          <Text style={[styles.providerText, { color: colors.textMuted }]}>Ready to help</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => messages.length <= 2 ? (
          <View style={styles.suggestionsWrap}>
            <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>Suggested Questions</Text>
            <View style={styles.chipsWrap}>{suggestedPrompts.map((prompt) => <Chip key={prompt} label={prompt} onPress={() => void handleSend(prompt)} />)}</View>
          </View>
        ) : null}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.bubbleRow, isUser ? styles.userRow : styles.assistantRow]}>
              {!isUser ? <View style={[styles.assistantIcon, { backgroundColor: colors.primarySoft }]}><Icon name="sparkles" size={16} color={colors.interactive} /></View> : null}
              <View style={[styles.bubble, isUser ? { backgroundColor: colors.interactive } : { backgroundColor: colors.card, borderColor: colors.borderSubtle, borderWidth: 1 }, isUser ? shadows.none : shadows.sm]}>
                <Text style={[styles.bubbleText, { color: isUser ? '#FFFFFF' : colors.text }, item.pending && { color: colors.textMuted, fontStyle: 'italic' }]}>{item.text}</Text>
              </View>
            </View>
          );
        }}
      />

      {error ? <View style={[styles.errorBar, { backgroundColor: colors.liveSoft }]}><Text style={[styles.errorText, { color: colors.live }]}>{error}</Text></View> : null}

      <View style={[styles.composer, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, marginBottom: Math.max(insets.bottom, spacing.sm) }, shadows.floating]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask about sermons, scriptures, prayer..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.borderSubtle }]}
          multiline
          maxLength={400}
        />
        <Pressable
          onPress={() => void handleSend()}
          disabled={!text.trim() || loading}
          style={({ pressed }) => [styles.sendBtn, { backgroundColor: text.trim() ? colors.interactive : colors.bgSecondary, opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Send prompt"
        >
          <Icon name="arrow-up" size={18} color={text.trim() ? '#FFFFFF' : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stateWrap: { flex: 1, paddingHorizontal: spacing.xxl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  stateIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stateBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 460 },
  readinessError: { fontSize: 12, textAlign: 'center' },
  assistantHeader: { marginHorizontal: spacing.md, marginTop: spacing.xs, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  providerText: { fontSize: 11, fontWeight: '600' },
  chatList: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.md },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  assistantIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.xl },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  suggestionsWrap: { marginTop: spacing.lg, gap: spacing.xs },
  suggestionsLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  errorBar: { paddingHorizontal: spacing.lg, paddingVertical: 6 },
  errorText: { fontSize: 12, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: spacing.md, padding: spacing.sm, borderWidth: 1, borderRadius: radius.xxl, gap: spacing.sm },
  input: { flex: 1, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 110 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

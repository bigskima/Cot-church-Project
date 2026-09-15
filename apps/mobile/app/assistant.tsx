import React, { useEffect, useMemo, useState } from 'react';
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

type AssistantAction = {
  label: string;
  route: string;
  icon: string;
  description?: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  actions?: AssistantAction[];
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
  'How do I send a prayer request?',
  'What can I do in this part of COT?',
  'What church events are coming up?',
  'I need someone to talk to today.',
  'What was the latest sermon about?',
];

function navigationActions(prompt: string, expressionId?: string): AssistantAction[] {
  const text = prompt.toLowerCase();
  const expression = expressionId ? `/expressions/${expressionId}` : '';

  if (/prayer|pray|intercession|petition/.test(text)) {
    return expressionId
      ? [
          { label: 'Prayer in this Expression', route: `${expression}/prayer`, icon: 'heart-outline', description: 'Submit inside the Expression you are currently using.' },
          { label: 'General COT Prayer', route: '/general/prayer', icon: 'globe-outline', description: 'Open the church-wide prayer submission.' },
        ]
      : [
          { label: 'Open Prayer', route: '/general/prayer', icon: 'heart-outline', description: 'Submit a General COT prayer request.' },
          { label: 'Choose an Expression', route: '/expressions', icon: 'people-outline', description: 'Enter an Expression first if you want the request scoped there.' },
        ];
  }
  if (/event|programme|program|meeting|gather|service|schedule/.test(text)) {
    return expressionId
      ? [{ label: 'Expression events', route: `${expression}/events`, icon: 'calendar-outline' }, { label: 'General events', route: '/general/events', icon: 'globe-outline' }]
      : [{ label: 'Open events', route: '/general/events', icon: 'calendar-outline' }];
  }
  if (/sermon|message|preach|teaching/.test(text)) {
    return expressionId
      ? [{ label: 'Expression sermons', route: `${expression}/sermons`, icon: 'book-outline' }, { label: 'General sermons', route: '/general/sermons', icon: 'globe-outline' }]
      : [{ label: 'Open sermons', route: '/general/sermons', icon: 'book-outline' }];
  }
  if (/notification|alert|update/.test(text)) return [{ label: 'Open notifications', route: expressionId ? `${expression}/notifications` : '/general/notifications', icon: 'notifications-outline' }];
  if (/give|giving|offering|donat/.test(text)) {
    return expressionId
      ? [{ label: 'Expression giving', route: `${expression}/giving`, icon: 'gift-outline' }, { label: 'General giving', route: '/general/giving', icon: 'globe-outline' }]
      : [{ label: 'Open giving', route: '/general/giving', icon: 'gift-outline' }];
  }
  if (/group|community/.test(text) && expressionId) return [{ label: 'Expression groups', route: `${expression}/groups`, icon: 'people-circle-outline' }];
  if (/message|dm|chat|talk to member/.test(text)) return [{ label: 'Open messages', route: '/general/chat', icon: 'chatbubbles-outline' }];
  if (/expression|my church space|community space/.test(text)) return [{ label: 'My Expressions', route: '/expressions', icon: 'grid-outline' }];
  return [];
}

export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const expressionId = context?.expression?.id;
  const expressionName = context?.expression?.name;
  const displayName = context?.profile?.display_name?.trim() || 'there';
  const scopeLabel = expressionId ? expressionName || 'this Expression' : 'General COT';

  const welcome = useMemo<Message>(() => ({
    id: 'welcome',
    role: 'assistant',
    text: `Hi ${displayName}. I’m COT AI. I can chat with you, explain what is happening in ${scopeLabel}, and take you directly to the right COT screen when you want to pray, give, find an event, open a sermon, message someone, or navigate the app.`,
  }), [displayName, scopeLabel]);

  const [readiness, setReadiness] = useState<AiReadiness | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(true);
  const [readinessError, setReadinessError] = useState('');
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMessages((previous) => previous.length === 1 && previous[0]?.id === 'welcome' ? [welcome] : previous);
  }, [welcome]);

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
  }, [api, mode, expressionId]);

  async function handleSend(customPrompt?: string) {
    const promptToSend = (customPrompt || text).trim();
    if (!promptToSend || loading || !readiness?.ready) return;

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: promptToSend };
    const pendingMsg: Message = {
      id: `pending_${Date.now()}`,
      role: 'assistant',
      text: `Checking ${scopeLabel} and the COT pathways available to you…`,
      pending: true,
    };
    const actions = navigationActions(promptToSend, expressionId);
    const recentConversation = [...messages.filter((item) => !item.pending && item.id !== 'welcome'), userMsg]
      .slice(-7)
      .map((item) => `${item.role === 'user' ? 'Member' : 'Assistant'}: ${item.text}`)
      .join('\n');
    const contextualPrompt = [
      `Current member space: ${expressionId ? `Expression ${expressionName || expressionId}` : 'General COT'}.`,
      recentConversation ? `Recent conversation:\n${recentConversation}` : '',
      `Current member message: ${promptToSend}`,
      'Answer naturally for everyday conversation when appropriate. When the member is asking how to do something in COT, use the verified navigation paths in your context and name the exact destination instead of inventing a generic link.',
    ].filter(Boolean).join('\n\n');

    setMessages((previous) => [...previous, userMsg, pendingMsg]);
    setText('');
    setError('');
    setLoading(true);

    try {
      const result = await api.request<{ content?: unknown; text?: string; response?: string }>('ai-gateway', {
        method: 'POST',
        body: JSON.stringify({ capability: 'assistant.answer', prompt: contextualPrompt }),
      });
      const responseText =
        typeof result.content === 'string'
          ? result.content
          : result.content !== undefined
            ? JSON.stringify(result.content)
            : result.text || result.response || 'I am currently unable to retrieve an answer.';
      setMessages((previous) => previous.map((item) => item.id === pendingMsg.id ? { ...item, text: responseText, pending: false, actions } : item));
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
        <ScreenHeader title="COT AI" subtitle="Conversation, church guidance and in-app navigation." showBack />
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}><Icon name="sparkles" size={30} color={colors.interactive} /></View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Sign in to use COT AI</Text>
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>Your signed-in church and Expression context is what lets COT AI guide you to the correct private or General destination.</Text>
          <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/assistant' } } as any)} variant="primary" size="lg" />
        </View>
      </View>
    );
  }

  if (checkingReadiness) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xs }]}>
        <ScreenHeader title="COT AI" subtitle={`Getting ${scopeLabel} ready…`} showBack />
        <View style={styles.stateWrap}><Skeleton height={80} count={3} /></View>
      </View>
    );
  }

  if (!readiness?.ready) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xs }]}>
        <ScreenHeader title="COT AI" subtitle="Church guidance and everyday conversation." showBack />
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="sparkles-outline" size={30} color={colors.textMuted} /></View>
          <Badge label="UNAVAILABLE" variant="neutral" />
          <Text style={[styles.stateTitle, { color: colors.text }]}>COT AI is temporarily unavailable</Text>
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>You can continue using sermons, events, prayer, giving and the rest of COT while the assistant reconnects.</Text>
          {readinessError ? <Text style={[styles.readinessError, { color: colors.textMuted }]}>We couldn’t confirm availability right now.</Text> : null}
          <Button label="Check again" onPress={() => void loadReadiness()} variant="outline" size="md" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.assistantHeader, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
        <ScreenHeader title="COT AI" kicker={expressionId ? 'EXPRESSION-AWARE AI' : 'GENERAL COT AI'} subtitle={`Talking with you in ${scopeLabel}.`} showBack />
        <View style={styles.providerRow}>
          <Badge label="AVAILABLE" variant="active" />
          <View style={[styles.scopeChip, { backgroundColor: colors.primarySoft }]}><Icon name={expressionId ? 'people-outline' : 'globe-outline'} size={12} color={colors.interactive} /><Text style={[styles.scopeText, { color: colors.interactive }]} numberOfLines={1}>{scopeLabel}</Text></View>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={() => messages.length <= 2 ? (
          <View style={styles.suggestionsWrap}>
            <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>Ask anything or try one of these</Text>
            <View style={styles.chipsWrap}>{suggestedPrompts.map((prompt) => <Chip key={prompt} label={prompt} onPress={() => void handleSend(prompt)} />)}</View>
          </View>
        ) : null}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.messageBlock, isUser ? styles.userBlock : styles.assistantBlock]}>
              <View style={[styles.bubbleRow, isUser ? styles.userRow : styles.assistantRow]}>
                {!isUser ? <View style={[styles.assistantIcon, { backgroundColor: colors.primarySoft }]}><Icon name="sparkles" size={16} color={colors.interactive} /></View> : null}
                <View style={[styles.bubble, isUser ? { backgroundColor: colors.interactive } : { backgroundColor: colors.card, borderColor: colors.borderSubtle, borderWidth: 1 }, isUser ? shadows.none : shadows.sm]}>
                  <Text style={[styles.bubbleText, { color: isUser ? '#FFFFFF' : colors.text }, item.pending && { color: colors.textMuted, fontStyle: 'italic' }]}>{item.text}</Text>
                </View>
              </View>
              {!isUser && item.actions?.length ? (
                <View style={styles.actionList}>
                  {item.actions.map((action) => (
                    <Pressable key={`${item.id}:${action.route}`} onPress={() => router.push(action.route as any)} style={({ pressed }) => [styles.routeAction, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}>
                      <View style={[styles.routeIcon, { backgroundColor: colors.primarySoft }]}><Icon name={action.icon as any} size={17} color={colors.interactive} /></View>
                      <View style={styles.routeCopy}><Text style={[styles.routeLabel, { color: colors.text }]}>{action.label}</Text>{action.description ? <Text style={[styles.routeDescription, { color: colors.textMuted }]}>{action.description}</Text> : null}</View>
                      <Icon name="arrow-forward" size={15} color={colors.interactive} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      {error ? <View style={[styles.errorBar, { backgroundColor: colors.liveSoft }]}><Text style={[styles.errorText, { color: colors.live }]}>{error}</Text></View> : null}

      <View style={[styles.composer, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, marginBottom: Math.max(insets.bottom, spacing.sm) }, shadows.floating]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message COT AI in ${scopeLabel}…`}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.borderSubtle }]}
          multiline
          maxLength={1200}
        />
        <Pressable onPress={() => void handleSend()} disabled={!text.trim() || loading} style={({ pressed }) => [styles.sendBtn, { backgroundColor: text.trim() ? colors.interactive : colors.bgSecondary, opacity: pressed ? 0.8 : 1 }]} accessibilityRole="button" accessibilityLabel="Send message to COT AI">
          <Icon name="arrow-up" size={18} color={text.trim() ? '#FFFFFF' : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export default AssistantScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stateWrap: { flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  stateIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stateBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 460 },
  readinessError: { fontSize: 12, textAlign: 'center' },
  assistantHeader: { marginHorizontal: spacing.md, marginTop: spacing.xs, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  scopeChip: { minHeight: 25, maxWidth: 260, borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  scopeText: { fontSize: 10, fontWeight: '800', flexShrink: 1 },
  chatList: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  messageBlock: { gap: spacing.xs }, userBlock: { alignItems: 'flex-end' }, assistantBlock: { alignItems: 'stretch' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  userRow: { justifyContent: 'flex-end' }, assistantRow: { justifyContent: 'flex-start' },
  assistantIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.xl },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  actionList: { marginLeft: 40, gap: 7, maxWidth: 520 },
  routeAction: { minHeight: 54, borderWidth: 1, borderRadius: radius.lg, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  routeIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeCopy: { flex: 1, minWidth: 0 }, routeLabel: { fontSize: 12.5, fontWeight: '900' }, routeDescription: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  suggestionsWrap: { marginTop: spacing.lg, gap: spacing.xs }, suggestionsLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.1 }, chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  errorBar: { marginHorizontal: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.lg }, errorText: { fontSize: 12, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: spacing.md, padding: spacing.sm, borderWidth: 1, borderRadius: radius.xxl, gap: spacing.sm },
  input: { flex: 1, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 120 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Badge, Button, Chip, Icon, ScreenHeader, Skeleton } from '@/components';
import { ReadAloudRateControl, useReadAloudRate } from '@/components/ReadAloudRateControl';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { PLATFORM_KEYBOARD_BEHAVIOR, PLATFORM_KEYBOARD_DISMISS_MODE, PLATFORM_KEYBOARD_VERTICAL_OFFSET } from '@/utils/keyboard';

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
  'Show me how to use COT step by step.',
  'How do I use the Home spotlight and daily content?',
  'How do I send a prayer request?',
  'How do I use the ministry tools available to my role?',
  'How do calls and messages work?',
];

function normalizeAssistantMarkdown(value: string) {
  const cleaned = value
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => !/^\s*(?:(?:[-_*—–]\s*){3,}|(?:\.\s*){3,})\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

function markdownToPlainText(value: string) {
  return normalizeAssistantMarkdown(value)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '• ')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();
}

function assistantSpeechText(value: string) {
  return markdownToPlainText(value)
    .replace(/^•\s*/gm, '')
    .replace(/\bC(?:\s*\.?\s*)O(?:\s*\.?\s*)T\b/gi, 'C O T')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function splitSpeech(text: string, maximum: number) {
  const safeMaximum = Math.max(500, Math.min(maximum || 3000, 3500));
  const paragraphs = text.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (!current) current = paragraph;
    else if (`${current}\n${paragraph}`.length <= safeMaximum) current = `${current}\n${paragraph}`;
    else { chunks.push(current); current = paragraph; }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => chunk.length <= safeMaximum
    ? [chunk]
    : Array.from({ length: Math.ceil(chunk.length / safeMaximum) }, (_, index) => chunk.slice(index * safeMaximum, (index + 1) * safeMaximum)));
}

function InlineMarkdown({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g).filter(Boolean);
  return (
    <Text style={[styles.markdownText, { color }]}>
      {parts.map((part, index) => {
        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          return <Text key={`${index}-${part}`} style={styles.markdownBold}>{part.slice(2, -2)}</Text>;
        }
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          return <Text key={`${index}-${part}`} style={styles.markdownItalic}>{part.slice(1, -1)}</Text>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <Text key={`${index}-${part}`} style={styles.markdownCode}>{part.slice(1, -1)}</Text>;
        }
        return <Text key={`${index}-${part}`}>{part}</Text>;
      })}
    </Text>
  );
}

function AssistantMarkdown({ value }: { value: string }) {
  const { colors } = useTheme();
  const lines = normalizeAssistantMarkdown(value).split('\n');
  return (
    <View style={styles.markdownWrap}>
      {lines.map((raw, index) => {
        const line = raw.trim();
        if (!line) return <View key={`space-${index}`} style={styles.markdownSpace} />;
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
          return <Text key={`heading-${index}`} style={[styles.markdownHeading, heading[1].length === 1 && styles.markdownHeadingLarge, { color: colors.text }]}>{markdownToPlainText(heading[2])}</Text>;
        }
        const bullet = line.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
          return (
            <View key={`bullet-${index}`} style={styles.markdownBulletRow}>
              <Text style={[styles.markdownBullet, { color: colors.interactive }]}>•</Text>
              <View style={styles.markdownBulletBody}><InlineMarkdown text={bullet[1]} color={colors.text} /></View>
            </View>
          );
        }
        const numbered = line.match(/^\d+[.)]\s+(.+)$/);
        if (numbered) {
          const number = line.match(/^(\d+)/)?.[1] ?? '';
          return (
            <View key={`number-${index}`} style={styles.markdownBulletRow}>
              <Text style={[styles.markdownNumber, { color: colors.interactive }]}>{number}.</Text>
              <View style={styles.markdownBulletBody}><InlineMarkdown text={numbered[1]} color={colors.text} /></View>
            </View>
          );
        }
        return <InlineMarkdown key={`line-${index}`} text={line} color={colors.text} />;
      })}
    </View>
  );
}

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
  if (/leader|leadership|pastor|our story|history|mission|vision|address|location|where.*church|where.*cot/.test(text)) {
    return [{ label: 'Our Story & Leadership', route: '/general/church-story', icon: 'library-outline', description: 'Open the published COT story, leaders and location.' }];
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
  const speechRun = useRef(0);

  const welcome = useMemo<Message>(() => ({
    id: 'welcome',
    role: 'assistant',
    text: `Hi ${displayName}. I’m COT AI. I can chat with you, explain verified COT information, and now guide you step by step through the COT screens and workflows available to your account. You can also use Read aloud on my answers.`,
  }), [displayName]);

  const [readiness, setReadiness] = useState<AiReadiness | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(true);
  const [readinessError, setReadinessError] = useState('');
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useReadAloudRate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMessages((previous) => previous.length === 1 && previous[0]?.id === 'welcome' ? [welcome] : previous);
  }, [welcome]);
  useEffect(() => () => { speechRun.current += 1; void Speech.stop(); }, []);

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

  useEffect(() => { void loadReadiness(); }, [api, mode, expressionId]);

  const copyResponse = async (message: Message) => {
    await Clipboard.setStringAsync(markdownToPlainText(message.text));
    setCopiedId(message.id);
    setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1600);
  };

  const readResponse = async (message: Message) => {
    if (speakingId === message.id) {
      speechRun.current += 1;
      setSpeakingId(null);
      await Speech.stop();
      return;
    }
    await Speech.stop();
    const run = ++speechRun.current;
    const chunks = splitSpeech(assistantSpeechText(message.text), Speech.maxSpeechInputLength);
    setSpeakingId(message.id);
    const speakChunk = (index: number) => {
      if (run !== speechRun.current) return;
      if (index >= chunks.length) { setSpeakingId(null); return; }
      Speech.speak(chunks[index], {
        rate: speechRate,
        onDone: () => speakChunk(index + 1),
        onStopped: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    };
    speakChunk(0);
  };

  async function handleSend(customPrompt?: string) {
    const promptToSend = (customPrompt || text).trim();
    if (!promptToSend || loading || !readiness?.ready) return;

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: promptToSend };
    const pendingMsg: Message = {
      id: `pending_${Date.now()}`,
      role: 'assistant',
      text: `Checking ${scopeLabel} and the verified COT information available to you…`,
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
      'Answer naturally. Use the verified COT context for church facts and the role-aware COT Guide for how-to instructions. If the member asks about a leader, location, event, sermon, group, story or announcement, use the saved database information and clearly say when that information has not yet been published. If they ask how to use COT, give detailed visible-screen steps and respect the tools available to their verified role. Use clean Markdown only when it improves readability. Never output decorative separator lines made from dashes, underscores, asterisks or dots.',
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
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>Your signed-in church and Expression context lets COT AI answer from the correct COT data without crossing private boundaries.</Text>
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
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={PLATFORM_KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={PLATFORM_KEYBOARD_VERTICAL_OFFSET}
    >
      <View style={[styles.assistantHeader, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.glass, borderColor: colors.borderSubtle }, shadows.sm]}>
        <ScreenHeader title="COT AI" kicker={expressionId ? 'EXPRESSION-AWARE AI' : 'GENERAL COT AI'} subtitle={`Talking with you in ${scopeLabel}.`} showBack />
        <View style={styles.providerRow}>
          <Badge label="AVAILABLE" variant="active" />
          <View style={[styles.scopeChip, { backgroundColor: colors.primarySoft }]}><Icon name={expressionId ? 'people-outline' : 'globe-outline'} size={12} color={colors.interactive} /><Text style={[styles.scopeText, { color: colors.interactive }]} numberOfLines={1}>{scopeLabel}</Text></View>
        </View>
        <View style={styles.voiceSettings}>
          <ReadAloudRateControl value={speechRate} onChange={setSpeechRate} compact />
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={PLATFORM_KEYBOARD_DISMISS_MODE}
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
                  {isUser || item.pending
                    ? <Text style={[styles.bubbleText, { color: isUser ? '#FFFFFF' : colors.textMuted }, item.pending && { fontStyle: 'italic' }]}>{item.text}</Text>
                    : <AssistantMarkdown value={item.text} />}
                </View>
              </View>

              {!isUser && !item.pending ? (
                <View style={styles.responseTools}>
                  <Pressable onPress={() => void copyResponse(item)} style={({ pressed }) => [styles.responseTool, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Copy AI response">
                    <Icon name={copiedId === item.id ? 'checkmark-outline' : 'copy-outline'} size={14} color={colors.interactive} />
                    <Text style={[styles.responseToolText, { color: colors.textSecondary }]}>{copiedId === item.id ? 'Copied' : 'Copy'}</Text>
                  </Pressable>
                  <Pressable onPress={() => void readResponse(item)} style={({ pressed }) => [styles.responseTool, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={speakingId === item.id ? 'Stop reading response' : 'Read AI response aloud'}>
                    <Icon name={speakingId === item.id ? 'stop-circle-outline' : 'volume-high-outline'} size={14} color={colors.interactive} />
                    <Text style={[styles.responseToolText, { color: colors.textSecondary }]}>{speakingId === item.id ? 'Stop' : 'Read aloud'}</Text>
                  </Pressable>
                </View>
              ) : null}

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
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  voiceSettings: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  scopeChip: { minHeight: 25, maxWidth: 260, borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  scopeText: { fontSize: 10, fontWeight: '800', flexShrink: 1 },
  chatList: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  messageBlock: { gap: spacing.xs }, userBlock: { alignItems: 'flex-end' }, assistantBlock: { alignItems: 'stretch' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  userRow: { justifyContent: 'flex-end' }, assistantRow: { justifyContent: 'flex-start' },
  assistantIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.xl },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  markdownWrap: { gap: 3 }, markdownSpace: { height: 5 }, markdownText: { fontSize: 14, lineHeight: 21 },
  markdownBold: { fontWeight: '900' }, markdownItalic: { fontStyle: 'italic' }, markdownCode: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13 },
  markdownHeading: { fontSize: 15, lineHeight: 21, fontWeight: '900', marginTop: 4 }, markdownHeadingLarge: { fontSize: 18, lineHeight: 24 },
  markdownBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, markdownBullet: { width: 12, fontSize: 17, lineHeight: 21, fontWeight: '900' }, markdownNumber: { minWidth: 20, fontSize: 13, lineHeight: 21, fontWeight: '900' }, markdownBulletBody: { flex: 1 },
  responseTools: { marginLeft: 40, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, responseTool: { minHeight: 32, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }, responseToolText: { fontSize: 10.5, fontWeight: '800' },
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
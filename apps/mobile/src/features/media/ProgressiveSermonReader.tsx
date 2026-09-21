import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet, Button, Icon, Skeleton } from '@/components';
import { ReadAloudRateControl, useReadAloudRate } from '@/components/ReadAloudRateControl';
import { ScripturePreviewCard } from '@/components/bible/ScriptureReferenceText';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';
import { parseSermonMarkdown, sermonBlocksToPlainText, type SermonRichBlock } from './sermon-rich-content';

type AiResult = { content?: unknown; text?: string; response?: string };
type Props = { sermon: Sermon; initialBlocks?: SermonRichBlock[] };
type SpeechTarget = 'sermon' | 'ai' | null;

function resultText(result: AiResult) {
  if (typeof result.content === 'string') return result.content;
  if (result.content && typeof result.content === 'object') {
    const object = result.content as Record<string, unknown>;
    const summary = typeof object.summary === 'string' ? object.summary : '';
    const takeaways = Array.isArray(object.takeaways) ? object.takeaways.map(String).filter(Boolean) : [];
    if (summary || takeaways.length) return [summary, ...takeaways.map((item) => `- ${item}`)].filter(Boolean).join('\n\n');
    return JSON.stringify(result.content);
  }
  return result.text || result.response || 'No study notes were returned.';
}

function normalizeAiMarkdown(value: string) {
  return value
    .replace(/\r/g, '')
    // Models sometimes return markdown separators as visible content. They are
    // layout hints, not study-note text, so remove them before rendering.
    .replace(/^\s*(?:(?:[-_*—–]\s*){3,}|(?:\.\s*){3,})\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanInlineText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/_+/g, '')
    .replace(/\*+/g, '')
    .trim();
}

function plainAiText(value: string) {
  return normalizeAiMarkdown(value)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-+*•]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
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
  return chunks.flatMap((chunk) => chunk.length <= safeMaximum ? [chunk] : Array.from({ length: Math.ceil(chunk.length / safeMaximum) }, (_, index) => chunk.slice(index * safeMaximum, (index + 1) * safeMaximum)));
}

function InlineMarkdown({ text, color, boldColor }: { text: string; color: string; boldColor: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={[styles.aiParagraph, { color }]}>
      {parts.map((part, index) => part.startsWith('**') && part.endsWith('**')
        ? <Text key={`${index}-${part}`} style={[styles.aiBold, { color: boldColor }]}>{cleanInlineText(part.slice(2, -2))}</Text>
        : <Text key={`${index}-${part}`}>{cleanInlineText(part)}</Text>)}
    </Text>
  );
}

function AiMarkdown({ value }: { value: string }) {
  const { colors } = useTheme();
  const lines = normalizeAiMarkdown(value).split('\n');
  const nodes: React.ReactNode[] = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) { nodes.push(<View key={`space-${index}`} style={styles.aiSpace} />); return; }
    if (/^(?:(?:[-_*—–]\s*){3,}|(?:\.\s*){3,})$/.test(line)) return;

    const heading = line.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      nodes.push(
        <Text key={`h-${index}`} style={[styles.aiHeading, heading[1].length === 1 && styles.aiHeadingLarge, { color: colors.text }]}>
          {cleanInlineText(heading[2])}
        </Text>,
      );
      return;
    }

    const bullet = line.match(/^[-+*•]\s+(.+)$/);
    if (bullet) {
      nodes.push(<View key={`b-${index}`} style={styles.aiBulletRow}><Text style={[styles.aiBullet, { color: colors.interactive }]}>•</Text><View style={styles.aiBulletBody}><InlineMarkdown text={bullet[1]} color={colors.textSecondary} boldColor={colors.text} /></View></View>);
      return;
    }

    const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (ordered) {
      nodes.push(<View key={`o-${index}`} style={styles.aiBulletRow}><Text style={[styles.aiNumber, { color: colors.interactive }]}>{ordered[1]}.</Text><View style={styles.aiBulletBody}><InlineMarkdown text={ordered[2]} color={colors.textSecondary} boldColor={colors.text} /></View></View>);
      return;
    }

    nodes.push(<InlineMarkdown key={`p-${index}`} text={line} color={colors.textSecondary} boldColor={colors.text} />);
  });
  return <View style={styles.aiMarkdown}>{nodes}</View>;
}

export function ProgressiveSermonReader({ sermon, initialBlocks }: Props) {
  const { api, mode } = useSession();
  const { colors } = useTheme();
  const blocks = useMemo(() => initialBlocks?.length ? initialBlocks : parseSermonMarkdown(sermon.transcript || sermon.description), [initialBlocks, sermon.description, sermon.transcript]);
  const [visibleCount, setVisibleCount] = useState(Math.min(3, Math.max(1, blocks.length)));
  const [speechTarget, setSpeechTarget] = useState<SpeechTarget>(null);
  const [speechRate, setSpeechRate] = useReadAloudRate();
  const [copiedSermon, setCopiedSermon] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiError, setAiError] = useState('');
  const speechRun = useRef(0);

  useEffect(() => {
    speechRun.current += 1;
    setSpeechTarget(null);
    void Speech.stop();
    setVisibleCount(Math.min(3, Math.max(1, blocks.length)));
    setAiNotes('');
    setAiError('');
    setCopiedSermon(false);
    setCopiedNotes(false);
  }, [blocks.length, sermon.id]);
  useEffect(() => () => { speechRun.current += 1; void Speech.stop(); }, []);

  const fullText = useMemo(() => sermonBlocksToPlainText(blocks), [blocks]);
  const visibleBlocks = blocks.slice(0, visibleCount);
  const hasMore = visibleCount < blocks.length;
  const speaking = speechTarget === 'sermon';
  const aiSpeaking = speechTarget === 'ai';

  const stopSpeech = async () => {
    speechRun.current += 1;
    setSpeechTarget(null);
    await Speech.stop();
  };

  const speakText = async (target: Exclude<SpeechTarget, null>, value: string) => {
    if (speechTarget === target) { await stopSpeech(); return; }
    const text = value
      .replace(/\bC(?:\s*\.?\s*)O(?:\s*\.?\s*)T\b/gi, 'C O T')
      .trim();
    if (!text) return;

    speechRun.current += 1;
    setSpeechTarget(null);
    await Speech.stop();

    const run = ++speechRun.current;
    const chunks = splitSpeech(text, Speech.maxSpeechInputLength);
    setSpeechTarget(target);
    const finish = () => {
      if (run === speechRun.current) setSpeechTarget(null);
    };
    const speakChunk = (index: number) => {
      if (run !== speechRun.current) return;
      if (index >= chunks.length) { finish(); return; }
      Speech.speak(chunks[index], {
        rate: speechRate,
        onDone: () => speakChunk(index + 1),
        onStopped: finish,
        onError: finish,
      });
    };
    speakChunk(0);
  };

  const readAloud = () => speakText('sermon', fullText);
  const readAiNotes = () => speakText('ai', plainAiText(aiNotes));

  const copySermon = async () => {
    if (!fullText.trim()) return;
    await Clipboard.setStringAsync(fullText);
    setCopiedSermon(true);
    setTimeout(() => setCopiedSermon(false), 1400);
  };

  const copyAiNotes = async () => {
    if (!aiNotes.trim()) return;
    await Clipboard.setStringAsync(plainAiText(aiNotes));
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 1400);
  };

  const askAi = async () => {
    setAiOpen(true);
    if (aiLoading) return;
    if (mode !== 'authenticated') { setAiError('Sign in to use AI study notes for sermons.'); return; }
    if (aiSpeaking) await stopSpeech();
    setAiLoading(true);
    setAiError('');
    try {
      const source = fullText.slice(0, 9500);
      const prompt = [
        `Help me study the published sermon “${sermon.title}”${sermon.preacher ? ` by ${sermon.preacher}` : ''}.`,
        sermon.scripture_references?.length ? `Scriptures: ${sermon.scripture_references.join(', ')}.` : '',
        'Use the full verified sermon notes. Give a short overview, clear subheadings for the main points, practical takeaways, and reflection questions. Do not invent facts beyond the sermon. Return clean Markdown using headings, bullets and bold text only; do not emit decorative separator lines.',
        source ? `Visible sermon notes:\n${source}` : '',
      ].filter(Boolean).join('\n\n');
      const result = await api.request<AiResult>('ai-gateway', {
        method: 'POST',
        timeoutMs: 60_000,
        feedback: false,
        body: JSON.stringify({ capability: 'assistant.answer', prompt, entityType: 'sermon', entityId: sermon.id }),
      });
      setAiNotes(resultText(result));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI study notes are unavailable right now.');
    } finally { setAiLoading(false); }
  };

  if (!blocks.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}><View style={styles.flex}><Text style={[styles.eyebrow, { color: colors.interactive }]}>PROGRESSIVE READING</Text><Text style={[styles.title, { color: colors.text }]}>Sermon notes</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Read a few sections at a time, listen aloud, copy the text, or open the AI study helper.</Text></View></View>

      <View style={[styles.tools, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <Pressable onPress={() => void readAloud()} style={[styles.toolButton, { backgroundColor: speaking ? colors.primarySoft : colors.bgSecondary }]} accessibilityRole="button"><Icon name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={18} color={colors.interactive} /><Text style={[styles.toolText, { color: colors.text }]}>{speaking ? 'Stop reading' : 'Read aloud'}</Text></Pressable>
        <Pressable onPress={() => void copySermon()} style={[styles.toolButton, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel="Copy sermon notes"><Icon name={copiedSermon ? 'checkmark-outline' : 'copy-outline'} size={18} color={colors.interactive} /><Text style={[styles.toolText, { color: colors.text }]}>{copiedSermon ? 'Copied' : 'Copy sermon'}</Text></Pressable>
        <Pressable onPress={() => void askAi()} style={[styles.toolButton, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button"><Icon name="sparkles-outline" size={18} color={colors.interactive} /><Text style={[styles.toolText, { color: colors.text }]}>AI study helper</Text></Pressable>
      </View>

      <ReadAloudRateControl value={speechRate} onChange={setSpeechRate} compact />

      <View style={styles.blocks}>{visibleBlocks.map((block, index) => block.type === 'highlight' ? (
        <View key={block.id} style={[styles.highlight, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}><View style={[styles.highlightIcon, { backgroundColor: colors.card }]}><Text style={[styles.boldGlyph, { color: colors.interactive }]}>B</Text></View><View style={styles.flex}><Text style={[styles.highlightText, { color: colors.text }]}>{block.text}</Text><ScripturePreviewCard text={block.text} compact /></View></View>
      ) : (
        <View key={block.id} style={[styles.paragraphCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.progressLabel, { color: colors.textMuted }]}>PART {index + 1}</Text><Text style={[styles.paragraphText, { color: colors.text }]}>{block.text}</Text><ScripturePreviewCard text={block.text} compact /></View>
      ))}</View>

      {hasMore ? <View style={[styles.continueCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.continueText, { color: colors.textSecondary }]}>{blocks.length - visibleCount} more section{blocks.length - visibleCount === 1 ? '' : 's'} in this sermon</Text><View style={styles.continueActions}><Button label="Continue reading" onPress={() => setVisibleCount((count) => Math.min(blocks.length, count + 3))} size="sm" /><Button label="Show all" onPress={() => setVisibleCount(blocks.length)} variant="outline" size="sm" /></View></View> : visibleCount > 3 ? <Button label="Collapse sermon" onPress={() => setVisibleCount(Math.min(3, blocks.length))} variant="outline" size="sm" /> : null}

      <BottomSheet visible={aiOpen} onClose={() => setAiOpen(false)} title="AI study helper" subtitle={sermon.title} maxHeightPercent={92}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.aiSheet}>
          <View style={[styles.aiSourceNotice, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}><Icon name="book-outline" size={18} color={colors.interactive} /><Text style={[styles.aiSourceText, { color: colors.textSecondary }]}>The helper is grounded in this sermon’s saved full notes. The published sermon remains the source of truth.</Text></View>
          {aiLoading ? <Skeleton height={20} count={7} /> : aiError ? <View style={[styles.aiError, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="information-circle-outline" size={16} color={colors.textMuted} /><Text style={[styles.aiErrorText, { color: colors.textSecondary }]}>{aiError}</Text></View> : aiNotes ? <><AiMarkdown value={aiNotes} /><View style={styles.notesActions}><Pressable onPress={() => void readAiNotes()} style={[styles.notesAction, { backgroundColor: aiSpeaking ? colors.primarySoft : colors.bgSecondary, borderColor: aiSpeaking ? colors.primarySoftStrong : colors.borderSubtle }]} accessibilityRole="button"><Icon name={aiSpeaking ? 'stop-circle-outline' : 'volume-high-outline'} size={15} color={colors.interactive} /><Text style={[styles.notesActionText, { color: colors.textSecondary }]}>{aiSpeaking ? 'Stop reading' : 'Read AI notes aloud'}</Text></Pressable><Pressable onPress={() => void copyAiNotes()} style={[styles.notesAction, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]} accessibilityRole="button"><Icon name={copiedNotes ? 'checkmark-outline' : 'copy-outline'} size={15} color={colors.interactive} /><Text style={[styles.notesActionText, { color: colors.textSecondary }]}>{copiedNotes ? 'Copied study notes' : 'Copy study notes'}</Text></Pressable></View></> : null}
          {!aiLoading ? <Button label={aiNotes ? 'Refresh study notes' : 'Generate study notes'} onPress={() => void askAi()} variant={aiNotes ? 'outline' : 'primary'} fullWidth /> : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md }, headingRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }, flex: { flex: 1, minWidth: 0 }, eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 2 }, subtitle: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm }, toolButton: { minHeight: 42, flex: 1, minWidth: 138, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, toolText: { fontSize: 11.5, fontWeight: '800' },
  blocks: { gap: spacing.sm }, paragraphCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.xs }, progressLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 }, paragraphText: { fontSize: 15, lineHeight: 24 },
  highlight: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, highlightIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, boldGlyph: { fontSize: 16, fontWeight: '900' }, highlightText: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '900' },
  continueCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, continueText: { fontSize: 11.5, lineHeight: 17 }, continueActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  aiSheet: { gap: spacing.md, paddingBottom: spacing.xl }, aiSourceNotice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, aiSourceText: { flex: 1, fontSize: 11.5, lineHeight: 17 }, aiMarkdown: { gap: 4 }, aiSpace: { height: 5 }, aiHeading: { fontSize: 15, lineHeight: 21, fontWeight: '900', marginTop: spacing.sm }, aiHeadingLarge: { fontSize: 18, lineHeight: 24 }, aiParagraph: { fontSize: 13.5, lineHeight: 21 }, aiBold: { fontWeight: '900' }, aiBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, aiBullet: { fontSize: 17, lineHeight: 21, fontWeight: '900' }, aiNumber: { minWidth: 22, fontSize: 12.5, lineHeight: 21, fontWeight: '900', textAlign: 'right' }, aiBulletBody: { flex: 1 },
  aiError: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, aiErrorText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  notesActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, notesAction: { minHeight: 38, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 }, notesActionText: { fontSize: 10.5, fontWeight: '800' },
});
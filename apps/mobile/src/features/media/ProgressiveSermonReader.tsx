import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Button, Chip, Icon, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';
import { parseSermonMarkdown, sermonBlocksToPlainText, type SermonRichBlock } from './sermon-rich-content';

type AiResult = { content?: unknown; text?: string; response?: string };

type Props = {
  sermon: Sermon;
  initialBlocks?: SermonRichBlock[];
};

function resultText(result: AiResult) {
  if (typeof result.content === 'string') return result.content;
  if (result.content && typeof result.content === 'object') {
    const object = result.content as Record<string, unknown>;
    const summary = typeof object.summary === 'string' ? object.summary : '';
    const takeaways = Array.isArray(object.takeaways) ? object.takeaways.map(String).filter(Boolean) : [];
    if (summary || takeaways.length) return [summary, ...takeaways.map((item) => `• ${item}`)].filter(Boolean).join('\n\n');
    return JSON.stringify(result.content);
  }
  return result.text || result.response || 'No study notes were returned.';
}

function splitSpeech(text: string, maximum: number) {
  const safeMaximum = Math.max(500, Math.min(maximum || 3000, 3500));
  const paragraphs = text.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (`${current}\n${paragraph}`.length <= safeMaximum) {
      current = `${current}\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= safeMaximum) return [chunk];
    const parts: string[] = [];
    for (let index = 0; index < chunk.length; index += safeMaximum) parts.push(chunk.slice(index, index + safeMaximum));
    return parts;
  });
}

export function ProgressiveSermonReader({ sermon, initialBlocks }: Props) {
  const { api, mode } = useSession();
  const { colors } = useTheme();
  const blocks = useMemo(
    () => initialBlocks?.length ? initialBlocks : parseSermonMarkdown(sermon.transcript || sermon.description),
    [initialBlocks, sermon.description, sermon.transcript],
  );
  const [visibleCount, setVisibleCount] = useState(Math.min(3, Math.max(1, blocks.length)));
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiError, setAiError] = useState('');
  const speechRun = useRef(0);

  useEffect(() => {
    setVisibleCount(Math.min(3, Math.max(1, blocks.length)));
  }, [blocks.length, sermon.id]);

  useEffect(() => () => {
    speechRun.current += 1;
    void Speech.stop();
  }, []);

  const fullText = useMemo(() => sermonBlocksToPlainText(blocks), [blocks]);
  const visibleBlocks = blocks.slice(0, visibleCount);
  const hasMore = visibleCount < blocks.length;

  const stopSpeech = async () => {
    speechRun.current += 1;
    setSpeaking(false);
    await Speech.stop();
  };

  const readAloud = async () => {
    if (speaking) {
      await stopSpeech();
      return;
    }
    if (!fullText.trim()) return;
    await Speech.stop();
    const run = ++speechRun.current;
    const chunks = splitSpeech(fullText, Speech.maxSpeechInputLength);
    setSpeaking(true);

    const speakChunk = (index: number) => {
      if (run !== speechRun.current) return;
      if (index >= chunks.length) {
        setSpeaking(false);
        return;
      }
      Speech.speak(chunks[index], {
        rate: speechRate,
        onDone: () => speakChunk(index + 1),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    };
    speakChunk(0);
  };

  const askAi = async () => {
    if (mode !== 'authenticated') {
      setAiError('Sign in to use AI study notes for sermons.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const source = fullText.slice(0, 8500);
      const prompt = [
        `Help me understand the sermon “${sermon.title}” by ${sermon.preacher}.`,
        sermon.scripture_references?.length ? `Scriptures: ${sermon.scripture_references.join(', ')}.` : '',
        'Give a concise explanation, the most important points, practical takeaways, and any key questions I should reflect on. Do not invent facts beyond the sermon text.',
        `Sermon text:\n${source}`,
      ].filter(Boolean).join('\n\n');
      const result = await api.request<AiResult>('ai-gateway', {
        method: 'POST',
        body: JSON.stringify({ capability: 'assistant.answer', prompt, entityType: 'sermon', entityId: sermon.id }),
      });
      setAiNotes(resultText(result));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI study notes are unavailable right now.');
    } finally {
      setAiLoading(false);
    }
  };

  if (!blocks.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.interactive }]}>PROGRESSIVE READING</Text>
          <Text style={[styles.title, { color: colors.text }]}>Sermon notes</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Read a few sections at a time, listen aloud, or ask the COT assistant for the key ideas.</Text>
        </View>
      </View>

      <View style={[styles.tools, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <Pressable onPress={() => void readAloud()} style={[styles.toolButton, { backgroundColor: speaking ? colors.primarySoft : colors.bgSecondary }]}>
          <Icon name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={18} color={colors.interactive} />
          <Text style={[styles.toolText, { color: colors.text }]}>{speaking ? 'Stop reading' : 'Read aloud'}</Text>
        </Pressable>
        <Pressable onPress={() => void askAi()} disabled={aiLoading} style={[styles.toolButton, { backgroundColor: colors.bgSecondary }]}>
          <Icon name="sparkles-outline" size={18} color={colors.interactive} />
          <Text style={[styles.toolText, { color: colors.text }]}>{aiLoading ? 'Thinking…' : 'AI key notes'}</Text>
        </Pressable>
      </View>

      <View style={styles.speedRow}>
        <Text style={[styles.speedLabel, { color: colors.textMuted }]}>Read speed</Text>
        {[0.85, 1, 1.15].map((rate) => (
          <Chip key={rate} label={`${rate}×`} selected={speechRate === rate} onPress={() => setSpeechRate(rate)} />
        ))}
      </View>

      <View style={styles.blocks}>
        {visibleBlocks.map((block, index) => block.type === 'highlight' ? (
          <View key={block.id} style={[styles.highlight, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}>
            <View style={[styles.highlightIcon, { backgroundColor: colors.card }]}>
              <Text style={[styles.boldGlyph, { color: colors.interactive }]}>B</Text>
            </View>
            <Text style={[styles.highlightText, { color: colors.text }]}>{block.text}</Text>
          </View>
        ) : (
          <View key={block.id} style={[styles.paragraphCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>PART {index + 1}</Text>
            <Text style={[styles.paragraphText, { color: colors.text }]}>{block.text}</Text>
          </View>
        ))}
      </View>

      {hasMore ? (
        <View style={[styles.continueCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.continueText, { color: colors.textSecondary }]}>{blocks.length - visibleCount} more section{blocks.length - visibleCount === 1 ? '' : 's'} in this sermon</Text>
          <View style={styles.continueActions}>
            <Button label="Continue reading" onPress={() => setVisibleCount((count) => Math.min(blocks.length, count + 3))} size="sm" />
            <Button label="Show all" onPress={() => setVisibleCount(blocks.length)} variant="outline" size="sm" />
          </View>
        </View>
      ) : visibleCount > 3 ? (
        <Button label="Collapse sermon" onPress={() => setVisibleCount(Math.min(3, blocks.length))} variant="outline" size="sm" />
      ) : null}

      {aiLoading ? (
        <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Skeleton height={18} count={4} /></View>
      ) : aiNotes ? (
        <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.aiTitleRow}>
            <Icon name="sparkles" size={18} color={colors.interactive} />
            <Text style={[styles.aiTitle, { color: colors.text }]}>AI study helper</Text>
          </View>
          <Text style={[styles.aiText, { color: colors.textSecondary }]}>{aiNotes}</Text>
          <Text style={[styles.aiHint, { color: colors.textMuted }]}>AI can help explain the sermon, but the published sermon remains the source of truth.</Text>
        </View>
      ) : aiError ? (
        <View style={[styles.aiError, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.aiErrorText, { color: colors.textSecondary }]}>{aiError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  headingRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 2 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm },
  toolButton: { minHeight: 42, flex: 1, minWidth: 138, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  toolText: { fontSize: 11.5, fontWeight: '800' },
  speedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  speedLabel: { fontSize: 10.5, fontWeight: '700', marginRight: 3 },
  blocks: { gap: spacing.sm },
  paragraphCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.xs },
  progressLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  paragraphText: { fontSize: 15, lineHeight: 24 },
  highlight: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  highlightIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  boldGlyph: { fontSize: 16, fontWeight: '900' },
  highlightText: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '900' },
  continueCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  continueText: { fontSize: 11.5, lineHeight: 17 },
  continueActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  aiCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiTitle: { fontSize: 14, fontWeight: '900' },
  aiText: { fontSize: 13.5, lineHeight: 21 },
  aiHint: { fontSize: 10.5, lineHeight: 16 },
  aiError: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  aiErrorText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
});

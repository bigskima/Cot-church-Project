import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, ScreenHeader } from '@/components';
import { ReadAloudRateControl, useReadAloudRate } from '@/components/ReadAloudRateControl';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { COT_DOCUMENTARY, COT_DOCUMENTARY_SPEECH_TEXT } from '@/content/cot-documentary';
import { useTheme } from '@/state/theme';

function speechText(value: string) {
  return value
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

function chapterSpeech(chapter: (typeof COT_DOCUMENTARY.chapters)[number]) {
  return [
    chapter.title,
    ...chapter.paragraphs,
    ...chapter.sections.flatMap((section) => [section.title, ...section.paragraphs]),
  ].join('\n\n');
}

export default function AboutCotDocumentaryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [speechRate, setSpeechRate] = useReadAloudRate();
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const speechRun = useRef(0);

  useEffect(() => () => {
    speechRun.current += 1;
    void Speech.stop();
  }, []);

  const totalSections = useMemo(
    () => COT_DOCUMENTARY.chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0),
    [],
  );

  const stopSpeech = async () => {
    speechRun.current += 1;
    setSpeakingKey(null);
    await Speech.stop();
  };

  const readText = async (key: string, value: string) => {
    if (speakingKey === key) {
      await stopSpeech();
      return;
    }
    await Speech.stop();
    const run = ++speechRun.current;
    const chunks = splitSpeech(speechText(value), Speech.maxSpeechInputLength);
    setSpeakingKey(key);

    const speakChunk = (index: number) => {
      if (run !== speechRun.current) return;
      if (index >= chunks.length) {
        setSpeakingKey(null);
        return;
      }
      Speech.speak(chunks[index], {
        rate: speechRate,
        onDone: () => speakChunk(index + 1),
        onStopped: () => setSpeakingKey(null),
        onError: () => setSpeakingKey(null),
      });
    };
    speakChunk(0);
  };

  const toggleChapter = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const allExpanded = expanded.size === COT_DOCUMENTARY.chapters.length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 },
        ]}
      >
        <ScreenHeader
          title="About the COT App"
          kicker="VISION & APP STORY"
          subtitle="How the COT App supports City of Transformation, and the people behind it."
          showBack
        />

        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <View style={[styles.heroMark, { backgroundColor: colors.primarySoft }]}>
            <Icon name="sparkles-outline" size={30} color={colors.interactive} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{COT_DOCUMENTARY.title}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{COT_DOCUMENTARY.subtitle}</Text>
          {COT_DOCUMENTARY.intro.map((paragraph, index) => (
            <Text key={index} selectable style={[styles.heroBody, { color: colors.textSecondary }]}>
              {paragraph}
            </Text>
          ))}
          <View style={styles.metaRow}>
            <View style={[styles.metaPill, { backgroundColor: colors.bgSecondary }]}>
              <Icon name="reader-outline" size={14} color={colors.interactive} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{COT_DOCUMENTARY.chapters.length} chapters</Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: colors.bgSecondary }]}>
              <Icon name="layers-outline" size={14} color={colors.interactive} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{totalSections} focused topics</Text>
            </View>
          </View>
        </View>

        <View style={[styles.peopleCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.personBlock}>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>BUILDER</Text>
            <Text style={[styles.personName, { color: colors.text }]}>{COT_DOCUMENTARY.builder}</Text>
          </View>
          <View style={[styles.peopleDivider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.personBlock}>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>CONTRIBUTORS</Text>
            {COT_DOCUMENTARY.contributors.map((name) => (
              <Text key={name} style={[styles.contributorName, { color: colors.text }]}>{name}</Text>
            ))}
          </View>
        </View>

        <View style={[styles.listenCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.listenHeading}>
            <View style={[styles.listenIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="volume-high-outline" size={20} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.listenTitle, { color: colors.text }]}>Listen to the documentary</Text>
              <Text style={[styles.listenCopy, { color: colors.textMuted }]}>
                The COT App can read the full documentary aloud. You can also listen to one chapter at a time.
              </Text>
            </View>
          </View>
          <ReadAloudRateControl value={speechRate} onChange={setSpeechRate} compact />
          <Button
            label={speakingKey === 'all' ? 'Stop reading' : 'Read full documentary aloud'}
            variant={speakingKey === 'all' ? 'outline' : 'primary'}
            onPress={() => void readText('all', COT_DOCUMENTARY_SPEECH_TEXT)}
          />
        </View>

        <View style={styles.chapterHeading}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>DOCUMENTARY</Text>
            <Text style={[styles.chapterHeadingTitle, { color: colors.text }]}>Explore the story</Text>
          </View>
          <Pressable
            onPress={() => setExpanded(allExpanded ? new Set() : new Set(COT_DOCUMENTARY.chapters.map((_, index) => index)))}
            style={({ pressed }) => [styles.expandControl, { backgroundColor: colors.bgSecondary }, pressed && styles.pressed]}
          >
            <Text style={[styles.expandControlText, { color: colors.interactive }]}>{allExpanded ? 'Collapse all' : 'Expand all'}</Text>
          </Pressable>
        </View>

        <View style={styles.chapterList}>
          {COT_DOCUMENTARY.chapters.map((chapter, chapterIndex) => {
            const isExpanded = expanded.has(chapterIndex);
            const speechKey = `chapter-${chapterIndex}`;
            return (
              <View
                key={chapter.title}
                style={[styles.chapterCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}
              >
                <Pressable
                  onPress={() => toggleChapter(chapterIndex)}
                  accessibilityRole="button"
                  accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${chapter.title}`}
                  style={({ pressed }) => [styles.chapterTop, pressed && styles.pressed]}
                >
                  <View style={[styles.chapterNumber, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.chapterNumberText, { color: colors.interactive }]}>{chapterIndex + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.chapterTitle, { color: colors.text }]}>{chapter.title.replace(/^\d+\.\s*/, '')}</Text>
                    <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                      {chapter.sections.length ? `${chapter.sections.length} topics` : 'Chapter'}
                    </Text>
                  </View>
                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={19} color={colors.textMuted} />
                </Pressable>

                {isExpanded ? (
                  <View style={[styles.chapterBody, { borderTopColor: colors.borderSubtle }]}>
                    <Pressable
                      onPress={() => void readText(speechKey, chapterSpeech(chapter))}
                      style={({ pressed }) => [
                        styles.chapterListen,
                        { backgroundColor: speakingKey === speechKey ? colors.primarySoft : colors.bgSecondary },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name={speakingKey === speechKey ? 'stop-circle-outline' : 'volume-high-outline'}
                        size={16}
                        color={colors.interactive}
                      />
                      <Text style={[styles.chapterListenText, { color: colors.interactive }]}>
                        {speakingKey === speechKey ? 'Stop chapter' : 'Read chapter aloud'}
                      </Text>
                    </Pressable>

                    {chapter.paragraphs.map((paragraph, index) => (
                      <Text key={`p-${index}`} selectable style={[styles.bodyText, { color: colors.textSecondary }]}>
                        {paragraph}
                      </Text>
                    ))}

                    {chapter.sections.map((section) => (
                      <View key={section.title} style={styles.subsection}>
                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>{section.title}</Text>
                        {section.paragraphs.map((paragraph, index) => (
                          <Text key={`${section.title}-${index}`} selectable style={[styles.bodyText, { color: colors.textSecondary }]}>
                            {paragraph}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={[styles.closingCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
          <Icon name="home-outline" size={24} color={colors.interactive} />
          <Text style={[styles.closingTitle, { color: colors.text }]}>One connected digital home for church life.</Text>
          <Text style={[styles.closingText, { color: colors.textSecondary }]}>
            The COT App supports people as they belong, participate, grow, serve, communicate and lead in City of Transformation.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.lg },
  hero: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.sm },
  heroMark: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  heroTitle: { ...typography.h2, fontSize: 22, lineHeight: 28 },
  heroSubtitle: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  heroBody: { fontSize: 12.5, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  metaPill: { minHeight: 32, paddingHorizontal: 10, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 10.5, fontWeight: '800' },
  peopleCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  personBlock: { gap: 4 },
  peopleDivider: { height: StyleSheet.hairlineWidth },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 },
  personName: { fontSize: 17, fontWeight: '900' },
  contributorName: { fontSize: 13.5, fontWeight: '800', lineHeight: 20 },
  listenCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  listenHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listenIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  listenTitle: { fontSize: 14, fontWeight: '900' },
  listenCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  flex: { flex: 1, minWidth: 0 },
  chapterHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  chapterHeadingTitle: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  expandControl: { minHeight: 34, borderRadius: radius.pill, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  expandControlText: { fontSize: 10.5, fontWeight: '900' },
  chapterList: { gap: spacing.sm },
  chapterCard: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  chapterTop: { minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chapterNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chapterNumberText: { fontSize: 13, fontWeight: '900' },
  chapterTitle: { fontSize: 13.5, fontWeight: '900', lineHeight: 18 },
  chapterMeta: { fontSize: 9.5, fontWeight: '700', marginTop: 3 },
  chapterBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  chapterListen: { alignSelf: 'flex-start', minHeight: 34, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterListenText: { fontSize: 10.5, fontWeight: '900' },
  bodyText: { fontSize: 12.5, lineHeight: 20 },
  subsection: { gap: spacing.xs, marginTop: spacing.sm },
  subsectionTitle: { fontSize: 14.5, fontWeight: '900', lineHeight: 20 },
  closingCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  closingTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  closingText: { fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: 0.78 },
});

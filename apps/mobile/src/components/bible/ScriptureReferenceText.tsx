import React, { useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { BottomSheet } from '../BottomSheet';
import { Icon } from '../primitives/Icon';
import { Skeleton } from '../states';

const BOOK_PATTERN = '(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1\\s*Samuel|2\\s*Samuel|1\\s*Kings|2\\s*Kings|1\\s*Chronicles|2\\s*Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song\\s+of\\s+Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1\\s*Corinthians|2\\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|1\\s*Thessalonians|2\\s*Thessalonians|1\\s*Timothy|2\\s*Timothy|Titus|Philemon|Hebrews|James|1\\s*Peter|2\\s*Peter|1\\s*John|2\\s*John|3\\s*John|Jude|Revelation)';
const REFERENCE_RE = new RegExp(`\\b(${BOOK_PATTERN})\\s+(\\d{1,3})(?:\\s*(?::|v(?:s\\.?|erse(?:s)?)?\\.?)\\s*(\\d{1,3})(?:\\s*[–—-]\\s*(\\d{1,3}))?)?`, 'gi');

export type ScriptureReferenceMatch = { reference: string; start: number; end: number };

export function detectScriptureReferences(value: string, limit = 6): ScriptureReferenceMatch[] {
  if (!value?.trim()) return [];
  const matches: ScriptureReferenceMatch[] = [];
  const seen = new Set<string>();
  REFERENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REFERENCE_RE.exec(value)) && matches.length < limit) {
    const book = match[1].replace(/\s+/g, ' ').trim();
    const chapter = match[2];
    const verseStart = match[3];
    const verseEnd = match[4];
    const reference = verseStart
      ? book + ' ' + chapter + ':' + verseStart + (verseEnd ? '-' + verseEnd : '')
      : book + ' ' + chapter;
    const key = reference.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ reference, start: match.index, end: match.index + match[0].length });
    }
  }
  return matches;
}

type Passage = {
  reference: string;
  versionId: string;
  abbreviation?: string;
  versionName?: string;
  copyright?: string | null;
  text: string;
  verses?: Array<{ verse?: number; text?: string }>;
};

export function ScriptureReferenceText({
  text,
  style,
  numberOfLines,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const matches = useMemo(() => detectScriptureReferences(text), [text]);
  const [selected, setSelected] = useState<string | null>(null);
  if (!matches.length) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;

  const children: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) children.push(text.slice(cursor, match.start));
    children.push(
      <Text
        key={`${match.reference}-${index}`}
        onPress={() => setSelected(match.reference)}
        accessibilityRole="link"
        accessibilityLabel={`Preview ${match.reference}`}
        style={{ color: colors.interactive, fontWeight: '800', textDecorationLine: 'underline' }}
      >
        {text.slice(match.start, match.end)}
      </Text>,
    );
    cursor = match.end;
  });
  if (cursor < text.length) children.push(text.slice(cursor));

  return (
    <>
      <Text style={style} numberOfLines={numberOfLines}>{children}</Text>
      <ScripturePreviewSheet reference={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export function ScripturePreviewCard({
  text,
  compact = false,
  tone = 'default',
}: {
  text: string;
  compact?: boolean;
  tone?: 'default' | 'accent';
}) {
  const matches = useMemo(() => detectScriptureReferences(text, 1), [text]);
  const first = matches[0]?.reference ?? null;
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const accent = tone === 'accent';
  if (!first) return null;
  return (
    <>
      <Pressable
        onPress={(event) => { event.stopPropagation?.(); setOpen(true); }}
        style={({ pressed }) => [
          styles.previewButton,
          compact && styles.previewButtonCompact,
          {
            backgroundColor: accent ? 'rgba(4, 16, 29, 0.24)' : colors.primarySoft,
            borderColor: accent ? 'rgba(255,255,255,0.24)' : colors.borderSubtle,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[styles.previewIcon, { backgroundColor: accent ? 'rgba(4,16,29,0.48)' : colors.card }]}>
          <Icon name="book-outline" size={16} color={accent ? '#FFFFFF' : colors.interactive} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={[styles.previewKicker, { color: accent ? 'rgba(255,255,255,0.76)' : colors.interactive }]}>SCRIPTURE REFERENCE</Text>
          <Text style={[styles.previewReference, { color: accent ? '#FFFFFF' : colors.text }]} numberOfLines={1}>{first}</Text>
          <Text style={[styles.previewHint, { color: accent ? 'rgba(255,255,255,0.68)' : colors.textMuted }]} numberOfLines={1}>
            {/\:\d/.test(first) ? 'Preview this exact passage' : 'Preview this chapter'}
          </Text>
        </View>
        <Text style={[styles.previewAction, { color: accent ? '#FFFFFF' : colors.interactive }]}>Open</Text>
        <Icon name="chevron-forward" size={15} color={accent ? '#FFFFFF' : colors.interactive} />
      </Pressable>
      <ScripturePreviewSheet reference={open ? first : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function ScripturePreviewSheet({ reference, onClose }: { reference: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  const { api } = useSession();
  const resource = useResource<Passage | null>(
    reference ? `scripture-preview:public:kjv:${reference}` : 'scripture-preview:none',
    async (signal) => {
      if (!reference) return null;
      const params = new URLSearchParams({ action: 'preview', reference, versionId: 'kjv' });
      return api.request<Passage>(`noop?service=bible&${params.toString()}`, { signal, context: 'public' });
    },
  );

  const exactVerseRequest = Boolean(reference && /:\d/.test(reference));
  const previewVerses = resource.data?.verses?.length
    ? (exactVerseRequest ? resource.data.verses : resource.data.verses.slice(0, 2))
    : [];
  const previewLabel = exactVerseRequest
    ? 'Exact passage'
    : previewVerses.length
      ? 'Chapter preview · verses ' + (previewVerses[0]?.verse ?? 1) + (previewVerses.length > 1 ? '–' + (previewVerses[previewVerses.length - 1]?.verse ?? 2) : '')
      : 'Bible preview';

  return (
    <BottomSheet visible={Boolean(reference)} onClose={onClose} title={reference || 'Scripture'} subtitle={previewLabel} compact maxHeightPercent={68}>
      <View style={styles.sheet}>
        {resource.loading && !resource.data ? (
          <><Skeleton height={24} width="48%" /><Skeleton height={92} /></>
        ) : resource.error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.bgSecondary }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{resource.error}</Text>
          </View>
        ) : resource.data ? (
          <>
            <View style={styles.sheetHeading}>
              <View>
                <Text style={[styles.sheetReference, { color: colors.text }]}>{resource.data.reference}</Text>
                <Text style={[styles.sheetVersion, { color: colors.textMuted }]}>
                  {resource.data.abbreviation || resource.data.versionName || 'KJV'}
                </Text>
              </View>
              <Icon name="book-outline" size={20} color={colors.interactive} />
            </View>
            <View style={[styles.exactBadge, { backgroundColor: colors.primarySoft }]}>
              <Icon name={exactVerseRequest ? 'locate-outline' : 'book-outline'} size={13} color={colors.interactive} />
              <Text style={[styles.exactBadgeText, { color: colors.interactive }]}>
                {exactVerseRequest ? 'Showing the exact reference requested' : 'Showing a short chapter preview'}
              </Text>
            </View>
            {previewVerses.length ? (
              <View style={styles.previewVerses}>
                {previewVerses.map((verse, index) => (
                  <View key={verse.verse ?? index} style={styles.previewVerseRow}>
                    <Text style={[styles.previewVerseNumber, { color: colors.interactive }]}>{verse.verse ?? index + 1}</Text>
                    <Text style={[styles.sheetText, { color: colors.text }]}>{verse.text}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.sheetText, { color: colors.text }]} numberOfLines={exactVerseRequest ? 8 : 5}>{resource.data.text}</Text>
            )}
            {!exactVerseRequest && resource.data.verses && resource.data.verses.length > previewVerses.length ? (
              <Text style={[styles.moreContext, { color: colors.textMuted }]}>
                Open the Bible to continue the full chapter.
              </Text>
            ) : null}
            {resource.data.copyright ? <Text style={[styles.copyright, { color: colors.textMuted }]}>{resource.data.copyright}</Text> : null}
            <Pressable
              onPress={() => { onClose(); router.push({ pathname: '/general/bible', params: { reference: resource.data!.reference } } as any); }}
              style={[styles.openBible, { backgroundColor: colors.interactive }]}
            >
              <Icon name="book-outline" size={17} color="#fff" />
              <Text style={styles.openBibleText}>Open in Bible</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  previewButton: { marginTop: spacing.sm, minHeight: 58, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 9 },
  previewButtonCompact: { width: '100%', minHeight: 48, minWidth: 0, maxWidth: '100%', marginTop: 7, paddingHorizontal: 8, gap: 7, borderRadius: 12 },
  previewIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  previewReference: { fontSize: 12.5, lineHeight: 17, fontWeight: '900', marginTop: 1 },
  previewHint: { fontSize: 8.5, lineHeight: 12, marginTop: 1 },
  previewAction: { fontSize: 10, fontWeight: '900' },
  sheet: { gap: spacing.md },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetReference: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  sheetVersion: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  exactBadge: { alignSelf: 'flex-start', minHeight: 28, borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  exactBadgeText: { fontSize: 8.5, fontWeight: '900' },
  previewVerses: { gap: 12 },
  previewVerseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  previewVerseNumber: { width: 24, paddingTop: 3, fontSize: 10, lineHeight: 17, textAlign: 'right', fontWeight: '900' },
  sheetText: { flex: 1, fontSize: 15.5, lineHeight: 25 },
  moreContext: { fontSize: 9.5, lineHeight: 14 },
  copyright: { fontSize: 9.5, lineHeight: 14 },
  openBible: { minHeight: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  openBibleText: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  errorCard: { minHeight: 70, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
});

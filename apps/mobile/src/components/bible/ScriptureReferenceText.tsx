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
const REFERENCE_RE = new RegExp(`\\b(${BOOK_PATTERN})\\s+(\\d{1,3})(?::(\\d{1,3})(?:[–—-](\\d{1,3}))?)?`, 'gi');

export type ScriptureReferenceMatch = { reference: string; start: number; end: number };

export function detectScriptureReferences(value: string, limit = 6): ScriptureReferenceMatch[] {
  if (!value?.trim()) return [];
  const matches: ScriptureReferenceMatch[] = [];
  const seen = new Set<string>();
  REFERENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REFERENCE_RE.exec(value)) && matches.length < limit) {
    const reference = match[0].replace(/\s+/g, ' ').replace(/[–—]/g, '-').trim();
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
}: {
  text: string;
  compact?: boolean;
}) {
  const matches = useMemo(() => detectScriptureReferences(text, 1), [text]);
  const first = matches[0]?.reference ?? null;
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  if (!first) return null;
  return (
    <>
      <Pressable
        onPress={(event) => { event.stopPropagation?.(); setOpen(true); }}
        style={({ pressed }) => [
          styles.previewButton,
          compact && styles.previewButtonCompact,
          { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[styles.previewIcon, { backgroundColor: colors.card }]}>
          <Icon name="book-outline" size={16} color={colors.interactive} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={[styles.previewKicker, { color: colors.interactive }]}>SCRIPTURE</Text>
          <Text style={[styles.previewReference, { color: colors.text }]} numberOfLines={1}>{first}</Text>
        </View>
        <Text style={[styles.previewAction, { color: colors.interactive }]}>Preview</Text>
        <Icon name="chevron-forward" size={15} color={colors.interactive} />
      </Pressable>
      <ScripturePreviewSheet reference={open ? first : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function ScripturePreviewSheet({ reference, onClose }: { reference: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  const { api, context } = useSession();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const resource = useResource<Passage | null>(
    reference ? `scripture-preview:${organizationId || 'auto'}:${reference}` : 'scripture-preview:none',
    async (signal) => {
      if (!reference) return null;
      const params = new URLSearchParams({ action: 'preview', reference });
      if (organizationId) params.set('organizationId', organizationId);
      return api.request<Passage>(`noop?service=bible&${params.toString()}`, { signal, context: 'public' });
    },
  );

  return (
    <BottomSheet visible={Boolean(reference)} onClose={onClose} title={reference || 'Scripture'} subtitle="Bible preview" compact maxHeightPercent={72}>
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
                  {resource.data.abbreviation || resource.data.versionName || 'WEB'}
                </Text>
              </View>
              <Icon name="book-outline" size={20} color={colors.interactive} />
            </View>
            <Text style={[styles.sheetText, { color: colors.text }]}>{resource.data.text}</Text>
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
  previewButtonCompact: { minHeight: 50 },
  previewIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  previewReference: { fontSize: 12.5, lineHeight: 17, fontWeight: '900', marginTop: 2 },
  previewAction: { fontSize: 10, fontWeight: '900' },
  sheet: { gap: spacing.md },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetReference: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  sheetVersion: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  sheetText: { fontSize: 16, lineHeight: 27 },
  copyright: { fontSize: 9.5, lineHeight: 14 },
  openBible: { minHeight: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  openBibleText: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  errorCard: { minHeight: 70, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
});

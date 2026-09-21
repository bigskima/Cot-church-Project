import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useGeneralMinistryAccess } from '@/features/general/useGeneralMinistryAccess';

type DailyQuote = {
  id?: string;
  body: string;
  sourceReference?: string | null;
  theme?: string | null;
  source: 'automatic' | 'ministry' | 'provisioned';
  status: 'published' | 'hidden';
  isOverride: boolean;
};

type BibleDaily = {
  reference: string;
  version_id: string;
  theme: string;
  source: string;
  message?: string | null;
};

type DayRow = {
  date: string;
  bible: BibleDaily;
  automaticQuote: DailyQuote;
  quote: DailyQuote;
};

type HighlightsPayload = {
  fromDate: string;
  days: DayRow[];
};

type Version = {
  id: string;
  abbreviation?: string;
  title?: string;
  localized_title?: string;
};

type EditorTab = 'quote' | 'bible';

function middayDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), day || 1, 12, 0, 0, 0);
}

function today() {
  return formatDateOnly(new Date());
}

function readableDate(value: string) {
  const date = middayDate(value);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function DailyHighlightsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [fromDate, setFromDate] = useState(today());
  const [rangeDays, setRangeDays] = useState(30);
  const [replaceProvisioned, setReplaceProvisioned] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('quote');
  const [selected, setSelected] = useState<DayRow | null>(null);

  const [quoteBody, setQuoteBody] = useState('');
  const [quoteReference, setQuoteReference] = useState('');
  const [quoteTheme, setQuoteTheme] = useState('general');
  const [quoteStatus, setQuoteStatus] = useState<'published' | 'hidden'>('published');

  const [bibleReference, setBibleReference] = useState('');
  const [bibleVersion, setBibleVersion] = useState('web');
  const [bibleTheme, setBibleTheme] = useState('general');
  const [bibleMessage, setBibleMessage] = useState('');

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({
      service: 'engagement-hub',
      action: 'daily_highlights_manage',
      organizationId,
      fromDate,
      days: String(rangeDays),
    });
    return 'noop?' + params.toString();
  }, [organizationId, fromDate, rangeDays]);

  const highlights = useResource<HighlightsPayload>(
    'daily-highlights:' + organizationId + ':' + fromDate + ':' + rangeDays,
    (signal) => access.canManageBible && organizationId
      ? api.request<HighlightsPayload>(query, { signal, context: 'public' })
      : Promise.resolve({ fromDate, days: [] }),
  );

  const versions = useResource<Version[]>(
    'daily-highlights:versions:' + organizationId,
    (signal) => access.canManageBible && organizationId
      ? api.request<Version[]>(
          'noop?service=bible&action=versions&language=en&organizationId=' + encodeURIComponent(organizationId),
          { signal, context: 'public' },
        )
      : Promise.resolve([]),
  );

  const manualQuoteCount = useMemo(
    () => (highlights.data?.days ?? []).filter((day) => day.quote.source === 'ministry').length,
    [highlights.data?.days],
  );
  const provisionedQuoteCount = useMemo(
    () => (highlights.data?.days ?? []).filter((day) => day.quote.source === 'provisioned').length,
    [highlights.data?.days],
  );
  const bibleOverrideCount = useMemo(
    () => (highlights.data?.days ?? []).filter((day) => day.bible.source === 'ministry').length,
    [highlights.data?.days],
  );

  const refresh = () => {
    invalidate('daily-highlights:');
    invalidate('home:spotlight:');
    invalidate('bible:');
    highlights.refresh();
  };

  const openEditor = (day: DayRow, tab: EditorTab) => {
    setSelected(day);
    setEditorTab(tab);
    setQuoteBody(day.quote.body);
    setQuoteReference(day.quote.sourceReference || day.bible.reference || '');
    setQuoteTheme(day.quote.theme || day.bible.theme || 'general');
    setQuoteStatus(day.quote.status || 'published');
    setBibleReference(day.bible.reference || '');
    setBibleVersion(day.bible.version_id || 'web');
    setBibleTheme(day.bible.theme || 'general');
    setBibleMessage(day.bible.message || '');
    setError('');
    setSuccess('');
    setEditorOpen(true);
  };

  const run = async (key: string, body: Record<string, unknown>, service: 'engagement-hub' | 'bible') => {
    if (busy) return false;
    setBusy(key);
    setError('');
    setSuccess('');
    try {
      await api.request('noop?service=' + service, {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ organizationId, ...body }),
      });
      refresh();
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save Daily Highlights.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveQuote = async () => {
    if (!selected) return;
    if (!quoteBody.trim()) {
      setError('Add the Daily Quote before saving.');
      return;
    }
    const ok = await run('quote', {
      action: 'quote_save',
      date: selected.date,
      body: quoteBody.trim(),
      sourceReference: quoteReference.trim(),
      theme: quoteTheme.trim() || 'general',
      status: quoteStatus,
    }, 'engagement-hub');
    if (ok) {
      setSuccess('Daily Quote saved for ' + readableDate(selected.date) + '.');
      setEditorOpen(false);
    }
  };

  const resetQuote = async () => {
    if (!selected) return;
    const ok = await run('quote-reset', { action: 'quote_delete', date: selected.date }, 'engagement-hub');
    if (ok) {
      setSuccess('Daily Quote returned to automatic Bible-inspired generation.');
      setEditorOpen(false);
    }
  };

  const saveBible = async () => {
    if (!selected || !bibleReference.trim()) {
      setError('Add a Bible reference before saving the override.');
      return;
    }
    const ok = await run('bible', {
      action: 'manage_daily',
      date: selected.date,
      reference: bibleReference.trim(),
      versionId: bibleVersion,
      theme: bibleTheme.trim() || 'general',
      message: bibleMessage.trim() || undefined,
    }, 'bible');
    if (ok) {
      setSuccess('Daily Bible override saved for ' + readableDate(selected.date) + '.');
      setEditorOpen(false);
    }
  };

  const resetBible = async () => {
    if (!selected) return;
    const ok = await run('bible-reset', { action: 'manage_daily_reset', date: selected.date }, 'bible');
    if (ok) {
      setSuccess('Daily Bible returned to automatic Scripture selection.');
      setEditorOpen(false);
    }
  };

  const provision = async () => {
    const ok = await run('provision', {
      action: 'quote_provision',
      fromDate,
      days: rangeDays,
      overwriteProvisioned: replaceProvisioned,
    }, 'engagement-hub');
    if (ok) setSuccess(rangeDays + ' days of Daily Quote provision are ready. Ministry-written quotes were preserved.');
  };

  if (mode !== 'authenticated') {
    return (
      <View style={[styles.state, { backgroundColor: colors.bg }]}>
        <EmptyState title="Sign in for Daily Highlights" message="Daily Quote and Daily Bible controls follow ministry access." iconName="sunny-outline" />
        <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/leadership/daily-highlights' } } as any)} />
      </View>
    );
  }

  if (!access.accessReady) {
    return <View style={[styles.state, { backgroundColor: colors.bg }]}><Skeleton height={70} /><Skeleton height={260} /></View>;
  }

  if (!access.canManageBible) {
    return (
      <View style={[styles.state, { backgroundColor: colors.bg }]}>
        <EmptyState title="Daily Highlights is not assigned" message="A ministry role with Bible management access is required to edit Daily Quote or Daily Bible." iconName="lock-closed-outline" />
        <Button label="Back to Ministry Tools" variant="outline" onPress={() => router.replace('/general/leadership')} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }]}
      >
        <ScreenHeader
          title="Daily Quote & Bible"
          kicker="MINISTRY · HOME"
          subtitle="COT Quote is an original reflection inspired by Scripture, not a copied Bible verse. Daily Bible remains the actual Scripture."
          showBack
          compact
        />

        {success ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{success}</Text></View> : null}
        {error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}

        <View style={[styles.explainer, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
          <Icon name="sparkles-outline" size={20} color={colors.interactive} />
          <View style={styles.flex}>
            <Text style={[styles.explainerTitle, { color: colors.text }]}>Two different daily items</Text>
            <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
              Daily Quote is a short original COT thought derived from the day’s Scripture theme. Daily Bible is the real Bible passage. Both run automatically, and ministry can override any date.
            </Text>
          </View>
        </View>

        <View style={[styles.provisionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Prepare upcoming quotes</Text>
              <Text style={[styles.help, { color: colors.textMuted }]}>Provision Bible-inspired quotes ahead of time, then edit individual days whenever needed.</Text>
            </View>
            <Icon name="calendar-outline" size={21} color={colors.interactive} />
          </View>
          <DateTimeField
            label="Start date"
            value={middayDate(fromDate)}
            onChange={(next) => setFromDate(formatDateOnly(next))}
            includeTime={false}
            minYear={2020}
            maxYear={2200}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>HOW MANY DAYS</Text>
          <View style={styles.chips}>
            {[7, 14, 30].map((days) => <Chip key={days} label={days + ' days'} selected={rangeDays === days} onPress={() => setRangeDays(days)} />)}
          </View>
          <Chip
            label={replaceProvisioned ? 'Refresh existing generated quotes' : 'Keep existing generated quotes'}
            selected={replaceProvisioned}
            onPress={() => setReplaceProvisioned((value) => !value)}
          />
          <Button label={'Provision ' + rangeDays + ' days'} loading={busy === 'provision'} onPress={() => void provision()} />
        </View>

        <View style={styles.metrics}>
          <Metric value={manualQuoteCount} label="Quote overrides" />
          <Metric value={provisionedQuoteCount} label="Prepared quotes" />
          <Metric value={bibleOverrideCount} label="Bible overrides" />
        </View>

        <SectionHeader title="Daily schedule" badge={highlights.data?.days?.length ?? 0} subtitle="Automatic content stays active on every day without an override." />

        {highlights.loading && !highlights.data ? (
          <Skeleton height={176} count={4} />
        ) : highlights.error && !highlights.data ? (
          <ResourceError message={highlights.error} retry={highlights.refresh} />
        ) : (highlights.data?.days ?? []).length ? (
          <View style={styles.dayList}>
            {(highlights.data?.days ?? []).map((day) => (
              <View key={day.date} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={[styles.dayDate, { color: colors.text }]}>{readableDate(day.date)}</Text>
                    <Text style={[styles.dayDateRaw, { color: colors.textMuted }]}>{day.date}</Text>
                  </View>
                  <BadgeSource source={day.quote.source} />
                </View>

                <Pressable onPress={() => openEditor(day, 'quote')} style={[styles.contentBlock, { backgroundColor: colors.bgSecondary }]}>
                  <View style={styles.blockTop}><Icon name="chatbubble-ellipses-outline" size={17} color={colors.interactive} /><Text style={[styles.blockKicker, { color: colors.interactive }]}>DAILY QUOTE</Text><View style={styles.flex} /><Icon name="create-outline" size={16} color={colors.textMuted} /></View>
                  <Text style={[styles.quoteText, { color: day.quote.status === 'hidden' ? colors.textMuted : colors.text }]} numberOfLines={4}>{day.quote.body}</Text>
                  <Text style={[styles.sourceText, { color: colors.textMuted }]}>{day.quote.status === 'hidden' ? 'Hidden · ' : ''}Inspired by {day.quote.sourceReference || day.bible.reference}</Text>
                </Pressable>

                <Pressable onPress={() => openEditor(day, 'bible')} style={[styles.contentBlock, { backgroundColor: colors.bgSecondary }]}>
                  <View style={styles.blockTop}><Icon name="book-outline" size={17} color={colors.interactive} /><Text style={[styles.blockKicker, { color: colors.interactive }]}>DAILY BIBLE</Text><View style={styles.flex} /><Text style={[styles.sourceBadgeText, { color: colors.textMuted }]}>{day.bible.source === 'ministry' ? 'OVERRIDE' : 'AUTO'}</Text><Icon name="create-outline" size={16} color={colors.textMuted} /></View>
                  <Text style={[styles.bibleRef, { color: colors.text }]}>{day.bible.reference}</Text>
                  <Text style={[styles.sourceText, { color: colors.textMuted }]}>{day.bible.theme} · {day.bible.version_id}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No days to show" message="Choose a date range above to prepare Daily Quote and Daily Bible." iconName="calendar-outline" />
        )}
      </ScrollView>

      <BottomSheet
        visible={editorOpen}
        onClose={() => !busy && setEditorOpen(false)}
        title={selected ? readableDate(selected.date) : 'Daily Highlight'}
        subtitle="Override only when ministry needs a specific message"
        maxHeightPercent={96}
      >
        <View style={styles.sheet}>
          <View style={styles.chips}>
            <Chip label="Daily Quote" selected={editorTab === 'quote'} onPress={() => setEditorTab('quote')} />
            <Chip label="Daily Bible" selected={editorTab === 'bible'} onPress={() => setEditorTab('bible')} />
          </View>

          {editorTab === 'quote' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorScroll}>
              <View style={[styles.editorInfo, { backgroundColor: colors.primarySoft }]}>
                <Icon name="information-circle-outline" size={18} color={colors.interactive} />
                <Text style={[styles.editorInfoText, { color: colors.textSecondary }]}>Write an original reflection inspired by Scripture. Do not paste the Bible verse here; the Bible card is separate.</Text>
              </View>
              <InputField label="Daily Quote" value={quoteBody} onChangeText={setQuoteBody} multiline numberOfLines={5} placeholder="A short original thought for today" />
              <InputField label="Inspired by Bible reference" value={quoteReference} onChangeText={setQuoteReference} placeholder="Philippians 4:6-7" />
              <InputField label="Theme" value={quoteTheme} onChangeText={setQuoteTheme} placeholder="peace" />
              <Text style={[styles.label, { color: colors.textSecondary }]}>VISIBILITY</Text>
              <View style={styles.chips}>
                <Chip label="Published" selected={quoteStatus === 'published'} onPress={() => setQuoteStatus('published')} />
                <Chip label="Hidden" selected={quoteStatus === 'hidden'} onPress={() => setQuoteStatus('hidden')} />
              </View>
              <Button label="Save quote override" loading={busy === 'quote'} onPress={() => void saveQuote()} fullWidth />
              {selected?.quote.isOverride ? <Button label="Return to automatic quote" loading={busy === 'quote-reset'} onPress={() => void resetQuote()} variant="outline" fullWidth /> : null}
              <View style={[styles.preview, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.blockKicker, { color: colors.interactive }]}>AUTOMATIC VERSION</Text>
                <Text style={[styles.quoteText, { color: colors.text }]}>{selected?.automaticQuote.body || ''}</Text>
                <Text style={[styles.sourceText, { color: colors.textMuted }]}>Inspired by {selected?.automaticQuote.sourceReference || selected?.bible.reference}</Text>
              </View>
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorScroll}>
              <InputField label="Bible reference" value={bibleReference} onChangeText={setBibleReference} placeholder="Philippians 4:6-7" />
              <Text style={[styles.label, { color: colors.textSecondary }]}>TRANSLATION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                {(versions.data ?? []).slice(0, 30).map((version) => (
                  <Chip
                    key={String(version.id)}
                    label={version.abbreviation || version.localized_title || version.title || String(version.id)}
                    selected={bibleVersion === String(version.id)}
                    onPress={() => setBibleVersion(String(version.id))}
                  />
                ))}
              </ScrollView>
              <InputField label="Theme" value={bibleTheme} onChangeText={setBibleTheme} placeholder="peace" />
              <InputField label="Ministry note (optional)" value={bibleMessage} onChangeText={setBibleMessage} multiline numberOfLines={3} placeholder="Short context for today’s Scripture" />
              <Button label="Save Bible override" loading={busy === 'bible'} onPress={() => void saveBible()} fullWidth />
              {selected?.bible.source === 'ministry' ? <Button label="Return to automatic Scripture" loading={busy === 'bible-reset'} onPress={() => void resetBible()} variant="outline" fullWidth /> : null}
              <Text style={[styles.help, { color: colors.textMuted }]}>COT loads the actual verse text from the selected Bible provider. Ministry only chooses the reference, translation and theme.</Text>
            </ScrollView>
          )}

          {error ? <Text style={[styles.error, { color: colors.live }]}>{error}</Text> : null}
        </View>
      </BottomSheet>
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function BadgeSource({ source }: { source: DailyQuote['source'] }) {
  const { colors } = useTheme();
  const label = source === 'ministry' ? 'MINISTRY' : source === 'provisioned' ? 'PREPARED' : 'AUTO';
  return <View style={[styles.sourceBadge, { backgroundColor: source === 'ministry' ? colors.primarySoft : colors.bgSecondary }]}><Text style={[styles.sourceBadgeText, { color: source === 'ministry' ? colors.interactive : colors.textMuted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  content: { flexGrow: 1, width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  explainer: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  explainerTitle: { fontSize: 13, fontWeight: '900' },
  explainerText: { fontSize: 11, lineHeight: 17, marginTop: 3 },
  provisionCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  help: { fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  horizontalChips: { gap: 7, paddingRight: spacing.md },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  dayList: { gap: spacing.md },
  dayCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  dayDate: { fontSize: 14, fontWeight: '900' },
  dayDateRaw: { fontSize: 9.5, marginTop: 2 },
  contentBlock: { borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  blockTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  quoteText: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  bibleRef: { fontSize: 15, fontWeight: '900' },
  sourceText: { fontSize: 9.5, lineHeight: 14 },
  sourceBadge: { minHeight: 24, borderRadius: radius.pill, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  sourceBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  sheet: { gap: spacing.md },
  editorScroll: { gap: spacing.md, paddingBottom: spacing.xl },
  editorInfo: { borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  editorInfoText: { flex: 1, fontSize: 10.5, lineHeight: 16 },
  preview: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  error: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
});

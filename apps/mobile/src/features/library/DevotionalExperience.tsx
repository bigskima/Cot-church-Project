import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Icon, ScreenHeader, Skeleton } from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { ReadAloudRateControl, useReadAloudRate } from '@/components/ReadAloudRateControl';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { DailyDevotionalPayload } from './library-types';

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function today() { return localIsoDate(); }
function fromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, Math.max(0, month - 1), day, 12, 0, 0);
}
function shiftDate(value: string, amount: number) {
  const date = fromIso(value);
  date.setDate(date.getDate() + amount);
  return localIsoDate(date);
}
function prettyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(fromIso(value));
}
function dateParts(value: string) {
  const source = fromIso(value);
  return {
    day: String(source.getDate()).padStart(2, '0'),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(source),
    monthYear: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(source),
  };
}

export function DevotionalExperience() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const [date, setDate] = useState(today());
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useReadAloudRate();
  const devotional = useResource<DailyDevotionalPayload | null>(
    `devotional:${organizationId || 'public'}:${date}`,
    (signal) => api.request<DailyDevotionalPayload | null>(
      `noop?service=library&view=devotional&date=${date}${organizationId ? `&organizationId=${organizationId}` : ''}`,
      { signal, context: 'public' },
    ),
  );

  const selected = useMemo(() => dateParts(date), [date]);

  useEffect(() => {
    void Speech.stop();
    setSpeaking(false);
  }, [date]);
  useEffect(() => () => { void Speech.stop(); }, []);

  const speak = () => {
    const data = devotional.data;
    if (!data) return;
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    const text = [
      data.entry.title,
      data.entry.scripture,
      data.entry.memory_verse,
      data.entry.body,
      data.entry.prayer,
    ].filter(Boolean).join('. ');
    setSpeaking(true);
    Speech.speak(text, {
      rate: speechRate,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 },
        ]}
      >
        <ScreenHeader title='Daily Devotional' showBack compact />

        <View style={[styles.navigator, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.navigatorTop}>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Previous devotional day'
              onPress={() => setDate(shiftDate(date, -1))}
              style={({ pressed }) => [
                styles.navButton,
                { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                pressed && { opacity: 0.72 },
              ]}
            >
              <Icon name='chevron-back' size={20} color={colors.text} />
            </Pressable>

            <View style={styles.dateHero}>
              <Text style={[styles.weekday, { color: colors.interactive }]}>{selected.weekday.toUpperCase()}</Text>
              <Text style={[styles.dayNumber, { color: colors.text }]}>{selected.day}</Text>
              <Text style={[styles.monthYear, { color: colors.textSecondary }]}>{selected.monthYear}</Text>
            </View>

            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Next devotional day'
              onPress={() => setDate(shiftDate(date, 1))}
              style={({ pressed }) => [
                styles.navButton,
                { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                pressed && { opacity: 0.72 },
              ]}
            >
              <Icon name='chevron-forward' size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={[styles.jumpPanel, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.jumpCopy}>
              <Text style={[styles.jumpKicker, { color: colors.textMuted }]}>JUMP TO A DAY</Text>
              <Text style={[styles.jumpHint, { color: colors.textSecondary }]}>Choose any devotional date</Text>
            </View>
            <View style={styles.jumpControls}>
              <View style={styles.datePickerWrap}>
                <DateTimeField
                  label='Devotional date'
                  value={fromIso(date)}
                  onChange={(next) => setDate(localIsoDate(next))}
                  includeTime={false}
                  minYear={2000}
                  maxYear={2200}
                  placeholder='Choose devotional date'
                />
              </View>
              <Pressable
                onPress={() => setDate(today())}
                style={[
                  styles.todayButton,
                  { backgroundColor: date === today() ? colors.primarySoft : colors.card, borderColor: colors.borderSubtle },
                ]}
              >
                <Icon name='today-outline' size={15} color={colors.interactive} />
                <Text style={[styles.todayText, { color: colors.interactive }]}>Today</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {devotional.loading && devotional.data === undefined ? (
          <View style={styles.loading}>
            <Skeleton height={38} width='55%' borderRadius={12} />
            <Skeleton height={460} borderRadius={22} />
          </View>
        ) : devotional.error ? (
          <Pressable onPress={devotional.refresh}>
            <EmptyState title='Devotional unavailable' message='Tap to try again.' iconName='refresh-outline' />
          </Pressable>
        ) : !devotional.data ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Icon name='calendar-clear-outline' size={34} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No devotional for this date</Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
              Choose another day. Ministry publishers can add or map daily readings from a devotional book.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.seriesHead}>
              <View style={styles.flex}>
                <Text style={[styles.seriesTitle, { color: colors.text }]}>{devotional.data.series.title}</Text>
                <Text style={[styles.seriesMeta, { color: colors.textSecondary }]}>
                  {devotional.data.series.author_name || `${devotional.data.series.devotional_year} devotional`}
                </Text>
              </View>
              <Pressable
                onPress={speak}
                style={[
                  styles.listen,
                  {
                    backgroundColor: speaking ? colors.primarySoft : colors.card,
                    borderColor: speaking ? colors.interactive : colors.borderSubtle,
                  },
                ]}
              >
                <Icon name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={17} color={colors.interactive} />
                <Text style={[styles.listenText, { color: colors.interactive }]}>{speaking ? 'Stop' : 'Listen'}</Text>
              </Pressable>
            </View>

            <ReadAloudRateControl value={speechRate} onChange={setSpeechRate} compact />

            <View style={[styles.paper, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <Text style={[styles.entryDate, { color: colors.interactive }]}>
                {prettyDate(devotional.data.entry.devotional_date).toUpperCase()}
              </Text>
              <Text style={[styles.entryTitle, { color: colors.text }]}>
                {devotional.data.entry.title || 'Today’s Devotional'}
              </Text>
              {devotional.data.entry.scripture ? (
                <View style={[styles.scripture, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.kicker, { color: colors.textMuted }]}>SCRIPTURE</Text>
                  <Text style={[styles.scriptureText, { color: colors.text }]}>{devotional.data.entry.scripture}</Text>
                </View>
              ) : null}
              {devotional.data.entry.memory_verse ? (
                <View style={styles.block}>
                  <Text style={[styles.kicker, { color: colors.textMuted }]}>MEMORY VERSE</Text>
                  <Text style={[styles.verse, { color: colors.text }]}>{devotional.data.entry.memory_verse}</Text>
                </View>
              ) : null}
              <Text style={[styles.body, { color: colors.text }]}>{devotional.data.entry.body}</Text>
              {devotional.data.entry.prayer ? (
                <View style={[styles.prayer, { borderColor: colors.borderSubtle }]}>
                  <Icon name='heart-outline' size={18} color={colors.interactive} />
                  <View style={styles.flex}>
                    <Text style={[styles.kicker, { color: colors.textMuted }]}>PRAYER / REFLECTION</Text>
                    <Text style={[styles.prayerText, { color: colors.text }]}>{devotional.data.entry.prayer}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  navigator: {
    borderWidth: 1,
    borderRadius: 26,
    overflow: 'hidden',
  },
  navigatorTop: {
    minHeight: 142,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateHero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 9.5, lineHeight: 13, fontWeight: '900', letterSpacing: 1.5 },
  dayNumber: { fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -1.4, marginTop: 2 },
  monthYear: { fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 1 },
  jumpPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 10,
  },
  jumpCopy: { gap: 2 },
  jumpKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 },
  jumpHint: { fontSize: 10.5, fontWeight: '700' },
  jumpControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePickerWrap: { flex: 1, minWidth: 0 },
  todayButton: {
    height: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  todayText: { fontSize: 10, fontWeight: '900' },
  loading: { gap: spacing.md },
  emptyCard: {
    minHeight: 280,
    borderWidth: 1,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 380 },
  seriesHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  seriesTitle: { fontSize: 17, fontWeight: '900' },
  seriesMeta: { fontSize: 11, marginTop: 2 },
  flex: { flex: 1, minWidth: 0 },
  listen: {
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  listenText: { fontSize: 10, fontWeight: '900' },
  paper: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 20 },
  entryDate: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 },
  entryTitle: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.5 },
  scripture: { borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  scriptureText: { fontSize: 15, lineHeight: 22, fontWeight: '800' },
  block: { gap: 6 },
  verse: { fontSize: 15, lineHeight: 23, fontStyle: 'italic' },
  body: { fontSize: 16, lineHeight: 28 },
  prayer: { borderTopWidth: 1, paddingTop: 18, flexDirection: 'row', gap: 10 },
  prayerText: { fontSize: 14, lineHeight: 22, marginTop: 5 },
});

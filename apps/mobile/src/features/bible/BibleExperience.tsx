import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioPlayer, BottomSheet, Button, Chip, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { TimeField } from '@/components/DateTimeField';
import { ReadAloudRateControl, useReadAloudRate } from '@/components/ReadAloudRateControl';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { shareContent } from '@/services/share';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { bibleVerseCardDataUri } from './bible-share-card';

type BibleVersion = {
  id: string;
  abbreviation?: string;
  localized_abbreviation?: string;
  title?: string;
  localized_title?: string;
  copyright?: string;
  provider?: string;
  language?: { name?: string; iso_639_1?: string };
  language_tag?: string;
  available?: boolean;
  accessStatus?: 'public_domain' | 'licensed' | 'requires_license';
};

type BibleBook = { name: string; usfm: string; number: number; chapters: number };
type Verse = { bookName?: string; chapter?: number; verse?: number; text?: string };
type Passage = {
  reference: string;
  versionId: string;
  abbreviation?: string;
  versionName?: string;
  copyright?: string | null;
  text: string;
  verses?: Verse[];
  audio?: { available?: boolean; provider?: string; url?: string; duration?: number | null; reason?: string } | null;
};
type Today = { reference: string; version_id: string; theme: string; source: string; message?: string | null; date: string; passage: Passage };
type StudyState = {
  preferences?: {
    default_version_id?: string;
    language_tag?: string;
    daily_scripture_notification?: boolean;
    notification_time?: string;
    timezone?: string;
    audio_rate?: number;
  } | null;
  bookmarks?: Array<{ id: string; reference: string; version_id: string; created_at: string }>;
  highlights?: Array<{ id: string; reference: string; version_id: string; color_key: string }>;
  notes?: Array<{ id: string; reference: string; version_id: string; body: string; updated_at: string }>;
  history?: Array<{ reference: string; version_id: string; last_read_at: string; read_count: number }>;
};
type SearchPayload = { verses: Array<{ reference?: string; text?: string }>; topics: Array<{ text?: string; reference?: string }>; query: string };
type Plan = { id: string; slug: string; title: string; description: string; duration_days: number };
type PlanDetail = Plan & {
  days: Array<{ day_number: number; title?: string; references: string[]; reflection?: string | null }>;
  progress?: { current_day: number; completed_days: number[] } | null;
};
type Tab = 'read' | 'search' | 'plans' | 'study';

function buildReference(book: BibleBook | undefined, chapter: number) {
  return book ? book.name + ' ' + chapter : 'John 3';
}

function chapterReferenceOf(value: string) {
  const match = value.trim().match(/^(.+?\s+\d{1,3})(?::\d{1,3}(?:[-–—]\d{1,3})?)?$/);
  return match?.[1] || value.trim();
}

function requestedVerseOf(value: string) {
  const match = value.trim().match(/:(\d{1,3})(?:[-–—](\d{1,3}))?$/);
  return match ? Number(match[1]) : null;
}

function progressiveReference(chapterReference: string, verses: Verse[]) {
  const numbered = verses.map((verse) => Number(verse.verse)).filter((verse) => Number.isFinite(verse));
  if (!numbered.length) return chapterReference;
  const first = numbered[0];
  const last = numbered[numbered.length - 1];
  return first === last ? chapterReference + ':' + first : chapterReference + ':' + first + '-' + last;
}

function timeValue(value?: string | null) {
  const date = new Date();
  const match = String(value || '07:00').match(/^(\d{1,2}):(\d{2})/);
  date.setHours(Number(match?.[1] ?? 7), Number(match?.[2] ?? 0), 0, 0);
  return date;
}

function hhmm(value: Date) {
  return String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0');
}

function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function BibleExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const route = useLocalSearchParams<{ reference?: string; tab?: string }>();
  const organizationId =
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';

  const [tab, setTab] = useState<Tab>((route.tab as Tab) || 'read');
  const [reference, setReference] = useState(route.reference?.trim() || 'John 3');
  const [versionId, setVersionId] = useState('web');
  const [language, setLanguage] = useState('en');
  const [versionSheet, setVersionSheet] = useState(false);
  const [versionSearch, setVersionSearch] = useState('');
  const [bookSheet, setBookSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [compareVersion, setCompareVersion] = useState<string | null>(null);
  const [compareSheet, setCompareSheet] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [versePage, setVersePage] = useState(0);
  const [speechRate, setSpeechRate] = useReadAloudRate();
  const [speaking, setSpeaking] = useState(false);
  const [actionError, setActionError] = useState('');

  const queryString = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (organizationId) params.set('organizationId', organizationId);
    return params.toString();
  };

  const chapterReference = useMemo(() => chapterReferenceOf(reference), [reference]);

  const books = useResource<BibleBook[]>('bible:books', (signal) =>
    api.request('noop?service=bible&' + queryString({ action: 'books' }), { signal, context: 'public' }),
  );
  const versions = useResource<BibleVersion[]>('bible:versions:' + language, (signal) =>
    api.request('noop?service=bible&' + queryString({ action: 'versions', language }), { signal, context: 'public' }),
  );
  const passage = useResource<Passage>(
    'bible:passage:' + versionId + ':' + chapterReference + ':' + organizationId,
    (signal) => api.request('noop?service=bible&' + queryString({ action: 'passage', reference: chapterReference, versionId }), { signal, context: 'public' }),
  );
  const today = useResource<Today>('bible:today:' + organizationId, (signal) =>
    api.request('noop?service=bible&' + queryString({ action: 'today' }), { signal, context: 'public' }),
  );
  const study = useResource<StudyState>('bible:me:' + organizationId + ':' + mode, (signal) =>
    api.request('noop?service=bible&' + queryString({ action: 'me' }), { signal, context: 'public' }),
  );
  const plans = useResource<Plan[]>('bible:plans:' + organizationId, (signal) =>
    api.request('noop?service=bible&' + queryString({ action: 'plans' }), { signal, context: 'public' }),
  );
  const planDetail = useResource<PlanDetail | null>(
    selectedPlan ? 'bible:plan:' + selectedPlan + ':' + mode : 'bible:plan:none',
    async (signal) => selectedPlan
      ? api.request('noop?service=bible&' + queryString({ action: 'plan', planId: selectedPlan }), { signal, context: 'public' })
      : null,
  );
  const search = useResource<SearchPayload | null>(
    searchQuery ? 'bible:search:' + versionId + ':' + searchQuery : 'bible:search:none',
    async (signal) => searchQuery
      ? api.request('noop?service=bible&' + queryString({ action: 'search', q: searchQuery, versionId }), { signal, context: 'public' })
      : null,
  );
  const compare = useResource<Passage | null>(
    compareVersion ? 'bible:compare:' + compareVersion + ':' + reference : 'bible:compare:none',
    async (signal) => compareVersion
      ? api.request('noop?service=bible&' + queryString({ action: 'passage', reference, versionId: compareVersion }), { signal, context: 'public' })
      : null,
  );

  useEffect(() => {
    if (route.reference?.trim() && route.reference.trim() !== reference) setReference(route.reference.trim());
  }, [route.reference]);

  useEffect(() => {
    const preference = study.data?.preferences;
    if (preference?.default_version_id && versionId === 'web') setVersionId(preference.default_version_id);
    if (preference?.language_tag) setLanguage(preference.language_tag);
  }, [study.data?.preferences]);

  useEffect(() => {
    if (mode !== 'authenticated' || !passage.data?.reference) return;
    void api.request('noop?service=bible', {
      method: 'POST',
      context: 'public',
      body: JSON.stringify({ action: 'history', reference: passage.data.reference, versionId }),
    }).then(() => invalidate('bible:me:')).catch(() => undefined);
  }, [passage.data?.reference, versionId, mode]);

  const parsed = useMemo(() => {
    const match = chapterReference.match(/^(.+?)\s+(\d{1,3})/);
    const book = books.data?.find((item) => item.name.toLowerCase() === (match?.[1] || '').toLowerCase());
    return { book, chapter: Number(match?.[2] || 1) };
  }, [chapterReference, books.data]);

  const allVerses = passage.data?.verses?.filter((verse) => Boolean(verse.text)) ?? [];
  const versesPerPage = 2;
  const totalVersePages = Math.max(1, Math.ceil(Math.max(allVerses.length, 1) / versesPerPage));
  const safeVersePage = Math.min(Math.max(versePage, 0), totalVersePages - 1);
  const visibleVerses = allVerses.length
    ? allVerses.slice(safeVersePage * versesPerPage, safeVersePage * versesPerPage + versesPerPage)
    : passage.data
      ? [{ text: passage.data.text }]
      : [];
  const visibleReference = passage.data
    ? progressiveReference(chapterReference, visibleVerses)
    : reference;
  const visibleText = visibleVerses.map((verse) => verse.text || '').filter(Boolean).join(' ');
  const bookmarked = Boolean(study.data?.bookmarks?.some((item) => item.reference === visibleReference && item.version_id === versionId));
  const highlight = study.data?.highlights?.find((item) => item.reference === visibleReference && item.version_id === versionId);
  const savedNote = study.data?.notes?.find((item) => item.reference === visibleReference && item.version_id === versionId);
  const currentVersion = versions.data?.find((item) => String(item.id) === String(versionId));
  const visibleVersions = useMemo(() => {
    const needle = versionSearch.trim().toLowerCase();
    const source = versions.data ?? [];
    if (!needle) return source;
    return source.filter((item) => {
      const haystack = [
        item.abbreviation,
        item.localized_abbreviation,
        item.title,
        item.localized_title,
        item.language_tag,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [versions.data, versionSearch]);

  useEffect(() => {
    if (!passage.data) return;
    const requestedVerse = requestedVerseOf(reference);
    if (!requestedVerse || !allVerses.length) {
      setVersePage(0);
      return;
    }
    const requestedIndex = allVerses.findIndex((verse) => Number(verse.verse) === requestedVerse);
    setVersePage(requestedIndex >= 0 ? Math.floor(requestedIndex / versesPerPage) : 0);
  }, [chapterReference, passage.data?.reference, reference]);

  const postAction = async (body: Record<string, unknown>) => {
    setActionError('');
    try {
      const value = await api.request<any>('noop?service=bible', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify(body),
      });
      invalidate('bible:me:');
      study.refresh();
      return value;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save Bible activity.');
      return null;
    }
  };

  const changeChapter = (delta: number) => {
    if (!parsed.book) return;
    const list = books.data ?? [];
    let book = parsed.book;
    let chapter = parsed.chapter + delta;
    const index = list.findIndex((item) => item.number === book.number);
    if (chapter < 1 && index > 0) {
      book = list[index - 1];
      chapter = book.chapters;
    } else if (chapter > book.chapters && index < list.length - 1) {
      book = list[index + 1];
      chapter = 1;
    } else if (chapter < 1 || chapter > book.chapters) {
      return;
    }
    void Speech.stop();
    setSpeaking(false);
    setVersePage(0);
    setReference(buildReference(book, chapter));
  };

  const changeBook = (delta: number) => {
    if (!parsed.book) return;
    const list = books.data ?? [];
    const index = list.findIndex((item) => item.number === parsed.book!.number);
    const nextBook = list[index + delta];
    if (!nextBook) return;
    void Speech.stop();
    setSpeaking(false);
    setVersePage(0);
    setReference(buildReference(nextBook, 1));
  };

  const speak = async () => {
    if (!visibleText) return;
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(visibleText, {
      rate: speechRate,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const shareVerse = async (graphic = false) => {
    if (!passage.data || !visibleText) return;
    const message =
      '“' + visibleText + '”\n— ' +
      visibleReference + ' ' + (passage.data.abbreviation || '') +
      '\nShared from COT Bible';
    await shareContent({
      title: visibleReference,
      message,
      attachment: graphic ? {
        url: bibleVerseCardDataUri({
          reference: visibleReference,
          text: visibleText,
          version: passage.data.abbreviation,
        }),
        mimeType: 'image/svg+xml',
        fileName: 'cot-scripture.svg',
      } : null,
    });
  };

  const shareToCot = () => {
    if (!passage.data || !visibleText) return;
    router.push({
      pathname: '/general/community',
      params: {
        compose: 'post',
        intentId: String(Date.now()),
        scriptureReference: visibleReference,
        scriptureText: visibleText,
        scriptureVersion: passage.data.abbreviation || versionId,
      },
    } as any);
  };

  const savePreferences = (dailyEnabled: boolean, notificationTime?: string) => postAction({
    action: 'preferences',
    defaultVersionId: study.data?.preferences?.default_version_id || versionId,
    languageTag: study.data?.preferences?.language_tag || language,
    dailyScriptureNotification: dailyEnabled,
    notificationTime: notificationTime || study.data?.preferences?.notification_time || '07:00',
    timezone: study.data?.preferences?.timezone || localTimezone(),
    audioRate: speechRate,
  });

  const reader = (
    <View style={styles.section}>
      {today.data ? (
        <Pressable
          onPress={() => setReference(today.data!.reference)}
          style={[styles.todayCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}
        >
          <View style={styles.todayCompactTop}>
            <View style={[styles.todayCompactIcon, { backgroundColor: colors.card }]}>
              <Icon name="sunny-outline" size={15} color={colors.interactive} />
            </View>
            <Text style={[styles.kicker, { color: colors.interactive }]}>TODAY · {today.data.theme.toUpperCase()}</Text>
            <Text style={[styles.todayRef, { color: colors.textSecondary }]}>{today.data.reference}</Text>
            <Icon name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
          <Text style={[styles.todayText, { color: colors.text }]} numberOfLines={2}>{today.data.passage.text}</Text>
        </Pressable>
      ) : null}

      <View style={styles.readerControls}>
        <Pressable
          onPress={() => setBookSheet(true)}
          style={[styles.selector, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
        >
          <Icon name="book-outline" size={16} color={colors.interactive} />
          <Text style={[styles.selectorText, { color: colors.text }]} numberOfLines={1}>{chapterReference}</Text>
          <Icon name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => setVersionSheet(true)}
          style={[styles.versionButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.versionButtonText, { color: colors.interactive }]}>
            {currentVersion?.abbreviation || versionId.toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.navigationStack, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <View style={styles.navLine}>
          <Pressable onPress={() => changeBook(-1)} disabled={!parsed.book || parsed.book.number <= 1} style={styles.navTap}>
            <Icon name="play-back-outline" size={16} color={!parsed.book || parsed.book.number <= 1 ? colors.textMuted : colors.interactive} />
          </Pressable>
          <View style={styles.navLabelWrap}>
            <Text style={[styles.navKicker, { color: colors.textMuted }]}>BOOK</Text>
            <Text style={[styles.navLabel, { color: colors.text }]}>{parsed.book?.name || 'Bible'}</Text>
          </View>
          <Pressable onPress={() => changeBook(1)} disabled={!parsed.book || parsed.book.number >= 66} style={styles.navTap}>
            <Icon name="play-forward-outline" size={16} color={!parsed.book || parsed.book.number >= 66 ? colors.textMuted : colors.interactive} />
          </Pressable>
        </View>
        <View style={[styles.navDivider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.navLine}>
          <Pressable onPress={() => changeChapter(-1)} style={styles.navTap}>
            <Icon name="chevron-back" size={19} color={colors.interactive} />
          </Pressable>
          <View style={styles.navLabelWrap}>
            <Text style={[styles.navKicker, { color: colors.textMuted }]}>CHAPTER</Text>
            <Text style={[styles.chapterTitle, { color: colors.text }]}>{parsed.chapter}</Text>
          </View>
          <Pressable onPress={() => changeChapter(1)} style={styles.navTap}>
            <Icon name="chevron-forward" size={19} color={colors.interactive} />
          </Pressable>
        </View>
      </View>

      {passage.loading && !passage.data ? (
        <><Skeleton height={48} /><Skeleton height={260} /></>
      ) : passage.error ? (
        <ResourceError message={passage.error} retry={passage.refresh} />
      ) : passage.data ? (
        <>
          <View style={[styles.progressMeta, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.progressReference, { color: colors.interactive }]}>{visibleReference}</Text>
            <Text style={[styles.progressCount, { color: colors.textMuted }]}>
              {safeVersePage + 1} / {totalVersePages}
            </Text>
          </View>

          <View style={[styles.progressiveReaderRow]}>
            <Pressable
              onPress={() => setVersePage((page) => Math.max(0, page - 1))}
              disabled={safeVersePage <= 0}
              style={[styles.verseArrow, { backgroundColor: colors.card, borderColor: colors.borderSubtle, opacity: safeVersePage <= 0 ? 0.35 : 1 }]}
              accessibilityLabel="Previous verses"
            >
              <Icon name="chevron-back" size={21} color={colors.text} />
            </Pressable>

            <View style={[styles.scripturePaper, styles.progressivePaper, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              {visibleVerses.map((verse, index) => (
                <View key={verse.verse || index} style={styles.verseRow}>
                  {verse.verse ? <Text style={[styles.verseNo, { color: colors.interactive }]}>{verse.verse}</Text> : null}
                  <Text
                    selectable
                    style={[
                      styles.verseText,
                      {
                        color: colors.text,
                        backgroundColor: highlight ? colors.primarySoft : 'transparent',
                      },
                    ]}
                  >
                    {verse.text}
                  </Text>
                </View>
              ))}
              <View style={[styles.rule, { backgroundColor: colors.borderSubtle }]} />
              <Text style={[styles.copyright, { color: colors.textMuted }]}>
                {passage.data.versionName || currentVersion?.title || 'World English Bible'}
                {passage.data.copyright ? ' · ' + passage.data.copyright : ''}
              </Text>
            </View>

            <Pressable
              onPress={() => setVersePage((page) => Math.min(totalVersePages - 1, page + 1))}
              disabled={safeVersePage >= totalVersePages - 1}
              style={[styles.verseArrow, { backgroundColor: colors.card, borderColor: colors.borderSubtle, opacity: safeVersePage >= totalVersePages - 1 ? 0.35 : 1 }]}
              accessibilityLabel="Next verses"
            >
              <Icon name="chevron-forward" size={21} color={colors.text} />
            </Pressable>
          </View>

          <Text style={[styles.progressiveHint, { color: colors.textMuted }]}>
            Read one or two verses at a time. Use the side arrows for verses, and the controls above for chapters or books.
          </Text>

          {compareVersion && compare.data ? (
            <View style={[styles.compareCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.compareTitle, { color: colors.text }]}>Compare · {compare.data.abbreviation || compareVersion}</Text>
                <Pressable onPress={() => setCompareVersion(null)}><Icon name="close" size={18} color={colors.textMuted} /></Pressable>
              </View>
              <Text style={[styles.compareText, { color: colors.textSecondary }]} numberOfLines={8}>{compare.data.text}</Text>
            </View>
          ) : null}
          {actionError ? <Text style={[styles.error, { color: colors.live }]}>{actionError}</Text> : null}
        </>
      ) : null}
    </View>
  );

  const searchView = (
    <View style={styles.section}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <Icon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={() => setSearchQuery(searchInput.trim())}
          placeholder="Search words, topics, or John 3:16"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
        />
        <Pressable onPress={() => setSearchQuery(searchInput.trim())}>
          <Icon name="arrow-forward-circle" size={25} color={colors.interactive} />
        </Pressable>
      </View>
      {searchQuery && search.loading && !search.data ? (
        <Skeleton height={160} />
      ) : search.error ? (
        <ResourceError message={search.error} retry={search.refresh} />
      ) : search.data ? (
        <>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Results for “{search.data.query}”</Text>
          {search.data.topics?.map((topic, index) => (
            <Pressable
              key={(topic.text || 'topic') + '-' + index}
              onPress={() => {
                if (topic.reference) {
                  setReference(topic.reference);
                  setTab('read');
                } else setSearchQuery(topic.text || '');
              }}
              style={[styles.topicRow, { backgroundColor: colors.primarySoft }]}
            >
              <Icon name="pricetag-outline" size={14} color={colors.interactive} />
              <Text style={[styles.topicText, { color: colors.interactive }]}>
                {topic.text}{topic.reference ? ' · ' + topic.reference : ''}
              </Text>
            </Pressable>
          ))}
          {search.data.verses?.map((verse, index) => (
            <Pressable
              key={(verse.reference || 'verse') + '-' + index}
              onPress={() => {
                if (verse.reference) {
                  setReference(verse.reference);
                  setTab('read');
                }
              }}
              style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
            >
              <Text style={[styles.resultRef, { color: colors.interactive }]}>{verse.reference || 'Scripture'}</Text>
              {verse.text ? <Text numberOfLines={3} style={[styles.resultText, { color: colors.textSecondary }]}>{verse.text}</Text> : null}
            </Pressable>
          ))}
        </>
      ) : (
        <Text style={[styles.emptyHelp, { color: colors.textMuted }]}>
          Try “peace”, “faith”, “love”, or a direct Bible reference.
        </Text>
      )}
    </View>
  );

  const plansView = (
    <View style={styles.section}>
      {selectedPlan && planDetail.data ? (
        <>
          <Button label="Back to plans" variant="outline" size="sm" onPress={() => setSelectedPlan(null)} />
          <Text style={[styles.planTitle, { color: colors.text }]}>{planDetail.data.title}</Text>
          <Text style={[styles.planDesc, { color: colors.textSecondary }]}>{planDetail.data.description}</Text>
          {planDetail.data.days.map((day) => {
            const done = planDetail.data?.progress?.completed_days?.includes(day.day_number);
            return (
              <View key={day.day_number} style={[styles.planDay, { backgroundColor: colors.card, borderColor: done ? colors.interactive : colors.borderSubtle }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.planDayTitle, { color: colors.text }]}>Day {day.day_number} · {day.title}</Text>
                  {done ? <Icon name="checkmark-circle" size={18} color={colors.interactive} /> : null}
                </View>
                {day.references.map((item) => (
                  <Pressable key={item} onPress={() => { setReference(item); setTab('read'); }}>
                    <Text style={[styles.planRef, { color: colors.interactive }]}>{item}</Text>
                  </Pressable>
                ))}
                {day.reflection ? <Text style={[styles.planReflection, { color: colors.textSecondary }]}>{day.reflection}</Text> : null}
                {mode === 'authenticated' ? (
                  <Button
                    label={done ? 'Completed' : 'Mark complete'}
                    variant={done ? 'outline' : 'primary'}
                    size="sm"
                    onPress={() => void postAction({ action: 'plan_progress', planId: planDetail.data!.id, dayNumber: day.day_number }).then(() => planDetail.refresh())}
                  />
                ) : null}
              </View>
            );
          })}
        </>
      ) : plans.loading && !plans.data ? (
        <Skeleton height={170} count={2} />
      ) : (
        plans.data?.map((plan) => (
          <Pressable
            key={plan.id}
            onPress={() => setSelectedPlan(plan.id)}
            style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}
          >
            <View style={[styles.planIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="map-outline" size={21} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.planTitleSmall, { color: colors.text }]}>{plan.title}</Text>
              <Text numberOfLines={2} style={[styles.planDescSmall, { color: colors.textMuted }]}>{plan.description}</Text>
              <Text style={[styles.planMeta, { color: colors.interactive }]}>{plan.duration_days} days</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))
      )}
    </View>
  );

  const studyView = (
    <View style={styles.section}>
      {mode !== 'authenticated' ? (
        <View style={[styles.signInCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Icon name="person-circle-outline" size={28} color={colors.interactive} />
          <Text style={[styles.resultTitle, { color: colors.text }]}>Sign in for personal Bible study</Text>
          <Text style={[styles.emptyHelp, { color: colors.textMuted }]}>
            Bookmarks, highlights, notes, reading history, plans and daily reminder settings sync to your COT account.
          </Text>
          <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/bible' } } as any)} />
        </View>
      ) : (
        <>
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>Daily Scripture reminder</Text>
            <Text style={[styles.emptyHelp, { color: colors.textMuted }]}>
              The Home card appears every day. Notifications remain optional.
            </Text>
            <View style={styles.rowBetween}>
              <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Reminder</Text>
              <Chip
                label={study.data?.preferences?.daily_scripture_notification ? 'On' : 'Off'}
                selected={Boolean(study.data?.preferences?.daily_scripture_notification)}
                onPress={() => void savePreferences(!study.data?.preferences?.daily_scripture_notification)}
              />
            </View>
            <TimeField
              label="Reminder time"
              value={timeValue(study.data?.preferences?.notification_time)}
              onChange={(next) => void savePreferences(
                Boolean(study.data?.preferences?.daily_scripture_notification),
                hhmm(next),
              )}
              helperText={'Uses ' + (study.data?.preferences?.timezone || localTimezone()) + ' on this account.'}
            />
            <Text style={[styles.copyright, { color: colors.textMuted }]}>
              Daily Scripture reminders use the COT notification system and your saved local time.
            </Text>
          </View>
          <StudySection
            title="Bookmarks"
            icon="bookmark-outline"
            items={(study.data?.bookmarks ?? []).map((item) => ({
              title: item.reference,
              meta: item.version_id,
              onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
            }))}
          />
          <StudySection
            title="Notes"
            icon="create-outline"
            items={(study.data?.notes ?? []).map((item) => ({
              title: item.reference,
              meta: item.body,
              onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
            }))}
          />
          <StudySection
            title="Reading history"
            icon="time-outline"
            items={(study.data?.history ?? []).map((item) => ({
              title: item.reference,
              meta: 'Read ' + item.read_count + ' time' + (item.read_count === 1 ? '' : 's'),
              onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
            }))}
          />
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + (tab === 'read' ? 190 : 120) }]}
      >
        <ScreenHeader title="Bible" subtitle="Read, listen, search, save and study Scripture inside COT." showBack compact />
        <View style={styles.tabs}>
          <Chip label="Read" selected={tab === 'read'} onPress={() => setTab('read')} />
          <Chip label="Search" selected={tab === 'search'} onPress={() => setTab('search')} />
          <Chip label="Plans" selected={tab === 'plans'} onPress={() => setTab('plans')} />
          <Chip label="My Bible" selected={tab === 'study'} onPress={() => setTab('study')} />
        </View>
        {tab === 'read' ? reader : tab === 'search' ? searchView : tab === 'plans' ? plansView : studyView}
      </ScrollView>

      {tab === 'read' && passage.data ? (
        <View style={[styles.readerDock, { backgroundColor: colors.card, borderColor: colors.borderSubtle, paddingBottom: Math.max(insets.bottom, 8) }, shadows.md]}>
          <ReaderDockAction icon={bookmarked ? 'bookmark' : 'bookmark-outline'} label={bookmarked ? 'Saved' : 'Save'} active={bookmarked} onPress={() => void postAction({ action: 'toggle_bookmark', reference: visibleReference, versionId })} />
          <ReaderDockAction icon="color-palette-outline" label="Highlight" active={Boolean(highlight)} onPress={() => void postAction({ action: 'highlight', reference: visibleReference, versionId, colorKey: 'gold', remove: Boolean(highlight) })} />
          <ReaderDockAction icon="create-outline" label="Note" active={Boolean(savedNote)} onPress={() => { setNoteText(savedNote?.body || ''); setNoteSheet(true); }} />
          <ReaderDockAction icon={speaking ? 'stop-circle-outline' : 'volume-high-outline'} label={speaking ? 'Stop' : 'Listen'} active={speaking} onPress={() => void speak()} />
          <ReaderDockAction icon="ellipsis-horizontal-circle-outline" label="More" onPress={() => setMoreToolsOpen(true)} />
        </View>
      ) : null}

      <BottomSheet visible={bookSheet} onClose={() => setBookSheet(false)} title="Choose book & chapter" subtitle="Genesis to Revelation" maxHeightPercent={84}>
        <ScrollView style={styles.sheetScroll}>
          {books.data?.map((book) => (
            <View key={book.usfm} style={styles.bookBlock}>
              <Text style={[styles.bookName, { color: colors.text }]}>{book.name}</Text>
              <View style={styles.chapterGrid}>
                {Array.from({ length: book.chapters }, (_, index) => index + 1).map((chapter) => (
                  <Pressable
                    key={chapter}
                    onPress={() => { setReference(buildReference(book, chapter)); setBookSheet(false); }}
                    style={[styles.chapterChip, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
                  >
                    <Text style={[styles.chapterChipText, { color: colors.textSecondary }]}>{chapter}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={versionSheet} onClose={() => setVersionSheet(false)} title="Bible version" subtitle="KJV, NKJV and other YouVersion translations appear according to your app's publisher licenses." maxHeightPercent={82}>
        <View style={styles.versionFilters}>
          <TextInput
            value={language}
            onChangeText={setLanguage}
            placeholder="Language code e.g. en, ig, fr"
            placeholderTextColor={colors.textMuted}
            style={[styles.languageInput, { color: colors.text, borderColor: colors.borderSubtle, backgroundColor: colors.bgSecondary }]}
          />
          <View style={[styles.versionSearch, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={versionSearch}
              onChangeText={setVersionSearch}
              placeholder="Search KJV, NKJV, NIV…"
              placeholderTextColor={colors.textMuted}
              style={[styles.versionSearchInput, { color: colors.text }]}
            />
            {versionSearch ? <Pressable onPress={() => setVersionSearch('')}><Icon name="close-circle" size={16} color={colors.textMuted} /></Pressable> : null}
          </View>
        </View>
        <ScrollView style={styles.versionScroll}>
          {visibleVersions.map((item) => {
            const available = item.available !== false;
            const abbreviation = item.localized_abbreviation || item.abbreviation || String(item.id);
            return (
              <Pressable
                key={String(item.id)}
                disabled={!available}
                onPress={() => {
                  setVersionId(String(item.id));
                  setVersePage(0);
                  setVersionSheet(false);
                  if (mode === 'authenticated') void postAction({
                    action: 'preferences',
                    defaultVersionId: String(item.id),
                    languageTag: language,
                    dailyScriptureNotification: Boolean(study.data?.preferences?.daily_scripture_notification),
                    notificationTime: study.data?.preferences?.notification_time || '07:00',
                    timezone: study.data?.preferences?.timezone || localTimezone(),
                    audioRate: speechRate,
                  });
                }}
                style={[styles.versionRow, { borderBottomColor: colors.borderSubtle, opacity: available ? 1 : 0.58 }]}
              >
                <View style={[styles.versionBadge, { backgroundColor: available ? colors.primarySoft : colors.bgSecondary }]}>
                  <Text style={[styles.versionBadgeText, { color: available ? colors.interactive : colors.textMuted }]}>{abbreviation}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.versionTitle, { color: colors.text }]}>{item.localized_title || item.title || abbreviation}</Text>
                  <Text style={[styles.versionMeta, { color: available ? colors.textMuted : colors.live }]}>
                    {available
                      ? ((item.language?.name || item.language_tag || '') + (item.provider ? ' · ' + item.provider : ''))
                      : 'Listed by YouVersion · publisher license not enabled for this COT App Key'}
                  </Text>
                </View>
                {String(item.id) === String(versionId)
                  ? <Icon name="checkmark-circle" size={18} color={colors.interactive} />
                  : !available
                    ? <Icon name="lock-closed-outline" size={16} color={colors.textMuted} />
                    : null}
              </Pressable>
            );
          })}
          {!visibleVersions.length ? (
            <Text style={[styles.emptyHelp, { color: colors.textMuted }]}>
              No translation matches this search. If a YouVersion translation is missing, its publisher license may not be enabled for this App Key yet.
            </Text>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={noteSheet} onClose={() => setNoteSheet(false)} title={visibleReference || 'Bible note'} subtitle="Private to your COT account">
        <TextInput
          multiline
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Write your reflection…"
          placeholderTextColor={colors.textMuted}
          style={[styles.noteInput, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
        />
        <Button label="Save note" onPress={() => void postAction({ action: 'note', reference: visibleReference, versionId, body: noteText }).then(() => setNoteSheet(false))} />
        {savedNote ? <Button label="Delete note" variant="outline" onPress={() => void postAction({ action: 'note', reference: visibleReference, versionId, body: '' }).then(() => setNoteSheet(false))} /> : null}
      </BottomSheet>

      <BottomSheet visible={moreToolsOpen} onClose={() => setMoreToolsOpen(false)} title={visibleReference} subtitle="Bible tools" maxHeightPercent={78}>
        <View style={styles.moreTools}>
          <View style={styles.moreToolsGrid}>
            <ReaderAction icon="git-compare-outline" label="Compare" active={Boolean(compareVersion)} onPress={() => { setMoreToolsOpen(false); setCompareSheet(true); }} />
            <ReaderAction icon="share-social-outline" label="Share" onPress={() => void shareVerse(false)} />
            <ReaderAction icon="image-outline" label="Verse card" onPress={() => void shareVerse(true)} />
            <ReaderAction icon="people-outline" label="Share to COT" onPress={shareToCot} />
          </View>
          <ReadAloudRateControl value={speechRate} onChange={setSpeechRate} compact />
          {passage.data?.audio?.available && passage.data.audio.url ? (
            <AudioPlayer
              title={visibleReference + ' · recorded Bible'}
              sourceUrl={passage.data.audio.url}
              durationSeconds={passage.data.audio.duration || undefined}
            />
          ) : (
            <Text style={[styles.audioHint, { color: colors.textMuted }]}>
              Recorded Bible audio appears when Bible Brain is connected. COT read aloud remains available.
            </Text>
          )}
        </View>
      </BottomSheet>

      <BottomSheet visible={compareSheet} onClose={() => setCompareSheet(false)} title="Compare translation" subtitle="Choose another Bible version">
        {versions.data?.filter((item) => String(item.id) !== String(versionId)).map((item) => (
          <Pressable
            key={String(item.id)}
            onPress={() => { setCompareVersion(String(item.id)); setCompareSheet(false); }}
            style={[styles.versionRow, { borderBottomColor: colors.borderSubtle }]}
          >
            <Text style={[styles.versionBadgeText, { color: colors.interactive }]}>{item.abbreviation || String(item.id)}</Text>
            <Text style={[styles.versionTitle, { color: colors.text }]}>{item.localized_title || item.title}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

function ReaderDockAction({ icon, label, onPress, active = false }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.dockAction}>
      <View style={[styles.dockIcon, { backgroundColor: active ? colors.primarySoft : colors.bgSecondary }]}>
        <Icon name={icon} size={19} color={active ? colors.interactive : colors.textSecondary} />
      </View>
      <Text style={[styles.dockLabel, { color: active ? colors.interactive : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function ReaderAction({ icon, label, onPress, active = false }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.action,
        {
          backgroundColor: active ? colors.primarySoft : colors.card,
          borderColor: active ? colors.interactive : colors.borderSubtle,
        },
      ]}
    >
      <Icon name={icon} size={17} color={active ? colors.interactive : colors.textSecondary} />
      <Text style={[styles.actionLabel, { color: active ? colors.interactive : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function StudySection({ title, icon, items }: { title: string; icon: string; items: Array<{ title: string; meta: string; onPress: () => void }> }) {
  const { colors } = useTheme();
  return (
    <View style={styles.studySection}>
      <View style={styles.sectionHeading}>
        <Icon name={icon} size={17} color={colors.interactive} />
        <Text style={[styles.resultTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {items.length ? items.slice(0, 20).map((item, index) => (
        <Pressable key={item.title + '-' + index} onPress={item.onPress} style={[styles.studyRow, { borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.flex}>
            <Text style={[styles.studyTitle, { color: colors.text }]}>{item.title}</Text>
            <Text numberOfLines={2} style={[styles.studyMeta, { color: colors.textMuted }]}>{item.meta}</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      )) : <Text style={[styles.emptyHelp, { color: colors.textMuted }]}>Nothing here yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  section: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  todayCard: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 11, gap: 6 },
  todayCompactTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  todayCompactIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  todayText: { fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  todayRef: { flex: 1, textAlign: 'right', fontSize: 10, fontWeight: '900' },
  readerControls: { flexDirection: 'row', gap: 8 },
  selector: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectorText: { flex: 1, fontSize: 13, fontWeight: '800' },
  versionButton: { minWidth: 72, minHeight: 46, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  versionButtonText: { fontSize: 11, fontWeight: '900' },
  navigationStack: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  navLine: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  navTap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  navLabelWrap: { flex: 1, alignItems: 'center' },
  navKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  navLabel: { fontSize: 13, lineHeight: 18, fontWeight: '900', marginTop: 1 },
  navDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  chapterTitle: { fontSize: 18, fontWeight: '900' },
  progressMeta: { minHeight: 36, borderRadius: radius.pill, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressReference: { fontSize: 11, fontWeight: '900' },
  progressCount: { fontSize: 9.5, fontWeight: '800' },
  progressiveReaderRow: { flexDirection: 'row', alignItems: 'stretch', gap: 7 },
  verseArrow: { width: 42, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  scripturePaper: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: 14 },
  progressivePaper: { flex: 1, minHeight: 230, justifyContent: 'center' },
  progressiveHint: { fontSize: 9.5, lineHeight: 14, textAlign: 'center', paddingHorizontal: 18 },
  verseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  verseNo: { width: 24, fontSize: 10, fontWeight: '900', paddingTop: 4, textAlign: 'right' },
  verseText: { flex: 1, fontSize: 17, lineHeight: 29, borderRadius: 5 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: 5 },
  copyright: { fontSize: 9.5, lineHeight: 14 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  action: { minWidth: 84, minHeight: 48, borderWidth: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 9 },
  actionLabel: { fontSize: 9.5, fontWeight: '800' },
  readerDock: { position: 'absolute', left: 10, right: 10, bottom: 6, minHeight: 78, borderWidth: 1, borderRadius: radius.xl, paddingTop: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' },
  dockAction: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  dockIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dockLabel: { fontSize: 8.5, fontWeight: '800' },
  moreTools: { gap: spacing.md },
  moreToolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  audioWrap: { marginTop: 2 },
  audioHint: { fontSize: 10.5, lineHeight: 16 },
  compareCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 8 },
  compareTitle: { fontSize: 12, fontWeight: '900' },
  compareText: { fontSize: 14, lineHeight: 22 },
  error: { fontSize: 11, lineHeight: 16 },
  searchBar: { minHeight: 50, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 13 },
  resultTitle: { fontSize: 15, fontWeight: '900' },
  topicRow: { minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  topicText: { fontSize: 10.5, fontWeight: '800' },
  resultCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 5 },
  resultRef: { fontSize: 11, fontWeight: '900' },
  resultText: { fontSize: 13, lineHeight: 19 },
  emptyHelp: { fontSize: 11.5, lineHeight: 18 },
  planCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  planTitleSmall: { fontSize: 13, fontWeight: '900' },
  planDescSmall: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  planMeta: { fontSize: 9.5, fontWeight: '900', marginTop: 5 },
  planTitle: { fontSize: 22, fontWeight: '900' },
  planDesc: { fontSize: 13, lineHeight: 20 },
  planDay: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 8 },
  planDayTitle: { fontSize: 12.5, fontWeight: '900' },
  planRef: { fontSize: 12, fontWeight: '800' },
  planReflection: { fontSize: 11.5, lineHeight: 18 },
  signInCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-start' },
  settingsCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  settingLabel: { fontSize: 11.5, fontWeight: '800' },
  studySection: { gap: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  studyRow: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  studyTitle: { fontSize: 12, fontWeight: '800' },
  studyMeta: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  sheetScroll: { maxHeight: 520 },
  bookBlock: { paddingVertical: 10, gap: 7 },
  bookName: { fontSize: 13, fontWeight: '900' },
  chapterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chapterChip: { width: 42, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chapterChipText: { fontSize: 10.5, fontWeight: '800' },
  versionFilters: { gap: 8, marginBottom: spacing.sm },
  languageInput: { minHeight: 44, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12 },
  versionSearch: { minHeight: 44, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  versionSearchInput: { flex: 1, fontSize: 12.5 },
  versionScroll: { maxHeight: 460 },
  versionRow: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  versionBadge: { width: 48, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  versionBadgeText: { fontSize: 10.5, fontWeight: '900' },
  versionTitle: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  versionMeta: { fontSize: 9.5, marginTop: 2 },
  noteInput: { minHeight: 150, maxHeight: 280, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, textAlignVertical: 'top', fontSize: 13, lineHeight: 20 },
});

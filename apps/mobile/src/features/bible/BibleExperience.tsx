import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { bibleVerseCardPngDataUri } from './bible-share-card';

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
  accessStatus?: 'public_domain' | 'licensed' | 'requires_license' | 'platform_unavailable';
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
type Plan = {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration_days: number;
  organization_id?: string | null;
  created_by?: string | null;
  is_public?: boolean;
  is_personal?: boolean;
  plan_kind?: 'personal' | 'template' | 'ministry';
};
type PlanDetail = Plan & {
  days: Array<{ day_number: number; title?: string; references: string[]; reflection?: string | null }>;
  progress?: { current_day: number; completed_days: number[] } | null;
};
type PlanDraftDay = { title: string; references: string; reflection: string };
type Tab = 'read' | 'search' | 'plans' | 'study';
type StudyTab = 'overview' | 'bookmarks' | 'highlights' | 'notes' | 'history' | 'settings';

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
  const versionSearchRef = useRef<TextInput>(null);
  const [bookSheet, setBookSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [planListMode, setPlanListMode] = useState<'catalogue' | 'mine'>('catalogue');
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [planEditorId, setPlanEditorId] = useState<string | null>(null);
  const [planDraftTitle, setPlanDraftTitle] = useState('');
  const [planDraftDescription, setPlanDraftDescription] = useState('');
  const [planDraftDays, setPlanDraftDays] = useState<PlanDraftDay[]>([
    { title: 'Day 1', references: 'John 1:1-18', reflection: '' },
  ]);
  const [planBusy, setPlanBusy] = useState('');
  const [planError, setPlanError] = useState('');
  const [compareVersion, setCompareVersion] = useState<string | null>(null);
  const [compareSheet, setCompareSheet] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [versePage, setVersePage] = useState(0);
  const [studyTab, setStudyTab] = useState<StudyTab>('overview');
  const [studyLimit, setStudyLimit] = useState(8);
  const [speechRate, setSpeechRate] = useReadAloudRate();
  const [speaking, setSpeaking] = useState(false);
  const [autoReading, setAutoReading] = useState(false);
  const autoReadingRef = useRef(false);
  const speechPageRef = useRef('');
  const [actionError, setActionError] = useState('');
  const [verseCardOpen, setVerseCardOpen] = useState(false);
  const [verseCardUri, setVerseCardUri] = useState('');
  const [verseCardBusy, setVerseCardBusy] = useState(false);
  const [shareError, setShareError] = useState('');

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
    autoReadingRef.current = autoReading;
  }, [autoReading]);

  useEffect(() => {
    setStudyLimit(8);
  }, [studyTab]);

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

    const matches = source.filter((item) => {
      const haystack = [
        item.abbreviation,
        item.localized_abbreviation,
        item.title,
        item.localized_title,
        item.language_tag,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });

    const platformUnavailable: BibleVersion[] = [
      { id: 'yv-public-1', abbreviation: 'KJV', localized_abbreviation: 'KJV', title: 'King James Version', localized_title: 'King James Version', provider: 'youversion', language_tag: 'en', available: false, accessStatus: 'platform_unavailable' },
      { id: 'yv-public-114', abbreviation: 'NKJV', localized_abbreviation: 'NKJV', title: 'New King James Version', localized_title: 'New King James Version', provider: 'youversion', language_tag: 'en', available: false, accessStatus: 'platform_unavailable' },
      { id: 'yv-public-68', abbreviation: 'GNT', localized_abbreviation: 'GNT', title: 'Good News Translation', localized_title: 'Good News Translation', provider: 'youversion', language_tag: 'en', available: false, accessStatus: 'platform_unavailable' },
      { id: 'yv-public-116', abbreviation: 'NLT', localized_abbreviation: 'NLT', title: 'New Living Translation', localized_title: 'New Living Translation', provider: 'youversion', language_tag: 'en', available: false, accessStatus: 'platform_unavailable' },
    ];

    for (const item of platformUnavailable) {
      const haystack = [item.abbreviation, item.title].filter(Boolean).join(' ').toLowerCase();
      const alreadyPresent = source.some((candidate) =>
        String(candidate.abbreviation || candidate.localized_abbreviation || '').toLowerCase() === String(item.abbreviation).toLowerCase()
      );
      if (!alreadyPresent && haystack.includes(needle)) matches.push(item);
    }

    return matches;
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

  const refreshPlans = () => {
    invalidate('bible:plans:');
    invalidate('bible:plan:');
    plans.refresh();
  };

  const beginPlanEditor = (plan?: PlanDetail | null) => {
    setPlanError('');
    setSelectedPlan(null);
    setPlanEditorId(plan?.is_personal ? plan.id : null);
    setPlanDraftTitle(plan?.title ?? '');
    setPlanDraftDescription(plan?.description ?? '');
    setPlanDraftDays(
      plan?.days?.length
        ? plan.days.map((day) => ({
            title: day.title || 'Day ' + day.day_number,
            references: (day.references ?? []).join(', '),
            reflection: day.reflection ?? '',
          }))
        : [{ title: 'Day 1', references: '', reflection: '' }],
    );
    setPlanEditorOpen(true);
  };

  const planMutation = async (body: Record<string, unknown>, key: string) => {
    if (planBusy) return null;
    setPlanBusy(key);
    setPlanError('');
    try {
      const result = await api.request<any>('noop?service=bible', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify(body),
      });
      refreshPlans();
      return result;
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Unable to update your reading plan.');
      return null;
    } finally {
      setPlanBusy('');
    }
  };

  const savePersonalPlan = async () => {
    if (!planDraftTitle.trim()) {
      setPlanError('Give your reading plan a title.');
      return;
    }
    const days = planDraftDays.map((day, index) => ({
      title: day.title.trim() || 'Day ' + (index + 1),
      references: day.references.split(',').map((item) => item.trim()).filter(Boolean),
      reflection: day.reflection.trim() || undefined,
    }));
    if (days.some((day) => !day.references.length)) {
      setPlanError('Every day needs at least one Bible reference.');
      return;
    }

    const saved = await planMutation({
      action: 'personal_plan_save',
      ...(planEditorId ? { planId: planEditorId } : {}),
      title: planDraftTitle.trim(),
      description: planDraftDescription.trim(),
      days,
    }, 'save');

    if (saved?.id) {
      setPlanEditorOpen(false);
      setPlanEditorId(null);
      setPlanListMode('mine');
      setSelectedPlan(saved.id);
    }
  };

  const customizeTemplate = async (planId: string) => {
    const copied = await planMutation({ action: 'clone_plan', planId }, 'clone:' + planId);
    if (copied?.id) {
      setPlanListMode('mine');
      beginPlanEditor(copied as PlanDetail);
    }
  };

  const removePersonalPlan = async (planId: string) => {
    const removed = await planMutation({ action: 'personal_plan_delete', planId }, 'delete:' + planId);
    if (removed?.deleted) {
      setSelectedPlan(null);
      setPlanEditorOpen(false);
      setPlanListMode('mine');
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
    speechPageRef.current = '';
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
    speechPageRef.current = '';
    setVersePage(0);
    setReference(buildReference(nextBook, 1));
  };

  const stopAutoReading = async () => {
    autoReadingRef.current = false;
    setAutoReading(false);
    speechPageRef.current = '';
    await Speech.stop();
    setSpeaking(false);
  };

  const advanceAfterSpeech = () => {
    if (!autoReadingRef.current) return;

    if (safeVersePage < totalVersePages - 1) {
      setVersePage((page) => Math.min(totalVersePages - 1, page + 1));
      return;
    }

    if (!parsed.book) {
      void stopAutoReading();
      return;
    }

    const list = books.data ?? [];
    const bookIndex = list.findIndex((item) => item.number === parsed.book!.number);

    if (parsed.chapter < parsed.book.chapters) {
      setVersePage(0);
      setReference(buildReference(parsed.book, parsed.chapter + 1));
      return;
    }

    const nextBook = list[bookIndex + 1];
    if (nextBook) {
      setVersePage(0);
      setReference(buildReference(nextBook, 1));
      return;
    }

    // Revelation is the natural end of the continuous Bible reading sequence.
    void stopAutoReading();
  };

  const speakCurrentPage = () => {
    if (!visibleText || speaking) return;

    const pageKey = versionId + ':' + visibleReference + ':' + visibleText;
    if (speechPageRef.current === pageKey) return;

    speechPageRef.current = pageKey;
    setSpeaking(true);

    Speech.speak(visibleText, {
      rate: speechRate,
      onDone: () => {
        setSpeaking(false);
        speechPageRef.current = '';
        advanceAfterSpeech();
      },
      onStopped: () => {
        setSpeaking(false);
        speechPageRef.current = '';
      },
      onError: () => {
        autoReadingRef.current = false;
        setAutoReading(false);
        setSpeaking(false);
        speechPageRef.current = '';
      },
    });
  };

  const speak = async () => {
    if (!visibleText) return;

    if (autoReading || speaking) {
      await stopAutoReading();
      return;
    }

    autoReadingRef.current = true;
    setAutoReading(true);
    speechPageRef.current = '';
    speakCurrentPage();
  };

  useEffect(() => {
    if (!autoReading || speaking || passage.loading || !passage.data || !visibleText) return;

    const loadedChapter = chapterReferenceOf(passage.data.reference);
    if (loadedChapter !== chapterReference) return;

    const timer = setTimeout(() => {
      if (autoReadingRef.current) speakCurrentPage();
    }, 120);

    return () => clearTimeout(timer);
  }, [
    autoReading,
    speaking,
    passage.loading,
    passage.data?.reference,
    visibleReference,
    visibleText,
    chapterReference,
    versionId,
    speechRate,
  ]);

  const cotLogoUri = Image.resolveAssetSource(require('../../../assets/icon.png')).uri;

  const prepareVerseCard = async () => {
    if (!passage.data || !visibleText) return '';
    setVerseCardBusy(true);
    setShareError('');
    try {
      const card = await bibleVerseCardPngDataUri({
        reference: visibleReference,
        text: visibleText,
        version: passage.data.abbreviation || versionId.toUpperCase(),
        logoUrl: cotLogoUri,
      });
      setVerseCardUri(card);
      return card;
    } catch (value) {
      setShareError(value instanceof Error ? value.message : 'Unable to prepare the Scripture card.');
      return '';
    } finally {
      setVerseCardBusy(false);
    }
  };

  const openVerseCard = async () => {
    setMoreToolsOpen(false);
    setVerseCardOpen(true);
    if (!verseCardUri) await prepareVerseCard();
  };

  const shareVerseExternal = async () => {
    if (!passage.data || !visibleText) return;
    const card = verseCardUri || await prepareVerseCard();
    const message =
      '“' + visibleText + '”\n— ' +
      visibleReference + ' ' + (passage.data.abbreviation || '') +
      '\nShared from COT Bible';
    try {
      await shareContent({
        title: visibleReference + ' · COT Bible',
        message,
        attachment: card ? {
          url: card,
          mimeType: card.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml',
          fileName: 'cot-' + visibleReference.toLowerCase().replace(/[^a-z0-9]+/g, '-') + (card.startsWith('data:image/png') ? '.png' : '.svg'),
        } : null,
      });
    } catch (value) {
      setShareError(value instanceof Error ? value.message : 'Unable to open sharing.');
    }
  };

  const shareToCot = () => {
    if (!passage.data || !visibleText) return;
    setMoreToolsOpen(false);
    setVerseCardOpen(false);
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
              onPress={() => {
                if (autoReadingRef.current) {
                  void Speech.stop();
                  setSpeaking(false);
                  speechPageRef.current = '';
                }
                setVersePage((page) => Math.max(0, page - 1));
              }}
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
              onPress={() => {
                if (autoReadingRef.current) {
                  void Speech.stop();
                  setSpeaking(false);
                  speechPageRef.current = '';
                }
                setVersePage((page) => Math.min(totalVersePages - 1, page + 1));
              }}
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
      <Pressable
        onPress={() => searchInputRef.current?.focus()}
        accessibilityRole="search"
        accessibilityLabel="Search the Bible"
        style={({ pressed }) => [
          styles.searchBar,
          {
            backgroundColor: colors.card,
            borderColor: searchInput ? colors.interactive : colors.borderSubtle,
          },
          pressed && { opacity: 0.94 },
        ]}
      >
        <View style={[styles.searchIconWrap, { backgroundColor: colors.bgSecondary }]}>
          <Icon name="search-outline" size={21} color={colors.interactive} />
        </View>
        <TextInput
          ref={searchInputRef}
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={() => setSearchQuery(searchInput.trim())}
          placeholder="Search love, faith, peace, or John 3:16"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
        />
        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            setSearchQuery(searchInput.trim());
          }}
          hitSlop={8}
          style={[styles.searchSubmit, { backgroundColor: colors.interactive }]}
          accessibilityRole="button"
          accessibilityLabel="Run Bible search"
        >
          <Icon name="arrow-forward" size={20} color={colors.bg} />
        </Pressable>
      </Pressable>
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

  const cataloguePlans = (plans.data ?? []).filter((plan) => !plan.is_personal);
  const personalPlans = (plans.data ?? []).filter((plan) => plan.is_personal);
  const visiblePlanList = planListMode === 'mine' ? personalPlans : cataloguePlans;

  const plansView = (
    <View style={styles.section}>
      {planEditorOpen ? (
        <>
          <Button label="Back to plans" variant="outline" size="sm" onPress={() => { setPlanEditorOpen(false); setPlanError(''); }} />
          <View style={[styles.planEditorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={styles.planEditorHeading}>
              <View style={[styles.planEditorHeroIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="create-outline" size={22} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.planTitle, { color: colors.text }]}>{planEditorId ? 'Edit your plan' : 'Create your plan'}</Text>
                <Text style={[styles.planEditorHelp, { color: colors.textMuted }]}>
                  Build a private plan from scratch or customize one of the COT templates.
                </Text>
              </View>
            </View>

            <View style={styles.planField}>
              <Text style={[styles.planFieldLabel, { color: colors.textMuted }]}>PLAN TITLE</Text>
              <TextInput
                value={planDraftTitle}
                onChangeText={setPlanDraftTitle}
                placeholder="My 14 days of prayer"
                placeholderTextColor={colors.textMuted}
                style={[styles.planInput, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
              />
            </View>
            <View style={styles.planField}>
              <Text style={[styles.planFieldLabel, { color: colors.textMuted }]}>DESCRIPTION</Text>
              <TextInput
                value={planDraftDescription}
                onChangeText={setPlanDraftDescription}
                placeholder="What do you want to focus on?"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.planInput, styles.planTextArea, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
              />
            </View>

            {planDraftDays.map((day, index) => (
              <View key={'plan-day-' + index} style={[styles.planDayEditor, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.planDayTitle, { color: colors.text }]}>Day {index + 1}</Text>
                  {planDraftDays.length > 1 ? (
                    <Pressable
                      onPress={() => setPlanDraftDays((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={'Remove day ' + (index + 1)}
                    >
                      <Icon name="trash-outline" size={17} color={colors.live} />
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={day.title}
                  onChangeText={(value) => setPlanDraftDays((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item))}
                  placeholder={'Day ' + (index + 1) + ' title'}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.planInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                />
                <TextInput
                  value={day.references}
                  onChangeText={(value) => setPlanDraftDays((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, references: value } : item))}
                  placeholder="John 3:16, Psalm 23:1-4"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.planInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                />
                <TextInput
                  value={day.reflection}
                  onChangeText={(value) => setPlanDraftDays((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reflection: value } : item))}
                  placeholder="Reflection or prayer prompt (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[styles.planInput, styles.planReflectionInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                />
              </View>
            ))}

            <Button
              label="Add another day"
              variant="outline"
              onPress={() => setPlanDraftDays((current) => [...current, { title: 'Day ' + (current.length + 1), references: '', reflection: '' }])}
            />
            {planError ? <Text style={[styles.planError, { color: colors.live }]}>{planError}</Text> : null}
            <Button label={planEditorId ? 'Save changes' : 'Create my plan'} loading={planBusy === 'save'} onPress={() => void savePersonalPlan()} />
          </View>
        </>
      ) : selectedPlan && planDetail.data ? (
        <>
          <Button label="Back to plans" variant="outline" size="sm" onPress={() => setSelectedPlan(null)} />
          <View style={styles.planDetailHeading}>
            <View style={styles.flex}>
              <View style={styles.planBadgeRow}>
                <View style={[styles.planBadge, { backgroundColor: planDetail.data.is_personal ? colors.primarySoft : colors.bgSecondary }]}>
                  <Text style={[styles.planBadgeText, { color: planDetail.data.is_personal ? colors.interactive : colors.textMuted }]}>
                    {planDetail.data.is_personal ? 'MY PLAN' : planDetail.data.plan_kind === 'ministry' ? 'COT PLAN' : 'TEMPLATE'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.planTitle, { color: colors.text }]}>{planDetail.data.title}</Text>
              <Text style={[styles.planDesc, { color: colors.textSecondary }]}>{planDetail.data.description}</Text>
            </View>
          </View>

          {mode === 'authenticated' ? (
            <View style={styles.planDetailActions}>
              {planDetail.data.is_personal ? (
                <>
                  <Button label="Edit my plan" variant="outline" size="sm" onPress={() => beginPlanEditor(planDetail.data)} />
                  <Button label="Delete" variant="outline" size="sm" loading={planBusy === 'delete:' + planDetail.data.id} onPress={() => void removePersonalPlan(planDetail.data!.id)} />
                </>
              ) : (
                <Button
                  label="Customize this plan"
                  variant="outline"
                  size="sm"
                  loading={planBusy === 'clone:' + planDetail.data.id}
                  onPress={() => void customizeTemplate(planDetail.data!.id)}
                />
              )}
            </View>
          ) : null}

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
        <>
          <View style={[styles.planHero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.planHeroIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="map-outline" size={24} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.planHeroTitle, { color: colors.text }]}>Reading plans</Text>
              <Text style={[styles.planHeroText, { color: colors.textMuted }]}>
                Follow a COT plan, choose a template, or build a private plan around what you want to study.
              </Text>
            </View>
          </View>

          <View style={styles.planToolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planModeChips}>
              <Chip label={'Catalogue · ' + cataloguePlans.length} selected={planListMode === 'catalogue'} onPress={() => setPlanListMode('catalogue')} />
              {mode === 'authenticated' ? (
                <Chip label={'My plans · ' + personalPlans.length} selected={planListMode === 'mine'} onPress={() => setPlanListMode('mine')} />
              ) : null}
            </ScrollView>
            {mode === 'authenticated' ? (
              <Button label="Create plan" size="sm" onPress={() => beginPlanEditor(null)} />
            ) : null}
          </View>

          {planListMode === 'mine' && mode !== 'authenticated' ? (
            <View style={[styles.signInCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Icon name="person-circle-outline" size={26} color={colors.interactive} />
              <Text style={[styles.resultTitle, { color: colors.text }]}>Sign in to create your own plans</Text>
              <Button label="Sign in" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/bible?tab=plans' } } as any)} />
            </View>
          ) : visiblePlanList.length ? (
            visiblePlanList.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => setSelectedPlan(plan.id)}
                style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}
              >
                <View style={[styles.planIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name={plan.is_personal ? 'create-outline' : 'map-outline'} size={21} color={colors.interactive} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.planCardTitleRow}>
                    <Text style={[styles.planTitleSmall, { color: colors.text }]} numberOfLines={1}>{plan.title}</Text>
                    <Text style={[styles.planKindText, { color: colors.textMuted }]}>
                      {plan.is_personal ? 'Mine' : plan.plan_kind === 'ministry' ? 'COT' : 'Template'}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={[styles.planDescSmall, { color: colors.textMuted }]}>{plan.description}</Text>
                  <Text style={[styles.planMeta, { color: colors.interactive }]}>{plan.duration_days} days</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          ) : (
            <View style={[styles.planEmpty, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Icon name="map-outline" size={26} color={colors.interactive} />
              <Text style={[styles.resultTitle, { color: colors.text }]}>
                {planListMode === 'mine' ? 'No personal plans yet' : 'No plans available'}
              </Text>
              <Text style={[styles.emptyHelp, { color: colors.textMuted }]}>
                {planListMode === 'mine' ? 'Create one from scratch or customize a template from the catalogue.' : 'Check back when reading plans are published.'}
              </Text>
              {planListMode === 'mine' ? <Button label="Create my first plan" size="sm" onPress={() => beginPlanEditor(null)} /> : null}
            </View>
          )}
        </>
      )}
    </View>
  );

  const bookmarkItems = (study.data?.bookmarks ?? []).map((item) => ({
    title: item.reference,
    meta: item.version_id,
    onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
  }));

  const highlightItems = (study.data?.highlights ?? []).map((item) => ({
    title: item.reference,
    meta: 'Highlight · ' + item.color_key,
    onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
  }));

  const noteItems = (study.data?.notes ?? []).map((item) => ({
    title: item.reference,
    meta: item.body,
    onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
  }));

  const historyItems = (study.data?.history ?? []).map((item) => ({
    title: item.reference,
    meta: 'Read ' + item.read_count + ' time' + (item.read_count === 1 ? '' : 's'),
    onPress: () => { setReference(item.reference); setVersionId(item.version_id); setTab('read'); },
  }));

  const activeStudyItems =
    studyTab === 'bookmarks' ? bookmarkItems :
    studyTab === 'highlights' ? highlightItems :
    studyTab === 'notes' ? noteItems :
    studyTab === 'history' ? historyItems :
    [];

  const activeStudyTitle =
    studyTab === 'bookmarks' ? 'Bookmarks' :
    studyTab === 'highlights' ? 'Highlights' :
    studyTab === 'notes' ? 'Notes' :
    studyTab === 'history' ? 'Reading history' :
    '';

  const activeStudyIcon =
    studyTab === 'bookmarks' ? 'bookmark-outline' :
    studyTab === 'highlights' ? 'color-palette-outline' :
    studyTab === 'notes' ? 'create-outline' :
    'time-outline';

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studyTabs}>
            <Chip label="Overview" selected={studyTab === 'overview'} onPress={() => setStudyTab('overview')} />
            <Chip label="Saved" selected={studyTab === 'bookmarks'} onPress={() => setStudyTab('bookmarks')} />
            <Chip label="Highlights" selected={studyTab === 'highlights'} onPress={() => setStudyTab('highlights')} />
            <Chip label="Notes" selected={studyTab === 'notes'} onPress={() => setStudyTab('notes')} />
            <Chip label="History" selected={studyTab === 'history'} onPress={() => setStudyTab('history')} />
            <Chip label="Settings" selected={studyTab === 'settings'} onPress={() => setStudyTab('settings')} />
          </ScrollView>

          {studyTab === 'overview' ? (
            <>
              <View style={[styles.myBibleHero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={[styles.myBibleHeroIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="book-outline" size={22} color={colors.interactive} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.myBibleHeroTitle, { color: colors.text }]}>My Bible</Text>
                  <Text style={[styles.myBibleHeroText, { color: colors.textMuted }]}>
                    Your saved Scripture, study notes and reading activity are organized here.
                  </Text>
                </View>
              </View>

              <View style={styles.studyDashboard}>
                <MyBibleSummaryCard
                  icon="bookmark-outline"
                  label="Saved"
                  count={bookmarkItems.length}
                  onPress={() => setStudyTab('bookmarks')}
                />
                <MyBibleSummaryCard
                  icon="color-palette-outline"
                  label="Highlights"
                  count={highlightItems.length}
                  onPress={() => setStudyTab('highlights')}
                />
                <MyBibleSummaryCard
                  icon="create-outline"
                  label="Notes"
                  count={noteItems.length}
                  onPress={() => setStudyTab('notes')}
                />
                <MyBibleSummaryCard
                  icon="time-outline"
                  label="History"
                  count={historyItems.length}
                  onPress={() => setStudyTab('history')}
                />
              </View>

              <Pressable
                onPress={() => setStudyTab('settings')}
                style={[styles.studySettingsShortcut, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
              >
                <View style={[styles.studySettingsIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="notifications-outline" size={18} color={colors.interactive} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.studySettingsTitle, { color: colors.text }]}>Daily Scripture settings</Text>
                  <Text style={[styles.studySettingsText, { color: colors.textMuted }]}>
                    Reminder {study.data?.preferences?.daily_scripture_notification ? 'on' : 'off'} · {study.data?.preferences?.notification_time?.slice(0,5) || '07:00'}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={17} color={colors.textMuted} />
              </Pressable>

              {historyItems.length ? (
                <View style={[styles.recentStudyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.resultTitle, { color: colors.text }]}>Recent reading</Text>
                    <Pressable onPress={() => setStudyTab('history')}>
                      <Text style={[styles.studySeeAll, { color: colors.interactive }]}>See all</Text>
                    </Pressable>
                  </View>
                  {historyItems.slice(0, 3).map((item, index) => (
                    <Pressable key={item.title + '-' + index} onPress={item.onPress} style={[styles.studyRow, { borderBottomColor: colors.borderSubtle }]}>
                      <View style={styles.flex}>
                        <Text style={[styles.studyTitle, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.studyMeta, { color: colors.textMuted }]}>{item.meta}</Text>
                      </View>
                      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {studyTab === 'settings' ? (
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <View style={styles.sectionHeading}>
                <Icon name="notifications-outline" size={18} color={colors.interactive} />
                <Text style={[styles.resultTitle, { color: colors.text }]}>Daily Scripture reminder</Text>
              </View>
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
          ) : null}

          {activeStudyTitle ? (
            <View style={[styles.studyListCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <StudySection
                title={activeStudyTitle}
                icon={activeStudyIcon}
                items={activeStudyItems.slice(0, studyLimit)}
              />
              {activeStudyItems.length > studyLimit ? (
                <Button
                  label={'Show more (' + (activeStudyItems.length - studyLimit) + ')'}
                  variant="outline"
                  size="sm"
                  onPress={() => setStudyLimit((value) => value + 8)}
                />
              ) : null}
            </View>
          ) : null}
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
          <ReaderDockAction icon={autoReading ? 'stop-circle-outline' : 'volume-high-outline'} label={autoReading ? 'Stop' : 'Listen'} active={autoReading} onPress={() => void speak()} />
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
          <Text style={[styles.versionSearchLabel, { color: colors.textMuted }]}>SEARCH TRANSLATIONS</Text>
          <Pressable onPress={() => versionSearchRef.current?.focus()} accessibilityRole="search" accessibilityLabel="Search Bible translations" style={({ pressed }) => [styles.versionSearch, { backgroundColor: colors.bgSecondary, borderColor: versionSearch ? colors.interactive : colors.borderSubtle }, pressed && { opacity: 0.92 }]}>
            <View style={[styles.versionSearchIcon, { backgroundColor: colors.card }]}>
              <Icon name="search-outline" size={20} color={colors.interactive} />
            </View>
            <TextInput ref={versionSearchRef} value={versionSearch} onChangeText={setVersionSearch} placeholder="Search KJV, NKJV, NIV, NLT, GNT…" placeholderTextColor={colors.textMuted} autoCapitalize="characters" returnKeyType="search" style={[styles.versionSearchInput, { color: colors.text }]} />
            {versionSearch ? <Pressable onPress={(event) => { event.stopPropagation?.(); setVersionSearch(''); versionSearchRef.current?.focus(); }} hitSlop={10} style={styles.versionSearchClear} accessibilityRole="button" accessibilityLabel="Clear translation search"><Icon name="close-circle" size={21} color={colors.textMuted} /></Pressable> : null}
          </Pressable>
          <View style={styles.languageRow}>
            <View style={styles.languageCopy}>
              <Text style={[styles.languageTitle, { color: colors.text }]}>Language</Text>
              <Text style={[styles.languageHelp, { color: colors.textMuted }]}>Narrow the catalogue only when you need another language.</Text>
            </View>
            <TextInput value={language} onChangeText={setLanguage} placeholder="en" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={[styles.languageInput, { color: colors.text, borderColor: colors.borderSubtle, backgroundColor: colors.bgSecondary }]} />
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
                      : item.accessStatus === 'platform_unavailable'
                        ? 'Available in the YouVersion Bible App, but not exposed through the YouVersion Platform API to COT'
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
              No translation matches this search in the YouVersion Platform catalogue currently exposed to COT.
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
            <ReaderAction icon="share-social-outline" label="Share external" onPress={() => { setMoreToolsOpen(false); void shareVerseExternal(); }} />
            <ReaderAction icon="image-outline" label="Verse card" onPress={() => void openVerseCard()} />
            <ReaderAction icon="people-outline" label="Share to COT" onPress={shareToCot} />
          </View>
          <View style={[styles.autoReadInfo, { backgroundColor: colors.primarySoft }]}>
            <Icon name="play-forward-circle-outline" size={18} color={colors.interactive} />
            <View style={styles.flex}>
              <Text style={[styles.autoReadTitle, { color: colors.text }]}>Continuous Bible reading</Text>
              <Text style={[styles.autoReadText, { color: colors.textMuted }]}>
                Listen continues automatically through the next verses, chapter and book until you stop it.
              </Text>
            </View>
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

      <BottomSheet visible={verseCardOpen} onClose={() => { setVerseCardOpen(false); setShareError(''); }} title="Scripture card" subtitle="Ready to post or share anywhere" maxHeightPercent={92}>
        <View style={styles.shareCardSheet}>
          {verseCardBusy ? (
            <Skeleton height={320} borderRadius={radius.xl} />
          ) : verseCardUri ? (
            <View style={[styles.shareCardFrame, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, shadows.sm]}>
              <Image source={{ uri: verseCardUri }} style={styles.shareCardImage} resizeMode="contain" />
            </View>
          ) : (
            <Button label="Generate card" onPress={() => void prepareVerseCard()} />
          )}
          {shareError ? <Text style={[styles.shareCardError, { color: colors.live }]}>{shareError}</Text> : null}
          <View style={styles.shareCardActions}>
            <Button label="Share externally" variant="outline" onPress={() => void shareVerseExternal()} />
            <Button label="Share to COT" onPress={shareToCot} />
          </View>
          <Text style={[styles.shareCardHint, { color: colors.textMuted }]}>The shared card includes the Scripture reference, selected Bible version and COT identity.</Text>
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

function MyBibleSummaryCard({ icon, label, count, onPress }: { icon: string; label: string; count: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.studySummaryCard,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.studySummaryIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={18} color={colors.interactive} />
      </View>
      <Text style={[styles.studySummaryCount, { color: colors.text }]}>{count}</Text>
      <Text style={[styles.studySummaryLabel, { color: colors.textMuted }]}>{label}</Text>
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
  shareCardSheet: { gap: spacing.md },
  shareCardFrame: { width: '100%', maxWidth: 520, alignSelf: 'center', aspectRatio: 1, borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  shareCardImage: { width: '100%', height: '100%' },
  shareCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shareCardError: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  shareCardHint: { fontSize: 9.5, lineHeight: 14 },
  moreTools: { gap: spacing.md },
  moreToolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  autoReadInfo: { borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  autoReadTitle: { fontSize: 10.5, fontWeight: '900' },
  autoReadText: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  audioWrap: { marginTop: 2 },
  audioHint: { fontSize: 10.5, lineHeight: 16 },
  compareCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: 8 },
  compareTitle: { fontSize: 12, fontWeight: '900' },
  compareText: { fontSize: 14, lineHeight: 22 },
  error: { fontSize: 11, lineHeight: 16 },
  searchBar: { minHeight: 64, borderWidth: 1.5, borderRadius: radius.xl, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 60, fontSize: 16, lineHeight: 22, paddingVertical: 12, paddingHorizontal: 2 },
  searchSubmit: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
  planHero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planHeroIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  planHeroTitle: { fontSize: 16, fontWeight: '900' },
  planHeroText: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  planToolbar: { gap: spacing.sm },
  planModeChips: { gap: 7, paddingRight: spacing.md },
  planCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  planKindText: { fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  planDetailHeading: { gap: 7 },
  planDetailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  planBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  planBadge: { minHeight: 24, borderRadius: radius.pill, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  planBadgeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  planEditorCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  planEditorHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planEditorHeroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  planEditorHelp: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  planField: { gap: 5 },
  planFieldLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  planInput: { minHeight: 46, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, fontSize: 13 },
  planTextArea: { minHeight: 86, paddingTop: 11, paddingBottom: 11, textAlignVertical: 'top' },
  planReflectionInput: { minHeight: 74, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' },
  planDayEditor: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: 8 },
  planError: { fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  planEmpty: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-start' },
  signInCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-start' },
  settingsCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  settingLabel: { fontSize: 11.5, fontWeight: '800' },
  studyTabs: { gap: 7, paddingRight: spacing.md },
  myBibleHero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  myBibleHeroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  myBibleHeroTitle: { fontSize: 16, fontWeight: '900' },
  myBibleHeroText: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  studyDashboard: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  studySummaryCard: { width: '48.5%', minHeight: 112, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, justifyContent: 'space-between' },
  studySummaryIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  studySummaryCount: { fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 8 },
  studySummaryLabel: { fontSize: 10.5, fontWeight: '800' },
  studySettingsShortcut: { minHeight: 68, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  studySettingsIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  studySettingsTitle: { fontSize: 12, fontWeight: '900' },
  studySettingsText: { fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  recentStudyCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 2 },
  studySeeAll: { fontSize: 10, fontWeight: '900' },
  studyListCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
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
  versionFilters: { gap: 10, marginBottom: spacing.sm },
  versionSearchLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9, marginLeft: 2 },
  versionSearch: { minHeight: 62, borderWidth: 1.5, borderRadius: radius.xl, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  versionSearchIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  versionSearchInput: { flex: 1, minWidth: 0, minHeight: 58, fontSize: 16, lineHeight: 22, paddingVertical: 12, paddingHorizontal: 2 },
  versionSearchClear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  languageRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  languageCopy: { flex: 1, minWidth: 0 },
  languageTitle: { fontSize: 10.5, fontWeight: '900' },
  languageHelp: { fontSize: 8.5, lineHeight: 12, marginTop: 1 },
  languageInput: { width: 76, minHeight: 44, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 10, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  versionScroll: { maxHeight: 460 },
  versionRow: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  versionBadge: { width: 48, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  versionBadgeText: { fontSize: 10.5, fontWeight: '900' },
  versionTitle: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  versionMeta: { fontSize: 9.5, marginTop: 2 },
  noteInput: { minHeight: 150, maxHeight: 280, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, textAlignVertical: 'top', fontSize: 13, lineHeight: 20 },
});

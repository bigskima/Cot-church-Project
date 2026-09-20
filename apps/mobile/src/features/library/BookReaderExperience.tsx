import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, Icon, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { PdfBookFrame } from './PdfBookFrame';
import type { BookChapter, BookDetailPayload } from './library-types';

function paginate(body: string, target = 1250) {
  const paragraphs = body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const pages: string[] = [];
  let current = '';
  const push = () => { if (current.trim()) pages.push(current.trim()); current = ''; };
  for (const paragraph of paragraphs) {
    if ((current.length + paragraph.length + 2) <= target) {
      current += `${current ? '\n\n' : ''}${paragraph}`;
      continue;
    }
    push();
    if (paragraph.length <= target * 1.35) {
      current = paragraph;
      continue;
    }
    const words = paragraph.split(/\s+/);
    for (const word of words) {
      if ((current.length + word.length + 1) > target) push();
      current += `${current ? ' ' : ''}${word}`;
    }
  }
  push();
  return pages.length ? pages : [''];
}

function chapterIndexFor(chapters: BookChapter[], order?: number | null) {
  const index = chapters.findIndex((chapter) => chapter.chapter_order === Number(order ?? 0));
  return index >= 0 ? index : 0;
}

export function BookReaderExperience({ bookId }: { bookId: string }) {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const endpoint = `library${organizationId ? `?organizationId=${organizationId}` : ''}`;
  const detail = useResource<BookDetailPayload>(
    `library:book:${bookId}:${organizationId || 'public'}`,
    (signal) => api.request<BookDetailPayload>(
      `library?view=detail&bookId=${bookId}${organizationId ? `&organizationId=${organizationId}` : ''}`,
      { signal, context: 'public' },
    ),
  );
  const chapters = detail.data?.chapters ?? [];
  const initialChapter = chapterIndexFor(chapters, detail.data?.progress?.chapter_order);
  const [chapterIndex, setChapterIndex] = useState(initialChapter);
  const [pageIndex, setPageIndex] = useState(Number(detail.data?.progress?.page_index ?? 0));
  const [speaking, setSpeaking] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (!detail.data) return;
    setChapterIndex(chapterIndexFor(detail.data.chapters, detail.data.progress?.chapter_order));
    setPageIndex(Number(detail.data.progress?.page_index ?? 0));
  }, [detail.data?.book.id]);

  const chapter = chapters[chapterIndex];
  const pages = useMemo(() => paginate(chapter?.body ?? ''), [chapter?.id, chapter?.body]);
  const safePageIndex = Math.min(Math.max(0, pageIndex), Math.max(0, pages.length - 1));
  const page = pages[safePageIndex] ?? '';
  const totalPagesBefore = chapters.slice(0, chapterIndex).reduce((sum, item) => sum + paginate(item.body).length, 0);
  const totalPages = Math.max(1, chapters.reduce((sum, item) => sum + paginate(item.body).length, 0));
  const absolutePage = Math.min(totalPages, totalPagesBefore + safePageIndex + 1);
  const progressPercent = Math.round((absolutePage / totalPages) * 100);

  useEffect(() => () => { Speech.stop(); }, []);

  useEffect(() => {
    if (!detail.data || mode !== 'authenticated' || detail.data.book.source_format !== 'epub' || !chapter) return;
    const timer = setTimeout(() => {
      void api.request(endpoint, {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          action: 'progress',
          bookId,
          chapterOrder: chapter.chapter_order,
          pageIndex: safePageIndex,
          progressPercent,
        }),
      }).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [api, bookId, chapter?.chapter_order, detail.data?.book.source_format, endpoint, mode, progressPercent, safePageIndex]);

  const speak = async () => {
    if (!page.trim()) return;
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    await Speech.stop();
    setSpeaking(true);
    Speech.speak(page, { rate: 0.92, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const move = (direction: 1 | -1) => {
    void Speech.stop();
    setSpeaking(false);
    if (direction > 0) {
      if (safePageIndex < pages.length - 1) setPageIndex(safePageIndex + 1);
      else if (chapterIndex < chapters.length - 1) { setChapterIndex(chapterIndex + 1); setPageIndex(0); }
    } else {
      if (safePageIndex > 0) setPageIndex(safePageIndex - 1);
      else if (chapterIndex > 0) {
        const previous = chapters[chapterIndex - 1];
        setChapterIndex(chapterIndex - 1);
        setPageIndex(Math.max(0, paginate(previous.body).length - 1));
      }
    }
  };

  const submitReview = async () => {
    if (mode !== 'authenticated' || reviewBusy) return;
    setReviewBusy(true);
    setReviewError('');
    try {
      await api.request(endpoint, {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ action: 'review', bookId, rating, body: reviewBody.trim() }),
      });
      setReviewBody('');
      invalidate(`library:book:${bookId}`);
      detail.refresh();
    } catch (value) {
      setReviewError(value instanceof Error ? value.message : 'Unable to save your review.');
    } finally {
      setReviewBusy(false);
    }
  };

  if (detail.loading && !detail.data) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}><View style={styles.loading}><Skeleton height={48} borderRadius={18} /><Skeleton height={520} borderRadius={20} /></View></View>;
  if (!detail.data) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title='Book unavailable' message={detail.error || 'This book could not be opened.'} iconName='book-outline' /><Pressable onPress={() => router.back()}><Text style={{ color: colors.interactive, fontWeight: '900' }}>Back to Library</Text></Pressable></View>;

  const { book, reviews } = detail.data;
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 }]}>
        <ScreenHeader title={book.title} showBack compact />
        <View style={styles.bookHeading}>
          <Text style={[styles.bookTitle, { color: colors.text }]}>{book.title}</Text>
          {book.subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{book.subtitle}</Text> : null}
          <Text style={[styles.author, { color: colors.textSecondary }]}>by {book.author_name}</Text>
        </View>

        {book.source_format === 'pdf' ? (
          <View style={styles.pdfBlock}>
            {book.source_url ? <PdfBookFrame url={book.source_url} /> : <EmptyState title='PDF unavailable' message='The secure book file could not be prepared.' iconName='document-outline' />}
            <View style={[styles.note, { backgroundColor: colors.bgSecondary }]}>
              <Icon name='volume-high-outline' size={16} color={colors.textMuted} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>Read aloud is available for EPUB text. A PDF keeps its original page design; scanned PDFs are not treated as readable text.</Text>
            </View>
          </View>
        ) : !chapter ? (
          <EmptyState title='Book is being prepared' message='Readable chapters are not available yet.' iconName='hourglass-outline' />
        ) : (
          <>
            <View style={styles.readerToolbar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapterStrip}>
                {chapters.map((item, index) => (
                  <Pressable key={item.id} onPress={() => { setChapterIndex(index); setPageIndex(0); }} style={[styles.chapterChip, { backgroundColor: index === chapterIndex ? colors.text : colors.card, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.chapterChipText, { color: index === chapterIndex ? colors.bg : colors.textSecondary }]} numberOfLines={1}>{item.title || `Chapter ${index + 1}`}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.toolbarRow}>
                <Text style={[styles.progress, { color: colors.textMuted }]}>{progressPercent}% · page {safePageIndex + 1}/{pages.length}</Text>
                <Pressable onPress={() => void speak()} style={[styles.speak, { backgroundColor: speaking ? colors.primarySoft : colors.card, borderColor: colors.borderSubtle }]}>
                  <Icon name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={16} color={colors.interactive} />
                  <Text style={[styles.speakText, { color: colors.interactive }]}>{speaking ? 'Stop' : 'Read aloud'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.page, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <Text style={[styles.chapterTitle, { color: colors.text }]}>{chapter.title || `Chapter ${chapterIndex + 1}`}</Text>
              <Text style={[styles.pageText, { color: colors.text }]}>{page}</Text>
              <Text style={[styles.pageNumber, { color: colors.textMuted }]}>{absolutePage}</Text>
            </View>
            <View style={styles.paging}>
              <Pressable onPress={() => move(-1)} disabled={chapterIndex === 0 && safePageIndex === 0} style={[styles.pageButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, chapterIndex === 0 && safePageIndex === 0 && styles.disabled]}>
                <Icon name='chevron-back' size={18} color={colors.text} /><Text style={[styles.pageButtonText, { color: colors.text }]}>Previous</Text>
              </Pressable>
              <Pressable onPress={() => move(1)} disabled={chapterIndex === chapters.length - 1 && safePageIndex === pages.length - 1} style={[styles.pageButton, { backgroundColor: colors.text }, chapterIndex === chapters.length - 1 && safePageIndex === pages.length - 1 && styles.disabled]}>
                <Text style={[styles.pageButtonText, { color: colors.bg }]}>Next</Text><Icon name='chevron-forward' size={18} color={colors.bg} />
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.reviewSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews</Text>
          {mode === 'authenticated' ? (
            <View style={[styles.reviewComposer, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <View style={styles.ratingRow}>{[1,2,3,4,5].map((value) => <Pressable key={value} onPress={() => setRating(value)}><Text style={[styles.star, { color: value <= rating ? colors.interactive : colors.textMuted }]}>★</Text></Pressable>)}</View>
              <TextInput value={reviewBody} onChangeText={setReviewBody} multiline placeholder='Share a short review (optional)' placeholderTextColor={colors.textMuted} style={[styles.reviewInput, { color: colors.text, borderColor: colors.borderSubtle }]} />
              {reviewError ? <Text style={[styles.reviewError, { color: colors.live }]}>{reviewError}</Text> : null}
              <Pressable disabled={reviewBusy} onPress={() => void submitReview()} style={[styles.submitReview, { backgroundColor: colors.text }]}><Text style={[styles.submitReviewText, { color: colors.bg }]}>{reviewBusy ? 'Saving…' : 'Post review'}</Text></Pressable>
            </View>
          ) : null}
          {!reviews.length ? <Text style={[styles.noReviews, { color: colors.textMuted }]}>No reviews yet.</Text> : reviews.map((review) => (
            <View key={review.id} style={[styles.review, { borderBottomColor: colors.borderSubtle }]}>
              <Avatar url={review.profile?.avatar_url ?? undefined} name={review.profile?.display_name || review.profile?.username || 'Member'} size='sm' />
              <View style={styles.reviewCopy}><View style={styles.reviewHead}><Text style={[styles.reviewer, { color: colors.text }]}>{review.profile?.display_name || review.profile?.username || 'COT member'}</Text><Text style={[styles.reviewStars, { color: colors.interactive }]}>{'★'.repeat(review.rating)}</Text></View>{review.body ? <Text style={[styles.reviewText, { color: colors.textSecondary }]}>{review.body}</Text> : null}</View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.lg, maxWidth: 920, width: '100%', alignSelf: 'center' },
  loading: { paddingHorizontal: spacing.md, gap: spacing.md },
  bookHeading: { gap: 3 }, bookTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.5 }, subtitle: { fontSize: 13 }, author: { fontSize: 12, fontWeight: '700' },
  pdfBlock: { gap: spacing.sm }, note: { borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, noteText: { flex: 1, fontSize: 10.5, lineHeight: 15 },
  readerToolbar: { gap: spacing.sm }, chapterStrip: { gap: 6 }, chapterChip: { maxWidth: 180, height: 32, borderWidth: 1, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 11 }, chapterChipText: { fontSize: 9.5, fontWeight: '800' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, progress: { fontSize: 10.5, fontWeight: '800' }, speak: { height: 34, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11 }, speakText: { fontSize: 10, fontWeight: '900' },
  page: { minHeight: 560, borderWidth: 1, borderRadius: 22, paddingHorizontal: 24, paddingVertical: 30, justifyContent: 'flex-start' },
  chapterTitle: { fontSize: 19, lineHeight: 25, fontWeight: '900', marginBottom: 22 }, pageText: { fontSize: 16, lineHeight: 27, letterSpacing: 0.05 }, pageNumber: { textAlign: 'center', fontSize: 10, marginTop: 28 },
  paging: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, pageButton: { flex: 1, height: 46, borderWidth: 1, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, pageButtonText: { fontSize: 11, fontWeight: '900' }, disabled: { opacity: 0.35 },
  reviewSection: { gap: spacing.md, marginTop: spacing.md }, sectionTitle: { fontSize: 18, fontWeight: '900' }, reviewComposer: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, ratingRow: { flexDirection: 'row', gap: 5 }, star: { fontSize: 25 }, reviewInput: { minHeight: 82, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, textAlignVertical: 'top' }, reviewError: { fontSize: 10.5 }, submitReview: { alignSelf: 'flex-end', height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, submitReviewText: { fontSize: 10.5, fontWeight: '900' },
  noReviews: { fontSize: 12 }, review: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, reviewCopy: { flex: 1, minWidth: 0 }, reviewHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, reviewer: { fontSize: 11.5, fontWeight: '900' }, reviewStars: { fontSize: 10 }, reviewText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
});

import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Icon, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { LibraryBook } from './library-types';

function coverInitials(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 3).map((word) => word[0]?.toUpperCase()).join('');
}

export function LibraryExperience() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const [search, setSearch] = useState('');
  const query = search.trim();
  const books = useResource<LibraryBook[]>(
    `library:list:${organizationId || 'public'}:${query.toLowerCase()}`,
    (signal) => api.request<LibraryBook[]>(
      `library?view=list${organizationId ? `&organizationId=${organizationId}` : ''}${query ? `&search=${encodeURIComponent(query)}` : ''}`,
      { signal, context: 'public' },
    ),
  );
  const list = books.data ?? [];
  const continueReading = useMemo(() => list.filter((book) => Number(book.progress?.progress_percent ?? 0) > 0 && Number(book.progress?.progress_percent ?? 0) < 100), [list]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 }]}>
        <ScreenHeader title='Library' showBack compact />
        <Pressable onPress={() => router.push('/general/devotional' as any)} style={[styles.devotionalCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={[styles.devotionalIcon, { backgroundColor: colors.card }]}><Icon name='sunny-outline' size={22} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.devotionalTitle, { color: colors.text }]}>Daily Devotional</Text>
            <Text style={[styles.devotionalCopy, { color: colors.textSecondary }]}>Open today’s reading, prayer and scripture.</Text>
          </View>
          <Icon name='chevron-forward' size={19} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Icon name='search' size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder='Search books or authors'
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCorrect={false}
          />
        </View>

        {continueReading.length ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Continue reading</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
              {continueReading.map((book) => <BookCard key={book.id} book={book} compact />)}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{query ? 'Search results' : 'Browse books'}</Text>
            {list.length ? <Text style={[styles.count, { color: colors.textMuted }]}>{list.length}</Text> : null}
          </View>
          {books.loading && !books.data ? (
            <View style={styles.grid}>{Array.from({ length: 6 }).map((_, i) => <View key={i} style={styles.gridItem}><Skeleton height={190} borderRadius={18} /><Skeleton height={13} width='80%' borderRadius={6} /></View>)}</View>
          ) : books.error && !books.data ? (
            <Pressable onPress={books.refresh}><EmptyState title='Library unavailable' message='Tap to try loading the Library again.' iconName='refresh-outline' /></Pressable>
          ) : !list.length ? (
            <EmptyState title={query ? 'No matching book' : 'No published books yet'} message={query ? 'Try another title or author.' : 'Published books will appear here.'} iconName='library-outline' />
          ) : (
            <View style={styles.grid}>{list.map((book) => <BookCard key={book.id} book={book} />)}</View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function BookCard({ book, compact = false }: { book: LibraryBook; compact?: boolean }) {
  const { colors } = useTheme();
  const progress = Math.round(Number(book.progress?.progress_percent ?? 0));
  return (
    <Pressable onPress={() => router.push(`/general/library/${book.id}` as any)} style={[compact ? styles.compactCard : styles.gridItem, { backgroundColor: colors.bg }]}>
      <View style={[styles.cover, compact && styles.compactCover, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        {book.cover_url ? <Image source={{ uri: book.cover_url }} style={styles.coverImage} resizeMode='cover' /> : (
          <View style={styles.coverFallback}><Icon name='book-outline' size={24} color={colors.interactive} /><Text style={[styles.initials, { color: colors.text }]}>{coverInitials(book.title)}</Text></View>
        )}
        {book.source_format === 'pdf' ? <View style={styles.formatBadge}><Text style={styles.formatText}>PDF</Text></View> : null}
      </View>
      <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
      <Text style={[styles.author, { color: colors.textSecondary }]} numberOfLines={1}>{book.author_name}</Text>
      <View style={styles.metaRow}>
        {book.review_average ? <Text style={[styles.meta, { color: colors.textMuted }]}>★ {book.review_average}</Text> : null}
        {progress > 0 ? <Text style={[styles.meta, { color: colors.interactive }]}>{progress}%</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.lg, maxWidth: 1180, width: '100%', alignSelf: 'center' },
  devotionalCard: { minHeight: 76, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  devotionalIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  devotionalTitle: { fontSize: 15, fontWeight: '900' },
  devotionalCopy: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  flex: { flex: 1, minWidth: 0 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  count: { fontSize: 11, fontWeight: '800' },
  horizontal: { gap: spacing.md, paddingRight: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, rowGap: spacing.lg },
  gridItem: { width: '33.333%', minWidth: 120, paddingHorizontal: 6, gap: 5 },
  compactCard: { width: 122, gap: 5 },
  cover: { width: '100%', aspectRatio: 0.68, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  compactCover: { width: 122, height: 174 },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  initials: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  formatBadge: { position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
  formatText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  bookTitle: { fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  author: { fontSize: 10.5 },
  metaRow: { minHeight: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 9.5, fontWeight: '800' },
});

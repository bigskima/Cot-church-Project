import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, InputField, ResourceError, ScreenHeader, SermonCard, Skeleton } from '@/components';
import { spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';

export default function GeneralSermonsScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  const sermons = useResource<Sermon[]>(
    `general:sermons:${organizationId || 'auto'}:${mode}`,
    (signal) => {
      const suffix = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : '';
      return api.request<Sermon[]>(`public-content?type=sermons${suffix}`, { signal, context: 'public' });
    },
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sermons.data ?? [];
    return (sermons.data ?? []).filter((sermon) => [
      sermon.title,
      sermon.preacher,
      sermon.description,
      ...(sermon.scripture_references ?? []),
      ...(sermon.topics ?? []),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)));
  }, [query, sermons.data]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 130, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={sermons.refreshing} onRefresh={sermons.refresh} tintColor={colors.interactive} />}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ScreenHeader title="Sermons" kicker="GENERAL COT" subtitle="Browse every published message without returning to Home." showBack />
            <InputField label="Find a sermon" value={query} onChangeText={setQuery} placeholder="Search title, preacher, scripture or topic" autoCapitalize="none" />
            {!sermons.loading && sermons.data ? <Text style={[styles.count, { color: colors.textMuted }]}>{visible.length} {visible.length === 1 ? 'message' : 'messages'}</Text> : null}
            {sermons.loading && !sermons.data ? <Skeleton height={112} count={3} /> : null}
            {sermons.error && !sermons.data ? <ResourceError message={sermons.error} retry={sermons.refresh} /> : null}
          </View>
        )}
        renderItem={({ item }) => <SermonCard sermon={item} variant="row" onPress={() => router.push(`/general/sermon/${item.id}` as any)} />}
        ListEmptyComponent={!sermons.loading && !sermons.error ? <EmptyState title={query.trim() ? 'No sermon matches that search' : 'No sermons yet'} message={query.trim() ? 'Try a title, preacher, scripture reference or topic.' : 'Published General COT sermons will appear here.'} iconName="book-outline" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  count: { fontSize: 11, fontWeight: '700' },
});

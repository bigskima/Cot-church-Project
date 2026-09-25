import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip, EmptyState, InputField, ResourceError, ScreenHeader, SermonCard, Skeleton } from '@/components';
import { spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';

type Scope = 'general' | 'expression';
type MediaTab = 'audio' | 'video';

function hasAudio(item: Sermon) {
  return Boolean(item.audio_url || item.audio_asset_id);
}

function hasVideo(item: Sermon) {
  return Boolean(item.video_url || item.video_asset_id);
}

export function PastorMessagesScreen({ scope, expressionId }: { scope: Scope; expressionId?: string }) {
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const [tab, setTab] = useState<MediaTab>('audio');
  const [query, setQuery] = useState('');

  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const expression = expressionId
    ? context?.expressions?.find((item) => item.id === expressionId)
    : null;

  const resource = useResource<Sermon[]>(
    `pastor-messages:${scope}:${organizationId || 'auto'}:${expressionId || 'general'}:${mode}`,
    (signal) => {
      if (scope === 'expression') {
        const params = new URLSearchParams();
        if (organizationId) params.set('organizationId', organizationId);
        if (expressionId) params.set('expressionId', expressionId);
        return api.request<{ sermons?: Sermon[] }>(`home-feed?${params.toString()}`, { signal })
          .then((payload) => payload.sermons ?? []);
      }
      const suffix = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : '';
      return api.request<Sermon[]>(`public-content?type=sermons${suffix}`, { signal, context: 'public' });
    },
  );

  const messages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (resource.data ?? [])
      .filter((item) => tab === 'audio' ? hasAudio(item) : hasVideo(item))
      .filter((item) => !normalized || [
        item.title,
        item.preacher,
        item.description,
        ...(item.scripture_references ?? []),
        ...(item.topics ?? []),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)));
  }, [query, resource.data, tab]);

  const audioCount = (resource.data ?? []).filter(hasAudio).length;
  const videoCount = (resource.data ?? []).filter(hasVideo).length;
  const baseRoute = scope === 'expression' ? `/expressions/${expressionId}/sermons` : '/general/sermon';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              title="Pastor’s Messages"
              kicker={scope === 'expression' ? expression?.name?.toUpperCase() || 'EXPRESSION' : 'GENERAL COT'}
              subtitle="Pastoral teaching recordings, separate from the community feed, Watch and Reels."
              showBack
            />
            <View style={styles.tabs}>
              <Chip label="Audio" selected={tab === 'audio'} onPress={() => setTab('audio')} count={audioCount} />
              <Chip label="Videos" selected={tab === 'video'} onPress={() => setTab('video')} count={videoCount} />
            </View>
            <InputField label="Search messages" value={query} onChangeText={setQuery} placeholder="Title, pastor, scripture or topic" autoCapitalize="none" />
            {!resource.loading && resource.data ? (
              <Text style={[styles.count, { color: colors.textMuted }]}>
                {messages.length} {messages.length === 1 ? 'message' : 'messages'} in {tab === 'audio' ? 'Audio' : 'Videos'}
              </Text>
            ) : null}
            {resource.loading && !resource.data ? <Skeleton height={112} count={3} /> : null}
            {resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <SermonCard
              sermon={item}
              variant="row"
              onPress={() => router.push(
                scope === 'expression'
                  ? `${baseRoute}/${item.id}`
                  : `${baseRoute}/${item.id}`,
              )}
            />
          </View>
        )}
        ListEmptyComponent={
          !resource.loading && !resource.error ? (
            <EmptyState
              title={query.trim() ? 'No messages match that search' : `No ${tab === 'audio' ? 'audio' : 'video'} messages yet`}
              message={scope === 'expression'
                ? 'Messages published specifically for this Expression will appear here.'
                : 'Published pastoral recordings from COT will appear here.'}
              iconName={tab === 'audio' ? 'headset-outline' : 'videocam-outline'}
            />
          ) : null
        }
      />
    </View>
  );
}

export default function GeneralPastorMessagesScreen() {
  return <PastorMessagesScreen scope="general" />;
}

export function ExpressionPastorMessagesScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  return <PastorMessagesScreen scope="expression" expressionId={id} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 130 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  count: { fontSize: 11, fontWeight: '700' },
  item: { marginBottom: spacing.sm },
});

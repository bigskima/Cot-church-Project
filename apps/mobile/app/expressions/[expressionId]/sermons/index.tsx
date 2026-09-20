import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState, ResourceError, SermonCard, Skeleton } from '@/components';
import { ExpressionMediaHeader } from '@/components/expression/ExpressionMediaHeader';
import { spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';

type Payload = { sermons: Sermon[] };

export default function ExpressionSermonsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';
  const expressionName = context?.expression?.id === id ? context.expression.name : membership?.name ?? 'this Expression';

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (id) params.set('expressionId', id);
    return `home-feed?${params.toString()}`;
  }, [id, organizationId]);

  const resource = useResource<Payload>(
    `expression:sermons:${organizationId || 'none'}:${id || 'none'}:${mode}`,
    (signal) => api.request<Payload>(path, { signal }),
  );

  const sermons = resource.data?.sermons ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionMediaHeader
        expressionId={id}
        expressionName={expressionName}
        active="sermons"
        title="Sermons"
        subtitle="Teachings and messages published specifically for this Expression."
        icon="mic-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        showsVerticalScrollIndicator={false}
      >
        {resource.loading && !resource.data ? (
          <View style={styles.stack}><Skeleton height={210} count={3} /></View>
        ) : resource.error && !resource.data ? (
          <ResourceError message={resource.error} retry={resource.refresh} />
        ) : sermons.length ? (
          <View style={styles.stack}>
            {sermons.map((sermon) => (
              <SermonCard
                key={sermon.id}
                sermon={sermon}
                onPress={() => router.push(`/expressions/${id}/sermons/${sermon.id}` as any)}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No sermons here yet" message="Sermons published specifically for this Expression will appear here." iconName="mic-outline" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 80 },
  stack: { gap: spacing.sm },
});

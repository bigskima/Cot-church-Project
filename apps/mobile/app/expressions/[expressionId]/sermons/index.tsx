import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState, ResourceError, SermonCard, Skeleton } from '@/components';
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
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION MEDIA</Text>
        <Text style={[styles.title, { color: colors.text }]}>Sermons</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>Teachings and messages published for {expressionName}.</Text>
      </View>

      {resource.loading && !resource.data ? (
        <Skeleton height={210} count={3} />
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : sermons.length ? (
        <View>
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
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingBottom: 80 },
  heading: { marginBottom: spacing.lg },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
});

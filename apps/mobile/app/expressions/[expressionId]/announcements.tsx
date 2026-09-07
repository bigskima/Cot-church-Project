import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Announcement = {
  id: string;
  branch_id: string | null;
  title: string;
  body: string;
  status: string;
  published_at?: string | null;
  created_at?: string | null;
};

function dateLabel(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export default function ExpressionAnnouncementsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context } = useSession();
  const { colors } = useTheme();

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const expressionName =
    context?.expression?.id === id
      ? context.expression.name
      : membership?.name ?? 'this Expression';

  const resource = useResource<Announcement[]>(
    `expression:announcements:${id || 'none'}`,
    (signal) =>
      id
        ? api.request<Announcement[]>(
            `announcements?view=feed&branchId=${encodeURIComponent(id)}`,
            { signal },
          )
        : Promise.resolve([]),
  );

  const announcements = (resource.data ?? []).filter(
    (item) => item.branch_id === id && item.status === 'published',
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={resource.refreshing}
          onRefresh={resource.refresh}
          tintColor={colors.interactive}
        />
      }
    >
      <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name="megaphone-outline" size={21} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION UPDATES</Text>
          <Text style={[styles.title, { color: colors.text }]}>Announcements</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>
            Important updates published specifically for {expressionName}.
          </Text>
        </View>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.stack}>
          <Skeleton height={108} count={4} />
        </View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : announcements.length ? (
        <View style={styles.stack}>
          {announcements.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                shadows.sm,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={[styles.smallIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="megaphone-outline" size={16} color={colors.interactive} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.published_at || item.created_at ? (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {dateLabel(item.published_at ?? item.created_at)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No Expression announcements"
          message="Important updates from this Expression will appear here after they are published."
          iconName="megaphone-outline"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 80,
    gap: spacing.lg,
  },
  intro: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', marginTop: 1 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  stack: { gap: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  smallIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  meta: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  body: { fontSize: 13, lineHeight: 20 },
});

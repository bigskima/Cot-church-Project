import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
  const expressionName = context?.expression?.id === id
    ? context.expression.name
    : membership?.name ?? 'this Expression';

  const resource = useResource<Announcement[]>(
    `expression:announcements:${id || 'none'}`,
    (signal) => id
      ? api.request<Announcement[]>(`announcements?view=feed&branchId=${encodeURIComponent(id)}`, { signal })
      : Promise.resolve([]),
  );

  const announcements = (resource.data ?? [])
    .filter((item) => item.branch_id === id && item.status === 'published')
    .sort((a, b) => new Date(b.published_at ?? b.created_at ?? 0).getTime() - new Date(a.published_at ?? a.created_at ?? 0).getTime());
  const latest = announcements[0];
  const remaining = announcements.slice(1);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
    >
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.heroTop}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Icon name="megaphone-outline" size={22} color={colors.interactive} />
          </View>
          <View style={styles.flex}>
            <View style={styles.scopeRow}>
              <Icon name="lock-closed-outline" size={11} color={colors.interactive} />
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION UPDATES</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Announcements</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>
              Important notices, decisions and updates shared with {expressionName}.
            </Text>
          </View>
        </View>

        <View style={styles.quickRow}>
          <View style={[styles.countPill, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.countNumber, { color: colors.text }]}>{announcements.length}</Text>
            <Text style={[styles.countLabel, { color: colors.textMuted }]}>published</Text>
          </View>
          <Pressable
            onPress={() => router.push(`/expressions/${id}/feed` as any)}
            style={({ pressed }) => [styles.feedButton, { backgroundColor: colors.primarySoft }, pressed ? styles.pressed : null]}
          >
            <Icon name="chatbubbles-outline" size={15} color={colors.interactive} />
            <Text style={[styles.feedButtonText, { color: colors.interactive }]}>Community feed</Text>
          </Pressable>
        </View>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.stack}><Skeleton height={118} count={4} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : latest ? (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>LATEST</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Most recent update</Text>
            </View>
          </View>

          <View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm]}>
            <View style={styles.featuredTop}>
              <View style={[styles.smallIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="notifications-outline" size={17} color={colors.interactive} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{latest.title}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{dateLabel(latest.published_at ?? latest.created_at)}</Text>
              </View>
              <View style={[styles.newPill, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.newPillText, { color: colors.interactive }]}>LATEST</Text>
              </View>
            </View>
            <Text style={[styles.featuredBody, { color: colors.textSecondary }]}>{latest.body}</Text>
          </View>

          {remaining.length ? (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>EARLIER</Text>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Previous announcements</Text>
                </View>
              </View>
              <View style={styles.timeline}>
                {remaining.map((item) => (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineDot, { backgroundColor: colors.interactive }]} />
                      <View style={[styles.timelineLine, { backgroundColor: colors.borderSubtle }]} />
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.meta, { color: colors.textMuted }]}>{dateLabel(item.published_at ?? item.created_at)}</Text>
                      <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
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
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingBottom: 80, gap: spacing.lg },
  hero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4, marginTop: 1 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countPill: { flex: 1, minHeight: 40, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  countNumber: { fontSize: 15, fontWeight: '900' },
  countLabel: { fontSize: 11, fontWeight: '700' },
  feedButton: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedButtonText: { fontSize: 11, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.25, marginTop: 2 },
  stack: { gap: spacing.md },
  featuredCard: { borderWidth: 1.5, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  featuredTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  smallIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  meta: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  newPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 },
  newPillText: { fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 0.7 },
  featuredBody: { fontSize: 14, lineHeight: 22 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  timelineRail: { width: 14, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 21 },
  timelineLine: { width: 1, flex: 1, marginTop: 4 },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md },
  body: { fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});

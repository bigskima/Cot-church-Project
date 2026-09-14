import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Icon, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Poll = {
  id: string;
  question: string;
  description?: string;
  status: string;
  closes_at?: string | null;
  created_at: string;
  options?: unknown[];
};
type Giveaway = {
  id: string;
  title: string;
  description?: string;
  prize_description: string;
  status: string;
  closes_at?: string | null;
  created_at: string;
  host_name?: string | null;
};
type ShelfItem =
  | { id: string; kind: 'poll'; createdAt: string; poll: Poll }
  | { id: string; kind: 'giveaway'; createdAt: string; giveaway: Giveaway };

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ParticipationHomeShelf({ scope, expressionId }: { scope: 'general' | 'expression'; expressionId?: string }) {
  const { auth, context, mode } = useSession();
  const { colors } = useTheme();
  const organizationId = scope === 'expression'
    ? context?.expressions?.find((item) => item.id === expressionId)?.organizationId ?? context?.organization?.id ?? ''
    : context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const branchId = scope === 'expression' ? expressionId ?? null : null;
  const accessToken = auth?.session.accessToken ?? null;

  const resource = useResource<{ polls: Poll[]; giveaways: Giveaway[] }>(
    `participation:home:${scope}:${organizationId || 'none'}:${branchId ?? 'general'}:${mode}`,
    async () => {
      if (!organizationId) return { polls: [], giveaways: [] };
      const supabase = await getRuntimeSupabase(accessToken);
      const pollResult = await supabase.rpc('community_poll_feed', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
      });
      if (pollResult.error) throw new Error(pollResult.error.message);
      const polls = (Array.isArray(pollResult.data) ? pollResult.data : [])
        .filter((item: any) => item.status === 'open' && (!item.closes_at || Date.parse(item.closes_at) > Date.now()))
        .slice(0, 6) as Poll[];

      let giveaways: Giveaway[] = [];
      if (mode === 'authenticated') {
        const giveawayResult = await supabase.rpc('community_giveaway_feed', {
          target_organization_id: organizationId,
          target_branch_id: branchId,
        });
        if (giveawayResult.error) throw new Error(giveawayResult.error.message);
        giveaways = (Array.isArray(giveawayResult.data) ? giveawayResult.data : [])
          .filter((item: any) => item.status === 'open' && (!item.closes_at || Date.parse(item.closes_at) > Date.now()))
          .slice(0, 6) as Giveaway[];
      }
      return { polls, giveaways };
    },
  );

  const items = useMemo<ShelfItem[]>(() => [
    ...(resource.data?.polls ?? []).map((poll) => ({ id: `poll:${poll.id}`, kind: 'poll' as const, createdAt: poll.created_at, poll })),
    ...(resource.data?.giveaways ?? []).map((giveaway) => ({ id: `giveaway:${giveaway.id}`, kind: 'giveaway' as const, createdAt: giveaway.created_at, giveaway })),
  ].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')).slice(0, 8), [resource.data]);

  const route = scope === 'general' ? '/general/participate' : `/expressions/${expressionId}/participate`;
  if (!resource.loading && !items.length) return null;

  return (
    <View style={[styles.shelf, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Icon name="people-circle-outline" size={18} color={colors.interactive} /></View>
          <View>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>PARTICIPATE</Text>
            <Text style={[styles.title, { color: colors.text }]}>Polls & giveaways</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push(route as any)} accessibilityRole="button">
          <Text style={[styles.seeAll, { color: colors.interactive }]}>See all</Text>
        </Pressable>
      </View>

      {resource.loading && !resource.data ? (
        <View style={styles.loading}><Skeleton width={220} height={132} count={2} /></View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {items.map((item) => item.kind === 'poll' ? (
            <Pressable key={item.id} onPress={() => router.push(route as any)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.cardTop}><View style={[styles.smallIcon, { backgroundColor: colors.primarySoft }]}><Icon name="stats-chart-outline" size={16} color={colors.interactive} /></View><Badge label="POLL" variant="primary" /></View>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={3}>{item.poll.question}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>{Array.isArray(item.poll.options) ? `${item.poll.options.length} options` : 'Vote now'}{item.poll.closes_at ? ` · closes ${dateLabel(item.poll.closes_at)}` : ''}</Text>
            </Pressable>
          ) : (
            <Pressable key={item.id} onPress={() => router.push(route as any)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.cardTop}><View style={[styles.smallIcon, { backgroundColor: colors.primarySoft }]}><Icon name="gift-outline" size={16} color={colors.interactive} /></View><Badge label="GIVEAWAY" variant="active" /></View>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.giveaway.title}</Text>
              <Text style={[styles.prize, { color: colors.interactive }]} numberOfLines={2}>{item.giveaway.prize_description}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>{item.giveaway.closes_at ? `Closes ${dateLabel(item.giveaway.closes_at)}` : 'Open now'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { width: '100%', maxWidth: 920, alignSelf: 'center', borderWidth: 1, borderRadius: radius.xl, paddingVertical: spacing.md, marginVertical: spacing.sm },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  seeAll: { fontSize: 11, fontWeight: '900' },
  loading: { paddingHorizontal: spacing.md, flexDirection: 'row', gap: spacing.sm },
  rail: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: 2 },
  card: { width: 224, minHeight: 132, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '900' },
  prize: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  meta: { fontSize: 9.5, lineHeight: 14, marginTop: 'auto' },
});

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type DailyVisual = {
  image_url?: string | null;
  image_source?: 'ai' | 'upload' | 'inherited';
};

type DailyQuotePayload = {
  id?: string;
  date: string;
  body: string;
  sourceReference?: string | null;
  theme?: string | null;
  source: 'automatic' | 'ministry' | 'provisioned';
  isOverride?: boolean;
  visual?: DailyVisual | null;
};

function localDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateLabel(value: string) {
  const parsed = new Date(value + 'T12:00:00');
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function DailyQuoteScreen() {
  const route = useLocalSearchParams<{ date?: string }>();
  const date = typeof route.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.date) ? route.date : localDate();
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  const quote = useResource<DailyQuotePayload | null>(
    'daily-quote:' + organizationId + ':' + date,
    (signal) => organizationId
      ? api.request<DailyQuotePayload | null>(
          'noop?service=engagement-hub&action=daily_quote&organizationId=' + encodeURIComponent(organizationId) + '&date=' + encodeURIComponent(date),
          { signal, context: 'public' },
        )
      : Promise.resolve(null),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 }]}
      >
        <ScreenHeader title="Daily Quote" kicker="GENERAL COT" subtitle={dateLabel(date)} showBack compact />

        {quote.loading && quote.data === undefined ? (
          <><Skeleton height={260} borderRadius={radius.xl} /><Skeleton height={170} borderRadius={radius.xl} /></>
        ) : quote.error ? (
          <ResourceError message={quote.error} retry={quote.refresh} />
        ) : !quote.data ? (
          <EmptyState title="No Daily Quote for this date" message="Choose another day or return to Home for today's COT reflection." iconName="chatbubble-ellipses-outline" />
        ) : (
          <>
            {quote.data.visual?.image_url ? (
              <View style={[styles.visual, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                <Image source={{ uri: quote.data.visual.image_url }} style={styles.image} resizeMode="cover" />
                <View style={styles.overlay}>
                  <View style={styles.badge}>
                    <Icon name="chatbubble-ellipses-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.badgeText}>DAILY QUOTE</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={[styles.quoteIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="chatbubble-ellipses-outline" size={21} color={colors.interactive} />
              </View>
              <Text style={[styles.quote, { color: colors.text }]}>{quote.data.body}</Text>
              <View style={styles.ruleRow}>
                <View style={[styles.rule, { backgroundColor: colors.interactive }]} />
                <Text style={[styles.reference, { color: colors.textMuted }]}>
                  {quote.data.sourceReference ? 'Inspired by ' + quote.data.sourceReference : 'Bible-inspired reflection'}
                </Text>
              </View>
              {quote.data.theme ? <Text style={[styles.theme, { color: colors.interactive }]}>{quote.data.theme.toUpperCase()}</Text> : null}
            </View>

            {quote.data.sourceReference ? (
              <Button
                label={'Read ' + quote.data.sourceReference}
                variant="outline"
                onPress={() => router.push({ pathname: '/general/bible', params: { reference: quote.data!.sourceReference!, dailyDate: date, dailyVisualKind: 'bible' } } as any)}
                icon={<Icon name="book-outline" size={17} color={colors.interactive} />}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.lg },
  visual: { width: '100%', aspectRatio: 16 / 7, borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFill as any, padding: spacing.md, justifyContent: 'flex-end' },
  badge: { alignSelf: 'flex-start', minHeight: 32, borderRadius: 16, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(4,12,24,.72)' },
  badgeText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  quoteCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.lg },
  quoteIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quote: { fontSize: 24, lineHeight: 35, fontWeight: '800', letterSpacing: -0.35 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { width: 28, height: 2, borderRadius: 2 },
  reference: { fontSize: 11, fontWeight: '800' },
  theme: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
});

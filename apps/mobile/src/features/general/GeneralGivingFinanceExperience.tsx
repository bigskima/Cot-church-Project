import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Chip, EmptyState, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type FinanceSummaryRow = {
  currency: string;
  donation_count: number | string;
  total_amount_minor: number | string;
  refunded_amount_minor: number | string;
};
type RangeDays = 7 | 30 | 90;

function money(amountMinor: number | string, currency: string) {
  const value = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

export default function GeneralGivingFinanceExperience() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const organization = context?.organization ?? context?.organizations?.[0];
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  const period = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [rangeDays]);

  const resource = useResource<FinanceSummaryRow[]>(
    `general:giving-finance:${organization?.id ?? 'none'}:${rangeDays}:${period.start}`,
    (signal) => {
      if (!organization || !access.canReadGivingFinance) return Promise.resolve([]);
      const query = new URLSearchParams({ start: period.start, end: period.end });
      return api.request<FinanceSummaryRow[]>(`finance?${query.toString()}`, { signal });
    },
  );

  if (!organization) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Choose a church" message="Choose a church before viewing giving finance." iconName="business-outline" /></View>;
  if (!access.accessReady) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}><View style={styles.body}><Skeleton height={120} count={4} /></View></View>;
  if (!access.canReadGivingFinance) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Finance access unavailable" message="Giving reports are available only to authorized finance roles." iconName="lock-closed-outline" /></View>;

  const rows = resource.data ?? [];
  const totalDonations = rows.reduce((sum, row) => sum + Number(row.donation_count || 0), 0);
  const currencies = rows.length;
  const hasRefunds = rows.some((row) => Number(row.refunded_amount_minor || 0) > 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader title="Giving reports" kicker="MINISTRY · FINANCE" subtitle={`Read-only church-wide giving performance for ${organization.name}.`} showBack rightAction={access.canManageGiving ? <Button label="Setup" variant="outline" size="sm" onPress={() => router.push('/general/leadership/giving-manage')} /> : undefined} />
        <View style={styles.body}>
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.heroTop}><View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}><Icon name="analytics-outline" size={23} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.heroKicker, { color: colors.interactive }]}>REPORTING WINDOW</Text><Text style={[styles.heroTitle, { color: colors.text }]}>Last {rangeDays} days</Text><Text style={[styles.heroCopy, { color: colors.textMuted }]}>{new Date(period.start).toLocaleDateString()} – {new Date(period.end).toLocaleDateString()}</Text></View></View>
            <View style={styles.rangeRow}>{([7, 30, 90] as RangeDays[]).map((days) => <Chip key={days} label={`${days} days`} selected={rangeDays === days} onPress={() => setRangeDays(days)} />)}</View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{totalDonations.toLocaleString()}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Successful donations</Text></View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{currencies}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Currencies reported</Text></View>
          </View>

          {hasRefunds ? <View style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="return-down-back-outline" size={18} color={colors.interactive} /><Text style={[styles.noticeText, { color: colors.textSecondary }]}>Refund activity exists in this period. Gross, refunded and net values remain separated below.</Text></View> : null}

          <SectionHeader title="Currency summaries" badge={rows.length} subtitle="Currencies remain separate so totals are never combined incorrectly." />
          {resource.loading && !resource.data ? <Skeleton height={150} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : rows.length ? rows.map((row) => {
            const gross = Number(row.total_amount_minor || 0);
            const refunded = Number(row.refunded_amount_minor || 0);
            const net = gross - refunded;
            return <View key={row.currency} style={[styles.currencyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <View style={styles.currencyTop}><View style={[styles.currencyIcon, { backgroundColor: colors.primarySoft }]}><Icon name="wallet-outline" size={20} color={colors.interactive} /></View><View style={styles.flex}><View style={styles.currencyTitleRow}><Text style={[styles.currencyCode, { color: colors.text }]}>{row.currency}</Text><Badge label={`${Number(row.donation_count || 0).toLocaleString()} GIFTS`} variant="neutral" /></View><Text style={[styles.currencyMeta, { color: colors.textMuted }]}>Completed giving transactions in this reporting window</Text></View></View>
              <View style={styles.metricGrid}><Metric label="Gross" value={money(gross, row.currency)} /><Metric label="Refunded" value={money(refunded, row.currency)} muted={!refunded} /><Metric label="Net" value={money(net, row.currency)} accent /></View>
            </View>;
          }) : <EmptyState title="No giving activity in this period" message="Choose another reporting window or check again after completed donations are recorded." iconName="analytics-outline" />}

          <View style={[styles.readOnlyCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={18} color={colors.interactive} /><View style={styles.flex}><Text style={[styles.readOnlyTitle, { color: colors.text }]}>Read-only reporting</Text><Text style={[styles.readOnlyText, { color: colors.textMuted }]}>This dashboard does not alter ledger records. Giving destinations and configuration remain in Giving setup.</Text></View></View>
        </View>
      </ScrollView>
    </View>
  );

  function Metric({ label, value, accent = false, muted = false }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
    return <View style={[styles.metric, { backgroundColor: colors.bgSecondary }]}><Text style={[styles.metricLabel, { color: accent ? colors.interactive : colors.textMuted }]}>{label.toUpperCase()}</Text><Text style={[styles.metricValue, { color: muted ? colors.textMuted : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  hero: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md }, heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, heroKicker: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 }, heroTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.4 }, heroCopy: { fontSize: 10.5, marginTop: 2 }, rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, summaryValue: { fontSize: 24, lineHeight: 29, fontWeight: '900' }, summaryLabel: { fontSize: 10.5, marginTop: 2 }, notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 10.5, lineHeight: 16 },
  currencyCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, currencyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, currencyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, currencyTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }, currencyCode: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }, currencyMeta: { fontSize: 10.5, marginTop: 2 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, metric: { minWidth: 120, flex: 1, borderRadius: radius.lg, padding: spacing.md, gap: 4 }, metricLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 }, metricValue: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  readOnlyCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, readOnlyTitle: { fontSize: 11.5, fontWeight: '900' }, readOnlyText: { fontSize: 10.5, lineHeight: 16, marginTop: 2 },
});

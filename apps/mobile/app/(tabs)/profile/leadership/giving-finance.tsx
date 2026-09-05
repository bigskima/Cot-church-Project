import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  EmptyState,
  Icon,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type FinanceSummaryRow = {
  currency: string;
  donation_count: number | string;
  total_amount_minor: number | string;
  refunded_amount_minor: number | string;
};

type FinancePayload = FinanceSummaryRow[];

function money(amountMinor: number | string, currency: string) {
  const value = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

export default function GivingFinanceScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const organization = context?.organization ?? context?.organizations?.[0];
  const expression = context?.expression;
  const canReadFinance = hasCapability('giving.finance.read') || hasCapability('*');

  const period = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const resource = useResource<FinancePayload>(
    `giving-finance:${organization?.id ?? 'none'}:${expression?.id ?? 'general'}:${period.start}`,
    (signal) => {
      if (!organization || !canReadFinance) return Promise.resolve([]);
      const query = new URLSearchParams({ start: period.start, end: period.end });
      return api.request<FinancePayload>(`finance?${query.toString()}`, { signal });
    },
  );

  if (!organization) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          title="Choose a church"
          message="Choose a church before viewing giving finance."
          iconName="business-outline"
        />
      </View>
    );
  }

  if (!canReadFinance) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          title="Finance access unavailable"
          message="Your current role does not include permission to view giving finance."
          iconName="lock-closed-outline"
        />
      </View>
    );
  }

  const rows = resource.data ?? [];
  const totalDonations = rows.reduce((sum, row) => sum + Number(row.donation_count || 0), 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title="Giving Finance"
            kicker="FINANCE"
            subtitle={
              expression?.name
                ? `Read-only giving summary for ${expression.name}.`
                : `Read-only church-wide giving summary for ${organization.name}.`
            }
            showBack
          />
        </View>

        <View style={styles.body}>
          <View style={[styles.periodCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.periodIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="calendar-outline" size={20} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.periodTitle, { color: colors.text }]}>Last 30 days</Text>
              <Text style={[styles.periodText, { color: colors.textSecondary }]}>
                {new Date(period.start).toLocaleDateString()} – {new Date(period.end).toLocaleDateString()}
              </Text>
            </View>
            <Badge label={`${totalDonations} DONATIONS`} variant="neutral" />
          </View>

          <SectionHeader
            title="Giving summary"
            badge={rows.length}
            subtitle="Currencies stay separate so totals are never mixed."
          />

          {resource.loading && !resource.data ? (
            <Skeleton height={132} count={3} />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : rows.length ? (
            rows.map((row) => {
              const gross = Number(row.total_amount_minor || 0);
              const refunded = Number(row.refunded_amount_minor || 0);
              const net = gross - refunded;
              return (
                <View key={row.currency} style={[styles.currencyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.currencyTop}>
                    <View style={[styles.currencyIcon, { backgroundColor: colors.primarySoft }]}>
                      <Icon name="wallet-outline" size={19} color={colors.interactive} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.currencyCode, { color: colors.text }]}>{row.currency}</Text>
                      <Text style={[styles.currencyMeta, { color: colors.textSecondary }]}>
                        {Number(row.donation_count || 0).toLocaleString()} successful donation{Number(row.donation_count || 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricGrid}>
                    <View style={[styles.metric, { backgroundColor: colors.bgSecondary }]}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>GROSS</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>{money(gross, row.currency)}</Text>
                    </View>
                    <View style={[styles.metric, { backgroundColor: colors.bgSecondary }]}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>REFUNDED</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>{money(refunded, row.currency)}</Text>
                    </View>
                    <View style={[styles.metric, { backgroundColor: colors.bgSecondary }]}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>NET</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>{money(net, row.currency)}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState
              title="No giving activity in this period"
              message="Successful donations in the selected church scope will appear here."
              iconName="analytics-outline"
            />
          )}

          <View style={[styles.readOnlyCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="eye-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>
              This screen is read-only. Giving destinations and bank accounts are managed separately by roles with giving configuration authority.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { flexGrow: 1 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.lg },
  flex: { flex: 1 },
  periodCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  periodIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  periodTitle: { fontSize: 15, fontWeight: '800' },
  periodText: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  currencyCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  currencyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currencyIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  currencyCode: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  currencyMeta: { fontSize: 11, marginTop: 2 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { minWidth: 130, flex: 1, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  metricLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  metricValue: { fontSize: 15, fontWeight: '800' },
  readOnlyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  readOnlyText: { flex: 1, fontSize: 12, lineHeight: 18 },
});

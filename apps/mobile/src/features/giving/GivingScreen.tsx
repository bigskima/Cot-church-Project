import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Chip,
  EmptyState,
  Icon,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Receipt } from '@/types/content';
import type { BankAccount, GivingPurpose, GivingScope, PublicGivingDetails } from '@/types/giving';

function formatMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function AccountCard({ account, selectedPurpose }: { account: BankAccount; selectedPurpose: GivingPurpose | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
      <View style={styles.accountHeader}>
        <View style={[styles.accountIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="business-outline" size={18} color={colors.interactive} />
        </View>
        <View style={styles.accountHeaderText}>
          <Text style={[styles.accountLabel, { color: colors.text }]}>{account.label}</Text>
          <Text style={[styles.bankName, { color: colors.textSecondary }]}>{account.bank_name}</Text>
        </View>
        <Badge label={account.currency} variant="primary" />
      </View>

      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Account name</Text>
        <Text selectable style={[styles.detailValue, { color: colors.text }]}>{account.account_name}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Account number</Text>
        <Text selectable style={[styles.accountNumber, { color: colors.interactive }]}>{account.account_number}</Text>
      </View>
      {account.iban ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>IBAN</Text>
          <Text selectable style={[styles.detailValue, { color: colors.text }]}>{account.iban}</Text>
        </View>
      ) : null}
      {account.swift_code ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>SWIFT / BIC</Text>
          <Text selectable style={[styles.detailValue, { color: colors.text }]}>{account.swift_code}</Text>
        </View>
      ) : null}
      {account.routing_number ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Routing / sort code</Text>
          <Text selectable style={[styles.detailValue, { color: colors.text }]}>{account.routing_number}</Text>
        </View>
      ) : null}
      {account.reference_prefix ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Reference</Text>
          <Text selectable style={[styles.detailValue, { color: colors.text }]}>
            {selectedPurpose ? `${account.reference_prefix}${selectedPurpose.name}` : account.reference_prefix}
          </Text>
        </View>
      ) : null}

      {account.transfer_instructions ? (
        <Text style={[styles.instructions, { color: colors.textSecondary, borderTopColor: colors.border }]}>
          {account.transfer_instructions}
        </Text>
      ) : null}
      {account.additional_instructions ? (
        <Text style={[styles.additionalInstructions, { color: colors.textMuted }]}>{account.additional_instructions}</Text>
      ) : null}
    </View>
  );
}

export function GivingScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();
  const publicOrganizationId = process.env.EXPO_PUBLIC_ORGANIZATION_ID?.trim();
  const organizationId = context?.organization?.id ?? publicOrganizationId ?? '';
  const expressionId = context?.expression?.id ?? null;
  const expressionName = context?.expression?.name ?? 'My Expression';

  const [scope, setScope] = useState<GivingScope>('church');
  const [currency, setCurrency] = useState<string | null>(null);
  const [purposeId, setPurposeId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'visitor') setScope('church');
  }, [mode]);

  const query = useMemo(() => {
    if (!organizationId) return '';
    const params = new URLSearchParams({ organizationId });
    if (scope === 'expression' && expressionId) params.set('expressionId', expressionId);
    return `public-giving?${params.toString()}`;
  }, [organizationId, scope, expressionId]);

  const giving = useResource<PublicGivingDetails>(
    `giving:${organizationId}:${scope}:${expressionId ?? 'none'}`,
    (signal) => {
      if (!query) return Promise.reject(new Error('Giving is not configured for this deployment.'));
      return api.request<PublicGivingDetails>(query, { signal });
    },
  );

  const receipts = useResource<Receipt[]>('giving:receipts', (signal) =>
    mode === 'authenticated'
      ? api.request<Receipt[]>('giving?view=receipts', { signal })
      : Promise.resolve([]),
  );

  const details = giving.data;
  const currencies = details?.currencies ?? [];

  useEffect(() => {
    if (!currencies.length) {
      setCurrency(null);
      return;
    }
    if (!currency || !currencies.includes(currency)) setCurrency(currencies[0]);
  }, [currencies.join('|'), currency]);

  const purposes = details?.purposes ?? [];
  useEffect(() => {
    if (!purposes.length) {
      setPurposeId(null);
      return;
    }
    const configuredDefault = purposes.find((item) => item.is_default);
    const next = configuredDefault?.id ?? purposes[0].id;
    if (!purposeId || !purposes.some((item) => item.id === purposeId)) setPurposeId(next);
  }, [purposes.map((item) => item.id).join('|'), purposeId]);

  const selectedPurpose = purposes.find((item) => item.id === purposeId) ?? null;
  const visibleAccounts = (details?.bankAccounts ?? []).filter((account) => !currency || account.currency === currency);

  const title = details?.settings?.displayTitle || 'Giving';
  const subtitle = details?.settings?.displaySubtitle || undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }}
      >
        <ScreenHeader title={title} subtitle={subtitle} showBack />

        <View style={styles.body}>
          {mode === 'authenticated' && expressionId ? (
            <View style={[styles.scopeSelector, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Pressable
                onPress={() => setScope('church')}
                style={[styles.scopeOption, scope === 'church' && { backgroundColor: colors.card }]}
              >
                <Icon name="globe-outline" size={16} color={scope === 'church' ? colors.interactive : colors.textMuted} />
                <Text style={[styles.scopeText, { color: scope === 'church' ? colors.text : colors.textMuted }]}>Church-wide</Text>
              </Pressable>
              <Pressable
                onPress={() => setScope('expression')}
                style={[styles.scopeOption, scope === 'expression' && { backgroundColor: colors.card }]}
              >
                <Icon name="location-outline" size={16} color={scope === 'expression' ? colors.interactive : colors.textMuted} />
                <Text numberOfLines={1} style={[styles.scopeText, { color: scope === 'expression' ? colors.text : colors.textMuted }]}>
                  {expressionName}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {giving.loading ? (
            <Skeleton height={150} count={3} />
          ) : giving.error ? (
            <ResourceError message={giving.error.message} onRetry={giving.refresh} />
          ) : !details?.settings || !details.settings.isEnabled ? (
            <EmptyState
              title="Giving details are not available"
              message={scope === 'expression' ? 'This expression has not published its giving information yet.' : 'Church giving information has not been published yet.'}
              iconName="gift-outline"
            />
          ) : (
            <>
              {purposes.length ? (
                <View style={styles.section}>
                  <SectionHeader title="Choose a giving purpose" />
                  <View style={styles.chips}>
                    {purposes.map((purpose) => (
                      <Chip
                        key={purpose.id}
                        label={purpose.name}
                        selected={purposeId === purpose.id}
                        onPress={() => setPurposeId(purpose.id)}
                      />
                    ))}
                  </View>
                  {selectedPurpose?.description ? (
                    <Text style={[styles.purposeDescription, { color: colors.textSecondary }]}>{selectedPurpose.description}</Text>
                  ) : null}
                </View>
              ) : null}

              {details.methods.manualBankTransfer ? (
                <View style={styles.section}>
                  <SectionHeader title="Bank transfer" badge={visibleAccounts.length} />
                  {currencies.length > 1 ? (
                    <View style={styles.chips}>
                      {currencies.map((code) => (
                        <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
                      ))}
                    </View>
                  ) : currencies.length === 1 ? (
                    <View style={styles.currencyLine}>
                      <Text style={[styles.currencyLabel, { color: colors.textMuted }]}>Account currency</Text>
                      <Badge label={currencies[0]} variant="primary" />
                    </View>
                  ) : null}

                  {visibleAccounts.length ? (
                    visibleAccounts.map((account) => (
                      <AccountCard key={account.id} account={account} selectedPurpose={selectedPurpose} />
                    ))
                  ) : (
                    <EmptyState
                      title="No transfer account available"
                      message="There is no active transfer account for this currency at the moment."
                      iconName="business-outline"
                    />
                  )}
                </View>
              ) : (
                <EmptyState
                  title="Bank transfer is not available"
                  message="No active transfer destination is currently published for this giving scope."
                  iconName="business-outline"
                />
              )}

              {!details.methods.onlinePayment && details.settings.onlinePaymentEnabled ? (
                <View style={[styles.infoCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                  <Icon name="card-outline" size={18} color={colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTitle, { color: colors.text }]}>Online giving unavailable</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      {details.settings.onlineUnavailableMessage}
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}

          {mode === 'authenticated' ? (
            <View style={styles.section}>
              <SectionHeader title="Your giving receipts" badge={receipts.data?.length ?? 0} />
              {receipts.loading ? (
                <Skeleton height={72} count={2} />
              ) : receipts.data?.length ? (
                receipts.data.map((receipt) => (
                  <View key={receipt.id} style={[styles.receipt, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.receiptAmount, { color: colors.text }]}>{formatMoney(receipt.amount_minor, receipt.currency)}</Text>
                      {receipt.category ? <Text style={[styles.receiptCategory, { color: colors.textSecondary }]}>{receipt.category}</Text> : null}
                    </View>
                    <Badge label={receipt.receipt_number} variant="success" />
                  </View>
                ))
              ) : (
                <Text style={[styles.noReceipts, { color: colors.textMuted }]}>No giving receipts are linked to this account yet.</Text>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  scopeSelector: { flexDirection: 'row', padding: 4, borderRadius: radius.lg, borderWidth: 1, gap: 4 },
  scopeOption: { flex: 1, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  scopeText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  purposeDescription: { fontSize: 13, lineHeight: 19 },
  currencyLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencyLabel: { fontSize: 12, fontWeight: '600' },
  accountCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  accountIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  accountHeaderText: { flex: 1 },
  accountLabel: { fontSize: 15, fontWeight: '800' },
  bankName: { fontSize: 12, marginTop: 2 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  accountNumber: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  instructions: { borderTopWidth: 1, paddingTop: spacing.sm, fontSize: 13, lineHeight: 19 },
  additionalInstructions: { fontSize: 12, lineHeight: 18 },
  infoCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  infoText: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  receipt: { minHeight: 66, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  receiptAmount: { fontSize: 15, fontWeight: '800' },
  receiptCategory: { fontSize: 12, marginTop: 2 },
  noReceipts: { fontSize: 13 },
});

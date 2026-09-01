import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Icon,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { GivingCampaign, PublicGivingDetails, Receipt } from '@/types/content';

const QUICK_AMOUNTS = [20, 50, 100, 250, 500];

export default function GivingScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [amount, setAmount] = useState<string>('50');
  const [currency, setCurrency] = useState('USD');
  const [selectedPurpose, setSelectedPurpose] = useState('Tithe & General Offering');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [recurringFrequency, setRecurringFrequency] = useState<'one_time' | 'weekly' | 'monthly'>('one_time');
  const [givingMethod, setGivingMethod] = useState<'card' | 'bank_wire'>('card');
  const [submitting, setSubmitting] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);

  const orgParam =
    mode === 'visitor'
      ? `?organizationId=${process.env.EXPO_PUBLIC_ORGANIZATION_ID || ''}`
      : context?.expression?.id
      ? `?expressionId=${context.expression.id}`
      : '';

  const givingDetails = useResource<PublicGivingDetails>('giving:details', (signal) => {
    return api.request<PublicGivingDetails>(`giving${orgParam}`, { signal });
  });

  const memberReceipts = useResource<Receipt[]>('giving:receipts', (signal) => {
    if (mode === 'visitor') return Promise.resolve([]);
    return api.request<Receipt[]>('giving?view=receipts', { signal });
  });

  const handleGive = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a valid donation amount.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.request<{ receiptNumber: string }>('giving', {
        method: 'POST',
        body: JSON.stringify({
          amountMinor: Math.round(numericAmount * 100),
          currency,
          purpose: selectedPurpose,
          campaignId: selectedCampaignId,
          frequency: recurringFrequency,
          paymentMethod: 'card_mock_provider',
        }),
      });

      setReceiptSuccess(res.receiptNumber || `COT-GIVE-${Date.now().toString().slice(-6)}`);
      memberReceipts.refresh();
    } catch {
      alert('Unable to process giving transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const campaigns = givingDetails.data?.campaigns ?? [];
  const bankAccounts = givingDetails.data?.bankAccounts ?? [];
  const receipts = memberReceipts.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 60 },
        ]}
      >
        <ScreenHeader
          title="Kingdom Giving & Tithes"
          subtitle="Honour the Lord with your substance. Giving supports sanctuary ministries, global missions, and church benevolence."
          showBack
        />

        <View style={styles.body}>
          {/* Method Tab Selector */}
          <View style={styles.methodSelector}>
            <Chip
              label="Online Card Giving"
              selected={givingMethod === 'card'}
              onPress={() => setGivingMethod('card')}
              icon={<Icon name="card-outline" size={14} color={givingMethod === 'card' ? '#FFFFFF' : colors.textSecondary} />}
            />
            <Chip
              label="Direct Bank Transfer"
              selected={givingMethod === 'bank_wire'}
              onPress={() => setGivingMethod('bank_wire')}
              icon={<Icon name="business-outline" size={14} color={givingMethod === 'bank_wire' ? '#FFFFFF' : colors.textSecondary} />}
            />
          </View>

          {givingMethod === 'card' ? (
            /* Online Card Giving Workflow */
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              {receiptSuccess ? (
                <View style={styles.successState}>
                  <View style={[styles.successIconWrap, { backgroundColor: colors.successSoft }]}>
                    <Icon name="checkmark-circle" size={44} color={colors.success} />
                  </View>
                  <Text style={[styles.successTitle, { color: colors.text }]}>Thank You for Your Giving!</Text>
                  <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                    Your donation of ${amount} {currency} has been received. Receipt #{receiptSuccess} has been issued to your account.
                  </Text>
                  <Button
                    label="Make Another Donation"
                    onPress={() => setReceiptSuccess(null)}
                    variant="outline"
                    size="md"
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : (
                <>
                  {/* Amount Selector */}
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>SELECT GIVING AMOUNT</Text>
                  <View style={styles.quickAmounts}>
                    {QUICK_AMOUNTS.map((val) => (
                      <Pressable
                        key={val}
                        onPress={() => setAmount(val.toString())}
                        style={[
                          styles.amountPill,
                          {
                            backgroundColor: amount === val.toString() ? colors.primarySoft : colors.bgSecondary,
                            borderColor: amount === val.toString() ? colors.interactive : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.amountPillText,
                            { color: amount === val.toString() ? colors.interactive : colors.text },
                          ]}
                        >
                          ${val}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Custom Amount Input */}
                  <View style={[styles.customInputRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.currencyPrefix, { color: colors.interactive }]}>$</Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.amountInput, { color: colors.text }]}
                    />
                    <Text style={[styles.currencySuffix, { color: colors.textMuted }]}>{currency}</Text>
                  </View>

                  {/* Purpose Chips */}
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DESIGNATED PURPOSE</Text>
                  <View style={styles.purposeChips}>
                    {['Tithe & General Offering', 'Missions & Outreach', 'Building Project', 'Benevolence & Welfare'].map(
                      (purpose) => (
                        <Pressable
                          key={purpose}
                          onPress={() => {
                            setSelectedPurpose(purpose);
                            setSelectedCampaignId(null);
                          }}
                          style={[
                            styles.purposePill,
                            {
                              backgroundColor: selectedPurpose === purpose ? colors.primarySoft : colors.bgSecondary,
                              borderColor: selectedPurpose === purpose ? colors.interactive : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.purposePillText,
                              { color: selectedPurpose === purpose ? colors.interactive : colors.text },
                            ]}
                          >
                            {purpose}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>

                  {/* Frequency Options */}
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FREQUENCY</Text>
                  <View style={styles.frequencyRow}>
                    {[
                      ['one_time', 'One-Time'],
                      ['weekly', 'Weekly'],
                      ['monthly', 'Monthly'],
                    ].map(([freq, label]) => (
                      <Pressable
                        key={freq}
                        onPress={() => setRecurringFrequency(freq as any)}
                        style={[
                          styles.frequencyPill,
                          {
                            backgroundColor: recurringFrequency === freq ? colors.primarySoft : colors.bgSecondary,
                            borderColor: recurringFrequency === freq ? colors.interactive : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.frequencyText,
                            { color: recurringFrequency === freq ? colors.interactive : colors.text },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Submit Giving Button */}
                  <Button
                    label={`Give $${amount || '0'} ${recurringFrequency !== 'one_time' ? `(${recurringFrequency})` : ''}`}
                    onPress={handleGive}
                    loading={submitting}
                    variant="primary"
                    size="lg"
                    style={{ marginTop: spacing.md }}
                    icon={<Icon name="heart" size={18} color="#FFFFFF" />}
                  />
                </>
              )}
            </View>
          ) : (
            /* Bank Wire Transfer Details */
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <View style={styles.wireHeader}>
                <Icon name="business" size={24} color={colors.interactive} />
                <Text style={[styles.wireTitle, { color: colors.text }]}>Church Sanctuary Bank Accounts</Text>
              </View>
              <Text style={[styles.wireSubtitle, { color: colors.textSecondary }]}>
                Please use the account details below for direct EFT, wire, or automated bank standing orders.
              </Text>

              {bankAccounts.length > 0 ? (
                bankAccounts.map((acct, idx) => (
                  <View key={idx} style={[styles.bankBlock, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.bankName, { color: colors.text }]}>{acct.bank_name}</Text>
                    <Text style={[styles.bankDetail, { color: colors.textSecondary }]}>
                      Beneficiary: <Text style={{ color: colors.text, fontWeight: '600' }}>{acct.account_name}</Text>
                    </Text>
                    <Text style={[styles.bankDetail, { color: colors.textSecondary }]}>
                      Account No: <Text style={{ color: colors.interactive, fontWeight: '700' }}>{acct.account_number}</Text>
                    </Text>
                    {acct.routing_number && (
                      <Text style={[styles.bankDetail, { color: colors.textSecondary }]}>
                        Routing / Sort Code: <Text style={{ color: colors.text }}>{acct.routing_number}</Text>
                      </Text>
                    )}
                    {acct.transfer_instructions && (
                      <Text style={[styles.bankInstructions, { color: colors.textMuted }]}>
                        {acct.transfer_instructions}
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={[styles.bankBlock, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.bankName, { color: colors.text }]}>Church General Fund</Text>
                  <Text style={[styles.bankDetail, { color: colors.textSecondary }]}>
                    Account No: <Text style={{ color: colors.interactive, fontWeight: '700' }}>Contact local campus for wire instructions</Text>
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Member Giving Receipt History */}
          {mode !== 'visitor' && (
            <View style={styles.receiptsSection}>
              <SectionHeader title="Your Giving Receipts" badge={receipts.length} />
              {memberReceipts.loading ? (
                <Skeleton height={70} count={2} />
              ) : receipts.length > 0 ? (
                receipts.map((r) => (
                  <View
                    key={r.id}
                    style={[styles.receiptTile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                  >
                    <View style={styles.receiptHeader}>
                      <Text style={[styles.receiptAmount, { color: colors.text }]}>
                        ${(r.amount_minor / 100).toFixed(2)} {r.currency}
                      </Text>
                      <Badge label={r.receipt_number} variant="success" />
                    </View>
                    <Text style={[styles.receiptPurpose, { color: colors.interactive }]}>{r.category || 'General Offering'}</Text>
                    <Text style={[styles.receiptDate, { color: colors.textMuted }]}>
                      {new Date(r.created_at || r.issued_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyState
                  title="No Giving Receipts Yet"
                  message="Your digital giving receipts and year-end statements will appear here."
                  iconName="receipt-outline"
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  amountPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  amountPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 56,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  currencySuffix: {
    fontSize: 14,
    fontWeight: '600',
  },
  purposeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  purposePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  purposePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  frequencyPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  frequencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  wireHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wireTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  wireSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  bankBlock: {
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 4,
  },
  bankName: {
    fontSize: 15,
    fontWeight: '700',
  },
  bankDetail: {
    fontSize: 13,
  },
  bankInstructions: {
    fontSize: 11,
    marginTop: 4,
  },
  receiptsSection: {
    gap: spacing.xs,
  },
  receiptTile: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
    gap: 2,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  receiptPurpose: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptDate: {
    fontSize: 11,
  },
  successState: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 320,
  },
});

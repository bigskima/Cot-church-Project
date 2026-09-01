import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { BankAccount, GivingCampaign, PublicGivingDetails, Receipt } from '@/types/content';

const quickAmounts = ['20', '50', '100', '250', '500'];
const givingPurposes = [
  'General Offering',
  'Tithe (10%)',
  'Kingdom Missions',
  'Building & Capital',
  'Benevolence / Pastoral Care',
];

export default function GivingScreen() {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const { colors } = useTheme();

  const [selectedMethod, setSelectedMethod] = useState<'online' | 'bank_transfer'>('online');
  const [frequency, setFrequency] = useState<'one_time' | 'monthly'>('one_time');
  const [amount, setAmount] = useState('50');
  const [currency, setCurrency] = useState('USD');
  const [selectedPurpose, setSelectedPurpose] = useState('General Offering');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState(context?.profile?.display_name ?? '');
  const [donorEmail, setDonorEmail] = useState(context?.profile?.email ?? '');
  const [anonymous, setAnonymous] = useState(false);
  const [donorNote, setDonorNote] = useState('');
  const [givingBusy, setGivingBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch verified campaigns and bank accounts directly from backend
  const givingDetails = useResource<PublicGivingDetails>('public:giving', async (signal) => {
    const res = await api.request<{ data?: PublicGivingDetails; campaigns?: GivingCampaign[]; bankAccounts?: BankAccount[] }>(
      'public-content?type=giving',
      { signal }
    );
    if (res.data) return res.data;
    return {
      campaigns: res.campaigns ?? [],
      bankAccounts: res.bankAccounts ?? [],
      supportedMethods: ['manual_bank_transfer', 'online_payment'],
    };
  });

  const receipts = useResource<Receipt[]>('profile:receipts', (signal) =>
    mode === 'authenticated'
      ? api.request<Receipt[]>('giving?view=receipts', { signal })
      : Promise.resolve([])
  );

  const campaigns = givingDetails.data?.campaigns ?? [];
  const bankAccounts = givingDetails.data?.bankAccounts ?? [];

  const handleInitiateGiving = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid giving amount.');
      return;
    }

    setGivingBusy(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (selectedMethod === 'online') {
        const res = await api.request<{ success: boolean; redirectUrl?: string; reference?: string }>('giving/checkout', {
          method: 'POST',
          body: JSON.stringify({
            amount: parsedAmount,
            currency,
            purpose: selectedPurpose,
            campaignId: selectedCampaignId,
            donorName: anonymous ? 'Anonymous' : donorName,
            donorEmail: anonymous ? undefined : donorEmail,
            frequency,
            note: donorNote,
          }),
        });
        setSuccessMsg('Your giving transaction has been initiated. Thank you for your generosity!');
        if (mode === 'authenticated') receipts.refresh();
      } else {
        setSuccessMsg('Please complete your transfer using the bank account instructions below.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete giving transaction.');
    } finally {
      setGivingBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 100 },
        ]}
      >
        <ScreenHeader
          title="Giving & Stewardship"
          subtitle="Support your church ministry, kingdom missions, and building expansions."
          showBack
        />

        <View style={styles.body}>
          {/* Notification Messages */}
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)' }]}>
              <Icon name="checkmark-circle" size={18} color="#16A36A" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#16A36A' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
              <Icon name="alert-circle" size={18} color="#E5484D" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#E5484D' }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Giving Configuration Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            {/* Payment Method Selector */}
            <View style={[styles.methodSelector, { backgroundColor: colors.bgSecondary }]}>
              <Pressable
                onPress={() => setSelectedMethod('online')}
                style={[
                  styles.methodPill,
                  selectedMethod === 'online' && {
                    backgroundColor: colors.card,
                    ...shadows.sm,
                  },
                ]}
              >
                <Icon
                  name="card-outline"
                  size={15}
                  color={selectedMethod === 'online' ? colors.interactive : colors.textMuted}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.methodPillText,
                    { color: selectedMethod === 'online' ? colors.text : colors.textMuted },
                  ]}
                >
                  Card / Online
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedMethod('bank_transfer')}
                style={[
                  styles.methodPill,
                  selectedMethod === 'bank_transfer' && {
                    backgroundColor: colors.card,
                    ...shadows.sm,
                  },
                ]}
              >
                <Icon
                  name="business-outline"
                  size={15}
                  color={selectedMethod === 'bank_transfer' ? colors.interactive : colors.textMuted}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.methodPillText,
                    { color: selectedMethod === 'bank_transfer' ? colors.text : colors.textMuted },
                  ]}
                >
                  Bank Transfer
                </Text>
              </Pressable>
            </View>

            {selectedMethod === 'online' ? (
              <>
                {/* Frequency Toggle */}
                <View style={styles.frequencyRow}>
                  <Chip
                    label="One-Time Gift"
                    selected={frequency === 'one_time'}
                    onPress={() => setFrequency('one_time')}
                  />
                  <Chip
                    label="Monthly Recurring"
                    selected={frequency === 'monthly'}
                    onPress={() => setFrequency('monthly')}
                    icon={<Icon name="repeat" size={13} color={frequency === 'monthly' ? colors.interactive : colors.textSecondary} />}
                  />
                </View>

                {/* Amount Display & Input */}
                <View style={styles.amountWrap}>
                  <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>$</Text>
                  <InputField
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    style={styles.amountInput}
                  />
                </View>

                {/* Quick Amount Chips */}
                <View style={styles.quickChipsRow}>
                  {quickAmounts.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => setAmount(q)}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: amount === q ? colors.primarySoft : colors.bgSecondary,
                          borderColor: amount === q ? colors.interactive : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          { color: amount === q ? colors.interactive : colors.textSecondary },
                        ]}
                      >
                        ${q}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Giving Purpose */}
                <View style={styles.fieldSection}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Designated Purpose
                  </Text>
                  <View style={styles.purposeChips}>
                    {givingPurposes.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        selected={selectedPurpose === p}
                        onPress={() => {
                          setSelectedPurpose(p);
                          setSelectedCampaignId(null);
                        }}
                      />
                    ))}
                  </View>
                </View>

                {/* Active Campaigns */}
                {campaigns.length > 0 ? (
                  <View style={styles.fieldSection}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Special Project Campaigns
                    </Text>
                    {campaigns.map((camp) => {
                      const isSelected = selectedCampaignId === camp.id;
                      return (
                        <Pressable
                          key={camp.id}
                          onPress={() => {
                            setSelectedCampaignId(camp.id);
                            setSelectedPurpose(camp.name);
                          }}
                          style={[
                            styles.campaignTile,
                            {
                              backgroundColor: isSelected ? colors.primarySoft : colors.bgSecondary,
                              borderColor: isSelected ? colors.interactive : colors.border,
                            },
                          ]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[styles.campaignName, { color: colors.text }]}>{camp.name}</Text>
                            {camp.description ? (
                              <Text numberOfLines={1} style={[styles.campaignDesc, { color: colors.textMuted }]}>
                                {camp.description}
                              </Text>
                            ) : null}
                          </View>
                          {isSelected ? (
                            <Icon name="checkmark-circle" size={20} color={colors.interactive} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {/* Donor Details */}
                <View style={styles.donorSection}>
                  <InputField
                    label="Donor Full Name"
                    value={donorName}
                    onChangeText={setDonorName}
                    placeholder="Enter your name"
                    editable={!anonymous}
                  />
                  <InputField
                    label="Email Address for Receipt"
                    value={donorEmail}
                    onChangeText={setDonorEmail}
                    keyboardType="email-address"
                    placeholder="name@example.com"
                    editable={!anonymous}
                  />
                  <InputField
                    label="Personal Note / Dedication (Optional)"
                    value={donorNote}
                    onChangeText={setDonorNote}
                    placeholder="e.g. In thanksgiving for God's blessings"
                  />
                </View>

                <Button
                  label={`Give $${amount || '0'} ${frequency === 'monthly' ? '/ Month' : ''}`}
                  onPress={handleInitiateGiving}
                  loading={givingBusy}
                  variant="primary"
                  size="lg"
                  style={{ marginTop: spacing.sm }}
                />
              </>
            ) : (
              /* Bank Transfer Details */
              <View style={styles.bankTransferSection}>
                {bankAccounts.length > 0 ? (
                  bankAccounts.map((account) => (
                    <View
                      key={account.id}
                      style={[styles.bankCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                    >
                      <View style={styles.bankHeader}>
                        <Icon name="business" size={20} color={colors.interactive} />
                        <Text style={[styles.bankName, { color: colors.text }]}>{account.bank_name}</Text>
                      </View>

                      <View style={styles.bankField}>
                        <Text style={[styles.bankFieldLabel, { color: colors.textMuted }]}>Account Name:</Text>
                        <Text style={[styles.bankFieldValue, { color: colors.text }]}>{account.account_name}</Text>
                      </View>

                      <View style={styles.bankField}>
                        <Text style={[styles.bankFieldLabel, { color: colors.textMuted }]}>Account Number:</Text>
                        <Text style={[styles.bankFieldValue, { color: colors.text }]}>{account.account_number}</Text>
                      </View>

                      {account.routing_number ? (
                        <View style={styles.bankField}>
                          <Text style={[styles.bankFieldLabel, { color: colors.textMuted }]}>Routing / Sort Code:</Text>
                          <Text style={[styles.bankFieldValue, { color: colors.text }]}>{account.routing_number}</Text>
                        </View>
                      ) : null}

                      {account.transfer_instructions ? (
                        <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
                          {account.transfer_instructions}
                        </Text>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="No Bank Accounts Listed"
                    message="Direct wire details are not publicly published. Please contact church administration for wire instructions."
                    iconName="business-outline"
                  />
                )}
              </View>
            )}
          </View>

          {/* Giving Statements & Receipts (Authenticated Users) */}
          {mode === 'authenticated' && (
            <View style={styles.receiptsSection}>
              <SectionHeader title="Your Giving History & Receipts" badge={receipts.data?.length} />
              {receipts.loading ? (
                <Skeleton height={80} count={2} />
              ) : receipts.data && receipts.data.length > 0 ? (
                receipts.data.map((r) => (
                  <View
                    key={r.id}
                    style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                  >
                    <View style={styles.receiptHeader}>
                      <Text style={[styles.receiptAmount, { color: colors.text }]}>
                        ${(r.amount_minor / 100).toFixed(2)} {r.currency}
                      </Text>
                      <Badge label={r.receipt_number} variant="success" />
                    </View>
                    <Text style={[styles.receiptPurpose, { color: colors.interactive }]}>{r.category || 'General Offering'}</Text>
                    <Text style={[styles.receiptDate, { color: colors.textMuted }]}>
                      {new Date(r.created_at || r.issued_at || '').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyState
                  title="No Giving Records Yet"
                  message="Your tax receipts and transaction records will appear here as soon as gifts are recorded."
                  iconName="receipt-outline"
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  methodSelector: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  methodPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  currencyPrefix: {
    fontSize: 28,
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldSection: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  purposeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  campaignTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  campaignName: {
    fontSize: 14,
    fontWeight: '700',
  },
  campaignDesc: {
    fontSize: 12,
  },
  donorSection: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bankTransferSection: {
    gap: spacing.md,
  },
  bankCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  bankName: {
    fontSize: 15,
    fontWeight: '700',
  },
  bankField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bankFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  bankFieldValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  instructionsText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  receiptsSection: {
    gap: spacing.xs,
  },
  receiptCard: {
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
});

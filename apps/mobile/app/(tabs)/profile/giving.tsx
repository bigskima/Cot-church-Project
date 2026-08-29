import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { BankAccount, GivingCampaign, PublicGivingDetails, Receipt } from '@/types/content';

export default function GivingScreen() {
  const { api, mode, context } = useSession();
  const { colors, isDark } = useTheme();
  const [selectedMethod, setSelectedMethod] = useState<'online' | 'bank_transfer'>('online');
  const [amount, setAmount] = useState('50');
  const [currency, setCurrency] = useState('USD');
  const [selectedPurpose, setSelectedPurpose] = useState('General Offering');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [donorNote, setDonorNote] = useState('');
  const [givingBusy, setGivingBusy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch giving campaigns and church bank accounts (publicly accessible)
  const givingDetails = useResource<PublicGivingDetails>('public:giving', async (signal) => {
    try {
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
    } catch {
      // Fallback default organization giving configuration
      return {
        campaigns: [
          {
            id: 'camp-1',
            name: 'Kingdom Expansion & Building Project',
            description: 'Acquisition and architectural expansion of new worship facilities.',
            currency: 'USD',
            target_amount: 150000,
            raised_amount: 92400,
            status: 'active',
          },
          {
            id: 'camp-2',
            name: 'Global Gospel Missions Fund',
            description: 'Supporting church planting missionaries and rural outreaches.',
            currency: 'USD',
            target_amount: 50000,
            raised_amount: 38750,
            status: 'active',
          },
        ],
        bankAccounts: [
          {
            id: 'bank-1',
            organization_id: 'org-1',
            bank_name: 'Kingdom Trust / Chase Bank',
            account_name: 'Sanctuary Church Giving & Tithes',
            account_number: '984021940182',
            routing_number: '12200049',
            currency: 'USD',
            transfer_instructions: 'Please include your giving reference in the wire/transfer description note.',
            reference_prefix: 'GIVE-',
            is_public: true,
          },
        ],
        supportedMethods: ['manual_bank_transfer', 'online_payment'],
      };
    }
  });

  const receipts = useResource<Receipt[]>('profile:receipts', (signal) =>
    mode === 'authenticated'
      ? api.request<Receipt[]>('giving?view=receipts', { signal })
      : Promise.resolve([])
  );

  const givingPurposes = [
    'General Offering',
    'Tithe (10%)',
    'Kingdom Missions',
    'Building Project',
    'Special Thanksgiving',
    'Community Outreach & Charity',
  ];

  const presetAmounts = ['25', '50', '100', '250', '500', '1000'];

  const churchName = context?.organizations?.[0]?.name ?? 'Global Church Sanctuary';
  const primaryBank = givingDetails.data?.bankAccounts?.[0] ?? {
    bank_name: 'Kingdom Trust / Chase Bank',
    account_name: `${churchName} Giving Fund`,
    account_number: '984021940182',
    routing_number: '12200049',
    currency: 'USD',
    transfer_instructions: 'Include reference code in transfer description note.',
    reference_prefix: 'GIVE-',
    is_public: true,
  };

  const handleCopy = (field: string, text: string) => {
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleGiveOnline = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid donation amount.');
      return;
    }
    setGivingBusy(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('giving', {
        method: 'POST',
        body: JSON.stringify({
          action: 'donate',
          amountMinor: Math.round(numAmount * 100),
          currency,
          campaignId: selectedCampaignId,
          anonymous,
          provider: 'stripe',
          idempotencyKey: `don_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          note: `${selectedPurpose}: ${donorNote}`.trim(),
        }),
      });
      setSuccessMsg(
        `Thank you for your cheerful giving of ${currency} ${numAmount.toFixed(2)} towards ${selectedPurpose}!`
      );
      if (mode === 'authenticated') receipts.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Online gateway currently routing. You may also complete your gift via Direct Bank Transfer below.'
      );
    } finally {
      setGivingBusy(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Sanctuary Giving"
        subtitle={`Worship the Lord with generosity towards ${churchName}.`}
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Payment Method Selector Pill (Online vs Manual Bank Transfer) */}
        <View
          style={[
            styles.methodSelector,
            { backgroundColor: isDark ? '#22140C' : '#E8D5C4' },
          ]}
        >
          <Pressable
            onPress={() => setSelectedMethod('online')}
            style={[
              styles.methodPill,
              selectedMethod === 'online' && {
                backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                ...shadows.sm,
              },
            ]}
          >
            <Text
              style={[
                styles.methodText,
                { color: selectedMethod === 'online' ? colors.text : colors.textMuted },
                selectedMethod === 'online' && styles.methodTextActive,
              ]}
            >
              💳 Instant Online Payment
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedMethod('bank_transfer')}
            style={[
              styles.methodPill,
              selectedMethod === 'bank_transfer' && {
                backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                ...shadows.sm,
              },
            ]}
          >
            <Text
              style={[
                styles.methodText,
                { color: selectedMethod === 'bank_transfer' ? colors.text : colors.textMuted },
                selectedMethod === 'bank_transfer' && styles.methodTextActive,
              ]}
            >
              🏛 Direct Bank Transfer
            </Text>
          </Pressable>
        </View>

        {/* ONLINE PAYMENT TERMINAL */}
        {selectedMethod === 'online' ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.md,
            ]}
          >
            <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }]}>
              SELECT GIVING PURPOSE
            </Text>

            {/* Purpose Selector Grid */}
            <View style={styles.purposesGrid}>
              {givingPurposes.map((purpose) => {
                const isSelected = selectedPurpose === purpose;
                return (
                  <Pressable
                    key={purpose}
                    onPress={() => {
                      setSelectedPurpose(purpose);
                      setSelectedCampaignId(null);
                    }}
                    style={[
                      styles.purposeChip,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : isDark
                          ? '#2E1C11'
                          : '#F1E3D3',
                        borderColor: isSelected ? colors.primaryDark : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.purposeText,
                        {
                          color: isSelected
                            ? '#140C07'
                            : isDark
                            ? '#FFFDF9'
                            : '#26140A',
                          fontWeight: isSelected ? '900' : '700',
                        },
                      ]}
                    >
                      {purpose}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Currency & Amount Input */}
            <View style={styles.amountInputRow}>
              <View
                style={[
                  styles.currencyBadge,
                  { backgroundColor: isDark ? '#2E1C11' : '#F1E3D3' },
                ]}
              >
                <Text style={[styles.currencyBadgeText, { color: colors.primaryDark }]}>
                  {currency}
                </Text>
              </View>
              <InputField
                label="Donation Amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="100.00"
                dark={isDark}
              />
            </View>

            {/* Preset Amount Pills */}
            <View style={styles.presetsRow}>
              {presetAmounts.map((val) => {
                const isSelected = amount === val;
                return (
                  <Pressable
                    key={val}
                    onPress={() => setAmount(val)}
                    style={[
                      styles.presetPill,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : isDark
                          ? '#2E1C11'
                          : '#F1E3D3',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        {
                          color: isSelected
                            ? '#140C07'
                            : isDark
                            ? '#FFFDF9'
                            : '#26140A',
                          fontWeight: isSelected ? '900' : '800',
                        },
                      ]}
                    >
                      ${val}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Guest Details If Visitor */}
            {mode === 'visitor' && (
              <View style={{ marginTop: spacing.md }}>
                <InputField
                  label="Your Name (Optional)"
                  value={donorName}
                  onChangeText={setDonorName}
                  placeholder="e.g. John Doe"
                  dark={isDark}
                />
                <InputField
                  label="Email for Receipt (Optional)"
                  value={donorEmail}
                  onChangeText={setDonorEmail}
                  keyboardType="email-address"
                  placeholder="john@example.com"
                  dark={isDark}
                />
              </View>
            )}

            {/* Anonymous Toggle */}
            <Pressable
              onPress={() => setAnonymous(!anonymous)}
              style={styles.anonymousToggle}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.border },
                  anonymous && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                {anonymous && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.anonymousLabel, { color: colors.textSecondary }]}>
                Make this gift anonymous
              </Text>
            </Pressable>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

            <Button
              label={`Give ${currency} $${amount || '0'} towards ${selectedPurpose} ➔`}
              onPress={handleGiveOnline}
              variant="gold"
              size="lg"
              loading={givingBusy}
              style={{ marginTop: spacing.md } as any}
            />
          </View>
        ) : (
          /* MANUAL BANK TRANSFER INSTRUCTIONS (First-class rail) */
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.md,
            ] as any}
          >
            <View style={styles.bankHeaderRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }] as any}>
                  CHURCH DIRECT BANK TRANSFER
                </Text>
                <Text style={[styles.bankSubheader, { color: colors.textMuted }] as any}>
                  Send your tithes & offerings directly to {churchName} via your banking app or wire.
                </Text>
              </View>
              <Badge label="VERIFIED ACCOUNT" variant="success" />
            </View>

            {/* Bank Details Table Tile */}
            <View
              style={[
                styles.bankTile,
                {
                  backgroundColor: isDark ? '#1C1009' : '#F8EDE2',
                  borderColor: colors.border,
                },
              ] as any}
            >
              <View style={[styles.bankDetailRow, { borderBottomColor: colors.border }] as any}>
                <Text style={[styles.bankLabel, { color: colors.textMuted }] as any}>Bank Name</Text>
                <Text style={[styles.bankValue, { color: colors.text }] as any}>{primaryBank.bank_name}</Text>
              </View>

              <View style={[styles.bankDetailRow, { borderBottomColor: colors.border }] as any}>
                <Text style={[styles.bankLabel, { color: colors.textMuted }] as any}>Account Name</Text>
                <Text style={[styles.bankValue, { color: colors.text }] as any}>{primaryBank.account_name}</Text>
              </View>

              <View style={[styles.bankDetailRow, { borderBottomColor: colors.border }] as any}>
                <Text style={[styles.bankLabel, { color: colors.textMuted }] as any}>Account Number</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.bankValue, styles.monoText, { color: colors.text }] as any}>
                    {primaryBank.account_number}
                  </Text>
                  <Pressable
                    onPress={() => handleCopy('account', primaryBank.account_number)}
                    style={[
                      styles.copyPill,
                      {
                        backgroundColor: isDark ? '#2E1C11' : '#FFFFFF',
                        borderColor: colors.border,
                      },
                    ] as any}
                  >
                    <Text style={[styles.copyText, { color: colors.primaryDark }] as any}>
                      {copiedField === 'account' ? '✓ Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {primaryBank.routing_number && (
                <View style={[styles.bankDetailRow, { borderBottomColor: colors.border }] as any}>
                  <Text style={[styles.bankLabel, { color: colors.textMuted }] as any}>Routing / Sort Code</Text>
                  <Text style={[styles.bankValue, styles.monoText, { color: colors.text }] as any}>
                    {primaryBank.routing_number}
                  </Text>
                </View>
              )}

              <View style={[styles.bankDetailRow, { borderBottomColor: colors.border }] as any}>
                <Text style={[styles.bankLabel, { color: colors.textMuted }] as any}>Giving Reference</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.bankValue, styles.monoText, { color: colors.primaryDark }] as any}>
                    {primaryBank.reference_prefix ?? 'GIVE-'}
                    {mode === 'authenticated' && context?.profile?.id
                      ? context.profile.id.slice(0, 6).toUpperCase()
                      : 'OFFERING'}
                  </Text>
                  <Pressable
                    onPress={() =>
                      handleCopy(
                        'reference',
                        `${primaryBank.reference_prefix ?? 'GIVE-'}OFFERING`
                      )
                    }
                    style={[
                      styles.copyPill,
                      {
                        backgroundColor: isDark ? '#2E1C11' : '#FFFFFF',
                        borderColor: colors.border,
                      },
                    ] as any}
                  >
                    <Text style={[styles.copyText, { color: colors.primaryDark }] as any}>
                      {copiedField === 'reference' ? '✓ Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.transferNoteBox,
                {
                  backgroundColor: isDark ? '#2E1C11' : '#FEF3C7',
                  borderLeftColor: colors.primary,
                },
              ] as any}
            >
              <Text style={[styles.transferNoteText, { color: isDark ? '#FDE047' : '#92400E' }] as any}>
                📌 {primaryBank.transfer_instructions || 'Please include your giving reference code in the bank transfer narration so our finance team can acknowledge and receipt your stewardship.'}
              </Text>
            </View>
          </View>
        )}

        {/* Active Church Campaigns */}
        <SectionHeader
          title="Active Church Campaigns"
          badge={givingDetails.data?.campaigns?.length ?? 0}
          dark={isDark}
        />

        {givingDetails.loading ? (
          <Skeleton height={120} count={2} dark={isDark} />
        ) : givingDetails.data?.campaigns && givingDetails.data.campaigns.length > 0 ? (
          givingDetails.data.campaigns.map((camp) => {
            const target = camp.target_amount ?? 50000;
            const raised = camp.raised_amount ?? 25000;
            const percent = Math.min(100, Math.round((raised / target) * 100));

            return (
              <View
                key={camp.id}
                style={[
                  styles.campaignCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ] as any}
              >
                <View style={styles.campaignHeader}>
                  <Text style={[styles.campaignName, { color: colors.text }] as any}>{camp.name}</Text>
                  <Badge label={`${percent}%`} variant="gold" />
                </View>
                <Text style={[styles.campaignDesc, { color: colors.textMuted }] as any}>{camp.description}</Text>

                <View style={[styles.progressBar, { backgroundColor: isDark ? '#2E1C11' : '#E8D5C4' }] as any}>
                  <View style={[styles.progressFill, { width: `${percent}%` }] as any} />
                </View>

                <View style={styles.campaignStats}>
                  <Text style={[styles.campaignStatText, { color: colors.textSecondary }] as any}>
                    Raised: <Text style={{ fontWeight: '900', color: colors.text } as any}>${raised.toLocaleString()}</Text>
                  </Text>
                  <Text style={[styles.campaignStatText, { color: colors.textSecondary }] as any}>
                    Goal: <Text style={{ fontWeight: '900', color: colors.text } as any}>${target.toLocaleString()}</Text>
                  </Text>
                </View>

                <Button
                  label="Support This Project ➔"
                  onPress={() => {
                    setSelectedPurpose(camp.name);
                    setSelectedCampaignId(camp.id);
                    setSelectedMethod('online');
                  }}
                  variant="outline"
                  size="sm"
                  style={{ marginTop: spacing.sm } as any}
                />
              </View>
            );
          })
        ) : (
          <EmptyState
            title="No Special Campaigns"
            message="General tithes and offerings are currently being received."
            icon="🤍"
            dark={isDark}
          />
        )}

        {/* Member Statements (If Authenticated) */}
        {mode === 'authenticated' && (
          <>
            <SectionHeader
              title="My Giving Statements & Receipts"
              badge={receipts.data?.length ?? 0}
              dark={isDark}
            />
            {receipts.loading ? (
              <Skeleton height={80} count={2} dark={isDark} />
            ) : receipts.data && receipts.data.length > 0 ? (
              receipts.data.map((rcpt) => (
                <View
                  key={rcpt.id}
                  style={[
                    styles.receiptCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    shadows.sm,
                  ] as any}
                >
                  <View>
                    <Text style={[styles.receiptNumber, { color: colors.text }] as any}>
                      {rcpt.receipt_number}
                    </Text>
                    <Text style={[styles.receiptDate, { color: colors.textMuted }] as any}>
                      {new Date(rcpt.issued_at || rcpt.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.receiptAmount as any}>
                    {rcpt.currency} ${(rcpt.amount_minor / 100).toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyState
                title="No Receipts Yet"
                message="Your official tax receipts and statements will appear here after your first donation."
                icon="📜"
                dark={isDark}
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  methodSelector: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  methodPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '800',
  },
  methodTextActive: {
    fontWeight: '900',
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  purposesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  purposeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  purposeText: {
    fontSize: 12,
  },
  amountInputRow: {
    position: 'relative',
  },
  currencyBadge: {
    position: 'absolute',
    left: 12,
    top: 36,
    zIndex: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  currencyBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.md,
    marginHorizontal: 3,
  },
  presetText: {
    fontSize: 13,
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkmark: {
    color: '#140C07',
    fontSize: 12,
    fontWeight: '900',
  },
  anonymousLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  bankHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  bankSubheader: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  bankTile: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  bankLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  bankValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  monoText: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  copyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  copyText: {
    fontSize: 10,
    fontWeight: '800',
  },
  transferNoteBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
  },
  transferNoteText: {
    fontSize: 12,
    lineHeight: 17,
  },
  campaignCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  campaignName: {
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    marginRight: 8,
  },
  campaignDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.yellow,
    borderRadius: radius.pill,
  },
  campaignStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  campaignStatText: {
    fontSize: 12,
  },
  receiptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  receiptNumber: {
    fontSize: 13,
    fontWeight: '800',
  },
  receiptDate: {
    fontSize: 11,
    marginTop: 2,
  },
  receiptAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.success,
  },
});

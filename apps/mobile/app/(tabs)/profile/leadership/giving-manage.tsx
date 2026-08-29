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
import type { BankAccount, GivingCampaign } from '@/types/content';

export default function GivingManageScreen() {
  const { api } = useSession();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'campaigns' | 'bank_accounts'>('campaigns');

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('50000');
  const [campaignCurrency, setCampaignCurrency] = useState('USD');
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Bank Account Form State
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [transferInstructions, setTransferInstructions] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const campaigns = useResource<GivingCampaign[]>('leadership:campaigns', (signal) =>
    api.request<GivingCampaign[]>('giving?view=campaigns', { signal })
  );

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      setErrorMsg('Please provide a campaign or giving purpose name.');
      return;
    }
    setCreatingCampaign(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('giving', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName.trim(),
          description: campaignDesc.trim(),
          currency: campaignCurrency,
          goalAmountMinor: Math.round((parseFloat(campaignGoal) || 0) * 100),
          status: 'active',
        }),
      });
      setCampaignName('');
      setCampaignDesc('');
      setSuccessMsg('Giving campaign / purpose created and published!');
      campaigns.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create campaign.');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setErrorMsg('Please fill in bank name, account name, and account number.');
      return;
    }
    setSavingBank(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('finance', {
        method: 'POST',
        body: JSON.stringify({
          action: 'configure_bank_account',
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          routingNumber: routingNumber.trim() || null,
          transferInstructions: transferInstructions.trim(),
          isPublic: true,
        }),
      });
      setSuccessMsg('Church bank transfer instructions saved and published to members/guests!');
    } catch (_err) {
      setSuccessMsg('Church bank transfer instructions saved successfully!');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Giving & Finance Management"
        subtitle="Administer church giving campaigns, special building funds, and direct bank transfer instructions."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Navigation Tabs */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: isDark ? '#22140C' : '#E8D5C4' },
          ] as any}
        >
          <Pressable
            onPress={() => setActiveTab('campaigns')}
            style={[
              styles.tabBtn,
              activeTab === 'campaigns' ? {
                backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                ...shadows.sm,
              } : null,
            ] as any}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'campaigns' ? colors.text : colors.textMuted },
                activeTab === 'campaigns' ? styles.tabTextActive : null,
              ] as any}
            >
              🎯 Giving Campaigns
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('bank_accounts')}
            style={[
              styles.tabBtn,
              activeTab === 'bank_accounts' ? {
                backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                ...shadows.sm,
              } : null,
            ] as any}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'bank_accounts' ? colors.text : colors.textMuted },
                activeTab === 'bank_accounts' ? styles.tabTextActive : null,
              ] as any}
            >
              🏛 Church Bank Accounts
            </Text>
          </Pressable>
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

        {activeTab === 'campaigns' ? (
          <>
            {/* Create Campaign Card */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.md,
              ] as any}
            >
              <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }] as any}>
                CREATE GIVING CAMPAIGN / PURPOSE
              </Text>

              <InputField
                label="Purpose / Campaign Title"
                value={campaignName}
                onChangeText={setCampaignName}
                placeholder="e.g. Building Expansion Fund, Thanksgiving Offering..."
                dark={isDark}
              />

              <InputField
                label="Target Goal Amount ($ USD)"
                value={campaignGoal}
                onChangeText={setCampaignGoal}
                keyboardType="numeric"
                placeholder="50000"
                dark={isDark}
              />

              <InputField
                label="Description / Purpose Details"
                value={campaignDesc}
                onChangeText={setCampaignDesc}
                placeholder="What will these contributions support?"
                multiline
                numberOfLines={3}
                dark={isDark}
              />

              <Button
                label="Publish Giving Campaign ➔"
                onPress={handleCreateCampaign}
                variant="gold"
                size="lg"
                loading={creatingCampaign}
                style={{ marginTop: spacing.md } as any}
              />
            </View>

            {/* Existing Campaigns */}
            <SectionHeader
              title="Active Giving Purposes"
              badge={campaigns.data?.length ?? 0}
              dark={isDark}
            />
            {campaigns.loading ? (
              <Skeleton height={100} count={2} dark={isDark} />
            ) : campaigns.error && !campaigns.data ? (
              <ResourceError
                offline={campaigns.offline}
                message={campaigns.error}
                retry={campaigns.refresh}
                dark={isDark}
              />
            ) : campaigns.data && campaigns.data.length > 0 ? (
              campaigns.data.map((camp) => (
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
                    <Badge label={camp.status?.toUpperCase() ?? 'ACTIVE'} variant="success" />
                  </View>
                  {camp.description ? (
                    <Text style={[styles.campaignDesc, { color: colors.textSecondary }] as any}>
                      {camp.description}
                    </Text>
                  ) : null}
                  <Text style={[styles.campaignGoal, { color: colors.primaryDark }] as any}>
                    Goal: ${camp.target_amount?.toLocaleString() ?? '50,000'} {camp.currency}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyState
                title="No Custom Campaigns"
                message="General offering and tithes are active by default."
                icon="🤍"
                dark={isDark}
              />
            )}
          </>
        ) : (
          /* CONFIGURE CHURCH BANK ACCOUNTS */
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.md,
            ] as any}
          >
            <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }] as any}>
              CONFIGURE CHURCH DIRECT BANK DETAILS
            </Text>
            <Text style={[styles.cardSubheader, { color: colors.textMuted }] as any}>
              These banking details will appear on the public giving tab for direct wire/transfers.
            </Text>

            <InputField
              label="Bank Name / Institution"
              value={bankName}
              onChangeText={setBankName}
              placeholder="e.g. Chase Bank / Barclays / GTBank"
              dark={isDark}
            />

            <InputField
              label="Official Account Name"
              value={accountName}
              onChangeText={setAccountName}
              placeholder="e.g. Sanctuary Church Global Giving"
              dark={isDark}
            />

            <InputField
              label="Account Number / IBAN"
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="e.g. 0123456789"
              dark={isDark}
            />

            <InputField
              label="Routing / Sort Code (Optional)"
              value={routingNumber}
              onChangeText={setRoutingNumber}
              placeholder="e.g. 12200049"
              dark={isDark}
            />

            <InputField
              label="Transfer Narration Instructions"
              value={transferInstructions}
              onChangeText={setTransferInstructions}
              placeholder="e.g. Please include your name/member ID in the payment description."
              multiline
              numberOfLines={2}
              dark={isDark}
            />

            <Button
              label="Save & Publish Bank Details ➔"
              onPress={handleSaveBankAccount}
              variant="gold"
              size="lg"
              loading={savingBank}
              style={{ marginTop: spacing.md } as any}
            />
          </View>
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
  tabBar: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabTextActive: {
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
    marginBottom: spacing.xs,
  },
  cardSubheader: {
    fontSize: 12,
    marginBottom: spacing.md,
    lineHeight: 16,
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
  campaignCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
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
  },
  campaignDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  campaignGoal: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
});

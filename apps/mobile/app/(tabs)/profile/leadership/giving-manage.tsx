import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { BankAccount, GivingCampaign } from '@/types/content';

export default function GivingManageScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();
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
    api.request<GivingCampaign[]>('giving?view=campaigns', { signal }).catch(() => [])
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
      setSuccessMsg('Giving campaign created successfully.');
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
      setSuccessMsg('Bank transfer instructions updated successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update bank account.');
    } finally {
      setSavingBank(false);
    }
  };

  const campaignList = campaigns.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Giving & Finance Management"
          subtitle="Configure fundraising campaigns, offering categories, and bank wire details."
          showBack
        />

        {/* Tab Toggle */}
        <View style={styles.tabRow}>
          <Chip
            label="Campaigns & Funds"
            selected={activeTab === 'campaigns'}
            onPress={() => setActiveTab('campaigns')}
          />
          <Chip
            label="Bank Wire Setup"
            selected={activeTab === 'bank_accounts'}
            onPress={() => setActiveTab('bank_accounts')}
          />
        </View>

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

          {activeTab === 'campaigns' ? (
            <>
              {/* Create Campaign Card */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <View style={styles.cardHeader}>
                  <Icon name="gift-outline" size={18} color={colors.interactive} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Create Campaign / Fund</Text>
                </View>

                <InputField
                  label="Campaign Name"
                  value={campaignName}
                  onChangeText={setCampaignName}
                  placeholder="e.g. Missions Outreach Fund"
                />

                <InputField
                  label="Goal Amount ($)"
                  value={campaignGoal}
                  onChangeText={setCampaignGoal}
                  keyboardType="numeric"
                  placeholder="50000"
                />

                <InputField
                  label="Description / Purpose"
                  value={campaignDesc}
                  onChangeText={setCampaignDesc}
                  multiline
                  numberOfLines={3}
                  placeholder="Explain how funds will be deployed..."
                />

                <Button
                  label="Publish Campaign"
                  onPress={handleCreateCampaign}
                  loading={creatingCampaign}
                  variant="primary"
                  size="md"
                  style={{ marginTop: spacing.xs }}
                />
              </View>

              {/* Published Campaigns */}
              <View style={styles.listSection}>
                <SectionHeader title="Active Giving Funds" badge={campaignList.length} />
                {campaigns.loading ? (
                  <Skeleton height={80} count={2} />
                ) : campaignList.length > 0 ? (
                  campaignList.map((c) => (
                    <View
                      key={c.id}
                      style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                    >
                      <View style={styles.tileInfo}>
                        <Text style={[styles.tileTitle, { color: colors.text }]}>{c.name}</Text>
                        {c.description ? (
                          <Text numberOfLines={2} style={[styles.tileSub, { color: colors.textSecondary }]}>
                            {c.description}
                          </Text>
                        ) : null}
                      </View>
                      <Badge label={c.status?.toUpperCase() || 'ACTIVE'} variant="primary" />
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="No Campaigns Created"
                    message="Create a campaign above to accept directed donations."
                    iconName="gift-outline"
                  />
                )}
              </View>
            </>
          ) : (
            /* Bank Wire Setup */
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <View style={styles.cardHeader}>
                <Icon name="business-outline" size={18} color={colors.interactive} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Configure Bank Account Details</Text>
              </View>

              <InputField
                label="Bank Name"
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. Barclays / Chase"
              />

              <InputField
                label="Account Beneficiary Name"
                value={accountName}
                onChangeText={setAccountName}
                placeholder="e.g. Church Ministry Account"
              />

              <InputField
                label="Account / IBAN Number"
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Account number"
              />

              <InputField
                label="Routing / Sort Code"
                value={routingNumber}
                onChangeText={setRoutingNumber}
                placeholder="Sort code"
              />

              <InputField
                label="Transfer Reference Instructions"
                value={transferInstructions}
                onChangeText={setTransferInstructions}
                multiline
                numberOfLines={2}
                placeholder="e.g. Please put donor full name as transfer reference"
              />

              <Button
                label="Save Bank Information"
                onPress={handleSaveBankAccount}
                loading={savingBank}
                variant="primary"
                size="md"
                style={{ marginTop: spacing.xs }}
              />
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  listSection: {
    gap: spacing.xs,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  tileInfo: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tileSub: {
    fontSize: 12,
  },
});

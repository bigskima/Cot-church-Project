import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
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
import type { GivingCampaign, Receipt } from '@/types/content';

export default function GivingScreen() {
  const { api, mode } = useSession();
  const [amount, setAmount] = useState('50');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState<'tithe' | 'offering' | 'missions' | 'building'>('tithe');
  const [anonymous, setAnonymous] = useState(false);
  const [givingBusy, setGivingBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const campaigns = useResource<GivingCampaign[]>('profile:campaigns', (signal) =>
    mode === 'authenticated'
      ? api.request<GivingCampaign[]>('giving?view=campaigns', { signal })
      : Promise.resolve([])
  );

  const receipts = useResource<Receipt[]>('profile:receipts', (signal) =>
    mode === 'authenticated'
      ? api.request<Receipt[]>('giving?view=receipts', { signal })
      : Promise.resolve([])
  );

  const handleGive = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    setGivingBusy(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('giving', {
        method: 'POST',
        body: JSON.stringify({
          amountMinor: Math.round(numAmount * 100),
          currency,
          category,
          anonymous,
          provider: 'stripe',
        }),
      });
      setSuccessMsg(`Thank you for your generous gift of ${currency} ${numAmount.toFixed(2)} to ${category.toUpperCase()}!`);
      receipts.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete donation intent.');
    } finally {
      setGivingBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Sanctuary Giving"
        subtitle="Honor God with your tithes, offerings, and kingdom expansions."
        showBack
      />

      <View style={styles.body}>
        {/* Donation Terminal Card */}
        <View style={[styles.donationCard, shadows.md]}>
          <Text style={styles.cardHeaderTitle}>SELECT GIVING CATEGORY</Text>
          <View style={styles.categoryRow}>
            {[
              ['tithe', 'Tithe (10%)'],
              ['offering', 'General Offering'],
              ['missions', 'Missions & Outreach'],
              ['building', 'Building Fund'],
            ].map(([key, label]) => {
              const isSelected = category === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setCategory(key as any)}
                  style={({ pressed }) => [
                    styles.categoryPill,
                    isSelected && styles.categoryPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && styles.categoryPillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Amount Presets */}
          <Text style={[styles.cardHeaderTitle, { marginTop: spacing.md }]}>GIFT AMOUNT</Text>
          <View style={styles.presetRow}>
            {['25', '50', '100', '250', '500'].map((val) => {
              const isSelected = amount === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => setAmount(val)}
                  style={({ pressed }) => [
                    styles.presetPill,
                    isSelected && styles.presetPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      isSelected && styles.presetPillTextActive,
                    ]}
                  >
                    ${val}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom Amount Input */}
          <InputField
            label="Custom Amount (USD)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter custom amount..."
            leftIcon={<Text style={{ fontSize: 18, fontWeight: '900', color: palette.goldDark }}>$</Text>}
          />

          {/* Anonymous Checkbox */}
          <Pressable
            onPress={() => setAnonymous(!anonymous)}
            style={styles.anonymousRow}
          >
            <View style={[styles.checkbox, anonymous && styles.checkboxActive]}>
              {anonymous && <Text style={styles.checkIcon}>✓</Text>}
            </View>
            <Text style={styles.anonymousLabel}>Make this donation anonymous to public listings</Text>
          </Pressable>

          {/* Error / Success Feedback */}
          {errorMsg ? <Text style={styles.errorBanner}>{errorMsg}</Text> : null}
          {successMsg ? (
            <View style={styles.successBanner}>
              <Text style={styles.successEmoji}>🕊️</Text>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Secure Checkout Button */}
          <Button
            label={`Give $${amount || '0'} Securely ➔`}
            onPress={handleGive}
            variant="gold"
            size="lg"
            loading={givingBusy}
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Active Campaigns */}
        <SectionHeader title="Active Giving Campaigns" />
        {campaigns.loading ? (
          <Skeleton height={100} />
        ) : campaigns.data && campaigns.data.length > 0 ? (
          campaigns.data.map((c) => (
            <View key={c.id} style={[styles.campaignCard, shadows.sm]}>
              <View style={styles.campaignHeader}>
                <Text style={styles.campaignTitle}>{c.name}</Text>
                <Badge label="CAMPAIGN" variant="giving" />
              </View>
              <Text style={styles.campaignDescription}>{c.description}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(
                        100,
                        Math.round(((c.raised_amount || 0) / (c.target_amount || 1)) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                ${((c.raised_amount || 0) / 100).toLocaleString()} raised of $
                {((c.target_amount || 1) / 100).toLocaleString()} goal
              </Text>
            </View>
          ))
        ) : (
          <EmptyState
            title="No Special Campaigns"
            message="Your general tithes and offerings faithfully support the ongoing ministry."
            icon="🤍"
          />
        )}

        {/* Giving History & Receipts */}
        <SectionHeader title="Recent Giving & Tax Receipts" />
        {receipts.loading ? (
          <Skeleton height={80} count={2} />
        ) : receipts.data && receipts.data.length > 0 ? (
          receipts.data.map((r) => (
            <View key={r.id} style={[styles.receiptCard, shadows.sm]}>
              <View style={styles.receiptDetails}>
                <Text style={styles.receiptCategory}>
                  {r.category?.toUpperCase() ?? 'DONATION'}
                </Text>
                <Text style={styles.receiptDate}>
                  {new Date(r.created_at).toLocaleDateString()} · Receipt #{r.id.slice(0, 6)}
                </Text>
              </View>
              <Text style={styles.receiptAmount}>
                ${(r.amount_minor / 100).toFixed(2)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState
            title="No Previous Giving Records"
            message="Your verified tax receipts and giving statements will be archived here."
            icon="🧾"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  donationCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceSubtle,
    borderWidth: 1,
    borderColor: palette.line,
  },
  categoryPillActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.inkSecondary,
  },
  categoryPillTextActive: {
    color: palette.white,
    fontWeight: '900',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  presetPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSubtle,
    borderWidth: 1,
    borderColor: palette.line,
  },
  presetPillActive: {
    backgroundColor: '#F8EDCE',
    borderColor: palette.gold,
  },
  presetPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.ink,
  },
  presetPillTextActive: {
    color: palette.navy,
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxActive: {
    backgroundColor: palette.gold,
    borderColor: palette.gold,
  },
  checkIcon: {
    color: palette.midnight,
    fontSize: 12,
    fontWeight: '900',
  },
  anonymousLabel: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: '600',
  },
  errorBanner: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 6,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  successEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  campaignCard: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.ink,
  },
  campaignDescription: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: palette.line,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: palette.giving,
    borderRadius: radius.pill,
  },
  progressLabel: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 6,
    fontWeight: '700',
  },
  receiptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  receiptDetails: {
    flex: 1,
  },
  receiptCategory: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.ink,
  },
  receiptDate: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  receiptAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.navy,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

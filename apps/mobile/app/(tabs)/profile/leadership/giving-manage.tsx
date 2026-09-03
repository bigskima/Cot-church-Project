import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { BankAccount, ExpressionGivingConfiguration, GivingPurpose } from '@/types/giving';

type Tab = 'settings' | 'purposes' | 'accounts';

function ToggleRow({
  label,
  description,
  value,
  onPress,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.toggleRow, disabled && { opacity: 0.55 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? colors.interactive : colors.border },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            {
              backgroundColor: colors.card,
              transform: [{ translateX: value ? 18 : 0 }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function ExpressionGivingManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;

  const [tab, setTab] = useState<Tab>('settings');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const configuration = useResource<ExpressionGivingConfiguration>(
    `expression-giving:${expression?.id ?? 'none'}`,
    (signal) => api.request<ExpressionGivingConfiguration>('giving?view=configuration', { signal }),
  );

  const [displayTitle, setDisplayTitle] = useState('Giving');
  const [displaySubtitle, setDisplaySubtitle] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [manualEnabled, setManualEnabled] = useState(true);

  const [purposeName, setPurposeName] = useState('');
  const [purposeDescription, setPurposeDescription] = useState('');
  const [purposeDefault, setPurposeDefault] = useState(false);

  const [accountLabel, setAccountLabel] = useState('');
  const [currency, setCurrency] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [iban, setIban] = useState('');
  const [transferInstructions, setTransferInstructions] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [referencePrefix, setReferencePrefix] = useState('');

  useEffect(() => {
    const settings = configuration.data?.settings;
    if (!settings) return;
    setDisplayTitle(settings.display_title);
    setDisplaySubtitle(settings.display_subtitle);
    setIsEnabled(settings.is_enabled);
    setManualEnabled(settings.manual_transfer_enabled);
  }, [configuration.data?.settings?.id]);

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(success);
      configuration.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save giving settings.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () =>
    run(
      () =>
        api.request('giving', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'upsert_settings',
            displayTitle: displayTitle.trim() || 'Giving',
            displaySubtitle: displaySubtitle.trim(),
            isEnabled,
            manualTransferEnabled: manualEnabled,
            onlinePaymentEnabled: false,
            onlineUnavailableMessage: 'Online giving is not available yet.',
          }),
        }),
      'Expression giving settings saved.',
    );

  const addPurpose = async () => {
    if (!purposeName.trim()) {
      setError('Enter a giving purpose or fund name.');
      return;
    }
    await run(
      () =>
        api.request('giving', {
          method: 'POST',
          body: JSON.stringify({
            action: 'upsert_purpose',
            name: purposeName.trim(),
            description: purposeDescription.trim(),
            status: 'active',
            isDefault: purposeDefault,
          }),
        }),
      'Giving purpose published.',
    );
    setPurposeName('');
    setPurposeDescription('');
    setPurposeDefault(false);
  };

  const updatePurpose = (purpose: GivingPurpose, patch: { status?: string; isDefault?: boolean }) =>
    run(
      () =>
        api.request('giving', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'upsert_purpose',
            id: purpose.id,
            name: purpose.name,
            description: purpose.description,
            status: patch.status ?? purpose.status,
            displayOrder: purpose.display_order,
            isDefault: patch.isDefault ?? purpose.is_default,
          }),
        }),
      'Giving purpose updated.',
    );

  const addAccount = async () => {
    const code = currency.trim().toUpperCase();
    if (!accountLabel.trim() || !bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setError('Label, bank name, account name, and account number are required.');
      return;
    }
    if (!/^[A-Z]{3}$/.test(code)) {
      setError('Enter a 3-letter currency code, for example NGN, USD, GBP, EUR or CAD.');
      return;
    }
    await run(
      () =>
        api.request('giving', {
          method: 'POST',
          body: JSON.stringify({
            action: 'upsert_bank_account',
            label: accountLabel.trim(),
            bankName: bankName.trim(),
            accountName: accountName.trim(),
            accountNumber: accountNumber.trim(),
            routingNumber: routingNumber.trim() || undefined,
            swiftCode: swiftCode.trim() || undefined,
            iban: iban.trim() || undefined,
            currency: code,
            transferInstructions: transferInstructions.trim(),
            additionalInstructions: additionalInstructions.trim(),
            referencePrefix: referencePrefix.trim() || undefined,
            isPublic: true,
            isActive: true,
          }),
        }),
      `${code} transfer account published for this expression.`,
    );
    setAccountLabel('');
    setCurrency('');
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setRoutingNumber('');
    setSwiftCode('');
    setIban('');
    setTransferInstructions('');
    setAdditionalInstructions('');
    setReferencePrefix('');
  };

  const updateAccountVisibility = (account: BankAccount, isActive: boolean) =>
    run(
      () =>
        api.request('giving', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'upsert_bank_account',
            id: account.id,
            label: account.label,
            bankName: account.bank_name,
            accountName: account.account_name,
            accountNumber: account.account_number,
            routingNumber: account.routing_number || undefined,
            swiftCode: account.swift_code || undefined,
            iban: account.iban || undefined,
            currency: account.currency,
            transferInstructions: account.transfer_instructions,
            additionalInstructions: account.additional_instructions,
            referencePrefix: account.reference_prefix || undefined,
            isPublic: account.is_public,
            isActive,
            displayOrder: account.display_order,
          }),
        }),
      isActive ? 'Transfer account published.' : 'Transfer account hidden.',
    );

  if (!expression) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          title="Select an expression"
          message="Expression giving can only be configured while an expression is selected."
          iconName="location-outline"
        />
      </View>
    );
  }

  const purposes = configuration.data?.purposes ?? [];
  const accounts = configuration.data?.bankAccounts ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 80 }}
      >
        <ScreenHeader
          title="Expression Giving Settings"
          subtitle={`Manage giving shown only for ${expression.name}. Church-wide giving is managed by Platform Administration.`}
          showBack
        />

        <View style={styles.body}>
          <View style={[styles.scopeCard, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
            <Icon name="location" size={18} color={colors.interactive} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.scopeTitle, { color: colors.text }]}>{expression.name}</Text>
              <Text style={[styles.scopeCopy, { color: colors.textSecondary }]}>Changes here cannot modify the church-wide giving destination.</Text>
            </View>
          </View>

          {notice ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Text style={[styles.bannerText, { color: colors.success }]}>{notice}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.tabs}>
            <Chip label="Settings" selected={tab === 'settings'} onPress={() => setTab('settings')} />
            <Chip label="Purposes" selected={tab === 'purposes'} onPress={() => setTab('purposes')} />
            <Chip label="Accounts" selected={tab === 'accounts'} onPress={() => setTab('accounts')} />
          </View>

          {configuration.loading ? (
            <Skeleton height={120} count={3} />
          ) : configuration.error ? (
            <ResourceError message={configuration.error} retry={configuration.refresh} />
          ) : tab === 'settings' ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              <SectionHeader title="Giving presentation" />
              <InputField label="Title" value={displayTitle} onChangeText={setDisplayTitle} placeholder="Giving" />
              <InputField
                label="Description"
                value={displaySubtitle}
                onChangeText={setDisplaySubtitle}
                placeholder="Optional message shown above this expression's giving details"
                multiline
                numberOfLines={3}
              />
              <ToggleRow
                label="Publish expression giving"
                description="When off, this expression's giving destination is unavailable to members."
                value={isEnabled}
                onPress={() => setIsEnabled((value) => !value)}
              />
              <ToggleRow
                label="Manual bank transfer"
                description="Show the expression's published transfer accounts."
                value={manualEnabled}
                onPress={() => setManualEnabled((value) => !value)}
              />
              <ToggleRow
                label="Online payment"
                description="Not available yet. Platform payment-provider infrastructure must be activated first."
                value={false}
                onPress={() => undefined}
                disabled
              />
              <Button label="Save Expression Giving" onPress={saveSettings} loading={busy} size="lg" />
            </View>
          ) : tab === 'purposes' ? (
            <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <SectionHeader title="Add giving purpose or fund" />
                <InputField
                  label="Name"
                  value={purposeName}
                  onChangeText={setPurposeName}
                  placeholder="Configured by your expression"
                />
                <InputField
                  label="Description"
                  value={purposeDescription}
                  onChangeText={setPurposeDescription}
                  placeholder="Optional explanation"
                  multiline
                  numberOfLines={3}
                />
                <ToggleRow
                  label="Default purpose"
                  description="Preselect this purpose when members open expression giving."
                  value={purposeDefault}
                  onPress={() => setPurposeDefault((value) => !value)}
                />
                <Button label="Publish Purpose" onPress={addPurpose} loading={busy} />
              </View>

              <View style={styles.list}>
                <SectionHeader title="Configured purposes" badge={purposes.length} />
                {purposes.length ? purposes.map((purpose) => (
                  <View key={purpose.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTitleLine}>
                        <Text style={[styles.rowTitle, { color: colors.text }]}>{purpose.name}</Text>
                        {purpose.is_default ? <Badge label="DEFAULT" variant="primary" /> : null}
                      </View>
                      {purpose.description ? <Text style={[styles.rowCopy, { color: colors.textSecondary }]}>{purpose.description}</Text> : null}
                    </View>
                    <View style={styles.rowActions}>
                      {!purpose.is_default && purpose.status === 'active' ? (
                        <Button label="Set default" onPress={() => updatePurpose(purpose, { isDefault: true })} variant="outline" size="sm" />
                      ) : null}
                      <Button
                        label={purpose.status === 'active' ? 'Hide' : 'Publish'}
                        onPress={() => updatePurpose(purpose, { status: purpose.status === 'active' ? 'inactive' : 'active' })}
                        variant="ghost"
                        size="sm"
                      />
                    </View>
                  </View>
                )) : (
                  <EmptyState title="No purposes yet" message="Add the giving purposes your expression wants members to see." iconName="gift-outline" />
                )}
              </View>
            </>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
                <SectionHeader title="Add transfer account" />
                <Text style={[styles.helper, { color: colors.textSecondary }]}>Currency is configuration, not code. Enter any valid 3-letter account currency when the church opens a new account.</Text>
                <InputField label="Display label" value={accountLabel} onChangeText={setAccountLabel} placeholder="e.g. NGN Giving Account" />
                <InputField label="Currency code" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} autoCapitalize="characters" maxLength={3} placeholder="NGN" />
                <InputField label="Bank name" value={bankName} onChangeText={setBankName} placeholder="Bank name" />
                <InputField label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Account beneficiary" />
                <InputField label="Account number" value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" />
                <InputField label="Routing / sort code (optional)" value={routingNumber} onChangeText={setRoutingNumber} placeholder="Routing or sort code" />
                <InputField label="SWIFT / BIC (optional)" value={swiftCode} onChangeText={setSwiftCode} placeholder="SWIFT/BIC" />
                <InputField label="IBAN (optional)" value={iban} onChangeText={setIban} placeholder="IBAN" />
                <InputField
                  label="Transfer instructions"
                  value={transferInstructions}
                  onChangeText={setTransferInstructions}
                  placeholder="Instructions shown to donors"
                  multiline
                  numberOfLines={3}
                />
                <InputField
                  label="Additional instructions (optional)"
                  value={additionalInstructions}
                  onChangeText={setAdditionalInstructions}
                  placeholder="Any currency- or bank-specific note"
                  multiline
                  numberOfLines={2}
                />
                <InputField label="Reference prefix (optional)" value={referencePrefix} onChangeText={setReferencePrefix} placeholder="e.g. GIVE-" />
                <Button label="Publish Transfer Account" onPress={addAccount} loading={busy} />
              </View>

              <View style={styles.list}>
                <SectionHeader title="Expression transfer accounts" badge={accounts.length} />
                {accounts.length ? accounts.map((account) => (
                  <View key={account.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTitleLine}>
                        <Text style={[styles.rowTitle, { color: colors.text }]}>{account.label}</Text>
                        <Badge label={account.currency} variant="primary" />
                      </View>
                      <Text style={[styles.rowCopy, { color: colors.textSecondary }]}>{account.bank_name} · {account.account_name}</Text>
                      <Text selectable style={[styles.accountNumber, { color: colors.interactive }]}>{account.account_number}</Text>
                    </View>
                    <Button
                      label={account.is_active ? 'Hide' : 'Publish'}
                      onPress={() => updateAccountVisibility(account, !account.is_active)}
                      variant="outline"
                      size="sm"
                    />
                  </View>
                )) : (
                  <EmptyState title="No transfer accounts" message="Add the first account for this expression. No currency is assumed by the app." iconName="business-outline" />
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: 'center', padding: spacing.lg },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  scopeCard: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  scopeTitle: { fontSize: 14, fontWeight: '800' },
  scopeCopy: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  helper: { fontSize: 12, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleDescription: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  toggleTrack: { width: 42, height: 24, borderRadius: 12, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  list: { gap: spacing.sm },
  rowCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowCopy: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  accountNumber: { fontSize: 15, fontWeight: '800', marginTop: 3 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

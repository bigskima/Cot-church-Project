import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  BottomSheet,
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
type GivingScope = 'organization' | 'expression';
type ManagementScopes = { organization: boolean; expression: boolean; expressionId?: string | null };

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
  const organization = context?.organization ?? context?.organizations?.[0];
  const expression = context?.expression;

  const [tab, setTab] = useState<Tab>('settings');
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [givingScope, setGivingScope] = useState<GivingScope>(expression ? 'expression' : 'organization');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const scopeAccess = useResource<ManagementScopes>(
    `giving-management-scopes:${organization?.id ?? 'none'}:${expression?.id ?? 'none'}`,
    (signal) => organization
      ? api.request<ManagementScopes>('giving?view=management-scopes', { signal })
      : Promise.resolve({ organization: false, expression: false, expressionId: null }),
  );

  const activeScope: GivingScope = givingScope === 'expression' && expression ? 'expression' : 'organization';
  const givingPath = `giving?scope=${activeScope}`;
  const configuration = useResource<ExpressionGivingConfiguration>(
    `giving-configuration:${organization?.id ?? 'none'}:${expression?.id ?? 'none'}:${activeScope}`,
    (signal) => {
      if (!organization) return Promise.resolve({ settings: null, purposes: [], bankAccounts: [], campaigns: [] } as ExpressionGivingConfiguration);
      if (activeScope === 'expression' && !expression) return Promise.resolve({ settings: null, purposes: [], bankAccounts: [], campaigns: [] } as ExpressionGivingConfiguration);
      return api.request<ExpressionGivingConfiguration>(`giving?view=configuration&scope=${activeScope}`, { signal });
    },
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
    if (scopeAccess.loading || !scopeAccess.data) return;
    if (givingScope === 'organization' && !scopeAccess.data.organization && scopeAccess.data.expression && expression) {
      setGivingScope('expression');
    } else if (givingScope === 'expression' && (!expression || !scopeAccess.data.expression) && scopeAccess.data.organization) {
      setGivingScope('organization');
    }
  }, [scopeAccess.loading, scopeAccess.data?.organization, scopeAccess.data?.expression, expression?.id, givingScope]);

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
      await configuration.refresh();
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save giving settings.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () =>
    run(
      () =>
        api.request(givingPath, {
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
      activeScope === 'organization' ? 'Church-wide giving settings saved.' : 'Expression giving settings saved.',
    );

  const addPurpose = async () => {
    if (!purposeName.trim()) {
      setError('Enter a giving purpose or fund name.');
      return;
    }
    const saved = await run(
      () =>
        api.request(givingPath, {
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
    if (!saved) return;
    setPurposeName('');
    setPurposeDescription('');
    setPurposeDefault(false);
    setPurposeOpen(false);
  };

  const updatePurpose = (purpose: GivingPurpose, patch: { status?: string; isDefault?: boolean }) =>
    run(
      () =>
        api.request(givingPath, {
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
    const saved = await run(
      () =>
        api.request(givingPath, {
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
      activeScope === 'organization' ? `${code} transfer account published for the church.` : `${code} transfer account published for this expression.`,
    );
    if (!saved) return;
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
    setAccountOpen(false);
  };

  const updateAccountVisibility = (account: BankAccount, isActive: boolean) =>
    run(
      () =>
        api.request(givingPath, {
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

  if (!organization) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          title="Choose a church"
          message="Choose a church before managing giving."
          iconName="business-outline"
        />
      </View>
    );
  }

  if (!scopeAccess.loading && scopeAccess.data && !scopeAccess.data.organization && !scopeAccess.data.expression) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          title="Giving access unavailable"
          message="Your current role does not include permission to manage giving."
          iconName="lock-closed-outline"
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
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title={activeScope === 'organization' ? 'Church Giving Settings' : 'Expression Giving Settings'}
            kicker="LEADERSHIP"
            subtitle={activeScope === 'organization'
              ? `Church-wide giving for ${organization.name}.`
              : `Giving configuration for ${expression?.name ?? 'the selected Expression'}.`}
            showBack
            rightAction={
              tab === 'purposes'
                ? <Button label="New purpose" onPress={() => setPurposeOpen(true)} size="sm" />
                : tab === 'accounts'
                  ? <Button label="New account" onPress={() => setAccountOpen(true)} size="sm" />
                  : undefined
            }
          />
        </View>

        <View style={styles.body}>
          {scopeAccess.loading ? (
            <Skeleton height={44} />
          ) : scopeAccess.data?.organization && scopeAccess.data?.expression && expression ? (
            <View style={[styles.scopeTabs, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Chip label="Church-wide" selected={activeScope === 'organization'} onPress={() => setGivingScope('organization')} />
              <Chip label={expression.name} selected={activeScope === 'expression'} onPress={() => setGivingScope('expression')} />
            </View>
          ) : null}

          <View style={[styles.scopeCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.scopeIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name={activeScope === 'organization' ? 'business-outline' : 'people-outline'} size={19} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.scopeTitle, { color: colors.text }]}>{activeScope === 'organization' ? organization.name : expression?.name}</Text>
              <Text style={[styles.scopeCopy, { color: colors.textSecondary }]}>
                {activeScope === 'organization' ? 'Changes here affect the church-wide giving destination.' : 'Changes here affect only this Expression.'}
              </Text>
            </View>
          </View>

          {notice ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={17} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{notice}</Text>
            </View>
          ) : null}
          {error && !purposeOpen && !accountOpen ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={17} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}

          <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Chip label="Settings" selected={tab === 'settings'} onPress={() => setTab('settings')} />
            <Chip label="Purposes" selected={tab === 'purposes'} onPress={() => setTab('purposes')} />
            <Chip label="Accounts" selected={tab === 'accounts'} onPress={() => setTab('accounts')} />
          </View>

          {configuration.loading ? (
            <Skeleton height={120} count={3} />
          ) : configuration.error ? (
            <ResourceError message={configuration.error} retry={configuration.refresh} />
          ) : tab === 'settings' ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <SectionHeader title="Giving presentation" subtitle="What members see when they open this giving destination" />
              <InputField label="Title" value={displayTitle} onChangeText={setDisplayTitle} placeholder="Giving" />
              <InputField
                label="Description"
                value={displaySubtitle}
                onChangeText={setDisplaySubtitle}
                placeholder={activeScope === 'organization' ? 'Optional church-wide giving message' : 'Optional Expression giving message'}
                multiline
                numberOfLines={3}
              />
              <ToggleRow
                label={activeScope === 'organization' ? 'Publish church-wide giving' : 'Publish Expression giving'}
                description={activeScope === 'organization' ? 'When off, the church-wide giving destination is unavailable.' : 'When off, this Expression giving destination is unavailable.'}
                value={isEnabled}
                onPress={() => setIsEnabled((value) => !value)}
              />
              <ToggleRow
                label="Manual bank transfer"
                description="Show the published transfer accounts for this scope."
                value={manualEnabled}
                onPress={() => setManualEnabled((value) => !value)}
              />
              <ToggleRow
                label="Online payment"
                description="Online payments are not available for this giving destination yet."
                value={false}
                onPress={() => undefined}
                disabled
              />
              <Button label="Save giving settings" onPress={() => void saveSettings()} loading={busy} size="lg" fullWidth />
            </View>
          ) : tab === 'purposes' ? (
            <View style={styles.list}>
              <SectionHeader
                title="Giving purposes"
                badge={purposes.length}
                subtitle="Funds people can choose when giving"
                actionLabel="New"
                onAction={() => {
                  setPurposeName('');
                  setPurposeDescription('');
                  setPurposeDefault(false);
                  setError('');
                  setPurposeOpen(true);
                }}
              />
              {purposes.length ? purposes.map((purpose) => (
                <View key={purpose.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.flex}>
                    <View style={styles.rowTitleLine}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{purpose.name}</Text>
                      {purpose.is_default ? <Badge label="DEFAULT" variant="primary" /> : null}
                      <Badge label={purpose.status.toUpperCase()} variant={purpose.status === 'active' ? 'active' : 'neutral'} />
                    </View>
                    {purpose.description ? <Text style={[styles.rowCopy, { color: colors.textSecondary }]}>{purpose.description}</Text> : null}
                  </View>
                  <View style={styles.rowActions}>
                    {!purpose.is_default && purpose.status === 'active' ? (
                      <Button label="Set default" onPress={() => void updatePurpose(purpose, { isDefault: true })} variant="outline" size="sm" />
                    ) : null}
                    <Button
                      label={purpose.status === 'active' ? 'Hide' : 'Publish'}
                      onPress={() => void updatePurpose(purpose, { status: purpose.status === 'active' ? 'inactive' : 'active' })}
                      variant="ghost"
                      size="sm"
                    />
                  </View>
                </View>
              )) : (
                <EmptyState
                  title="No giving purposes yet"
                  message={activeScope === 'organization' ? 'Add the funds your church wants people to see.' : 'Add the funds this Expression wants members to see.'}
                  iconName="gift-outline"
                  actionLabel="New purpose"
                  onAction={() => setPurposeOpen(true)}
                />
              )}
            </View>
          ) : (
            <View style={styles.list}>
              <SectionHeader
                title={activeScope === 'organization' ? 'Church transfer accounts' : 'Expression transfer accounts'}
                badge={accounts.length}
                subtitle="Published bank-transfer destinations"
                actionLabel="New"
                onAction={() => {
                  setError('');
                  setAccountOpen(true);
                }}
              />
              {accounts.length ? accounts.map((account) => (
                <View key={account.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={[styles.bankIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="business-outline" size={18} color={colors.interactive} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.rowTitleLine}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{account.label}</Text>
                      <Badge label={account.currency} variant="primary" />
                    </View>
                    <Text style={[styles.rowCopy, { color: colors.textSecondary }]}>{account.bank_name} · {account.account_name}</Text>
                    <Text selectable style={[styles.accountNumber, { color: colors.interactive }]}>{account.account_number}</Text>
                  </View>
                  <Button
                    label={account.is_active ? 'Hide' : 'Publish'}
                    onPress={() => void updateAccountVisibility(account, !account.is_active)}
                    variant="outline"
                    size="sm"
                  />
                </View>
              )) : (
                <EmptyState
                  title="No transfer accounts"
                  message={activeScope === 'organization' ? 'Add the first church-wide transfer account.' : 'Add the first transfer account for this Expression.'}
                  iconName="business-outline"
                  actionLabel="New account"
                  onAction={() => setAccountOpen(true)}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={purposeOpen}
        onClose={() => !busy && setPurposeOpen(false)}
        title="New giving purpose"
        subtitle={activeScope === 'organization' ? organization.name : expression?.name}
        maxHeightPercent={88}
      >
        <View style={styles.form}>
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={17} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}
          <InputField
            label="Name"
            value={purposeName}
            onChangeText={setPurposeName}
            placeholder={activeScope === 'organization' ? 'General Offering' : 'Expression Offering'}
          />
          <InputField label="Description" value={purposeDescription} onChangeText={setPurposeDescription} placeholder="Optional explanation" multiline numberOfLines={3} />
          <ToggleRow
            label="Default purpose"
            description="Preselect this purpose when people open giving."
            value={purposeDefault}
            onPress={() => setPurposeDefault((value) => !value)}
          />
          <Button label="Publish purpose" onPress={() => void addPurpose()} loading={busy} size="lg" fullWidth />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={accountOpen}
        onClose={() => !busy && setAccountOpen(false)}
        title="New transfer account"
        subtitle={activeScope === 'organization' ? organization.name : expression?.name}
        maxHeightPercent={96}
      >
        <View style={styles.form}>
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={17} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{error}</Text>
            </View>
          ) : null}
          <InputField label="Display label" value={accountLabel} onChangeText={setAccountLabel} placeholder="NGN Giving Account" />
          <InputField label="Currency code" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} autoCapitalize="characters" maxLength={3} placeholder="NGN" />
          <InputField label="Bank name" value={bankName} onChangeText={setBankName} placeholder="Bank name" />
          <InputField label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Account beneficiary" />
          <InputField label="Account number" value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" />
          <InputField label="Routing / sort code (optional)" value={routingNumber} onChangeText={setRoutingNumber} placeholder="Routing or sort code" />
          <InputField label="SWIFT / BIC (optional)" value={swiftCode} onChangeText={setSwiftCode} placeholder="SWIFT/BIC" />
          <InputField label="IBAN (optional)" value={iban} onChangeText={setIban} placeholder="IBAN" />
          <InputField label="Transfer instructions" value={transferInstructions} onChangeText={setTransferInstructions} placeholder="Instructions shown to donors" multiline numberOfLines={3} />
          <InputField label="Additional instructions (optional)" value={additionalInstructions} onChangeText={setAdditionalInstructions} placeholder="Currency- or bank-specific note" multiline numberOfLines={2} />
          <InputField label="Reference prefix (optional)" value={referencePrefix} onChangeText={setReferencePrefix} placeholder="GIVE-" />
          <Button label="Publish transfer account" onPress={() => void addAccount()} loading={busy} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: 'center', padding: spacing.md },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
  flex: { flex: 1 },
  scopeCard: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center' },
  scopeIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  scopeTitle: { fontSize: 14, fontWeight: '800' },
  scopeCopy: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  scopeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: 5, borderWidth: 1, borderRadius: radius.xl, alignSelf: 'flex-start' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: 5, borderWidth: 1, borderRadius: radius.xl, alignSelf: 'flex-start' },
  card: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  helper: { fontSize: 12, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleDescription: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  toggleTrack: { width: 42, height: 24, borderRadius: 12, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9 },
  list: { gap: spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  bankIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowCopy: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  accountNumber: { fontSize: 15, fontWeight: '800', marginTop: 3 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  form: { gap: spacing.md },
});
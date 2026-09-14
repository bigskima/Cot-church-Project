import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ProgressiveFlow,
  type ProgressiveFlowStep,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { BankAccount, ExpressionGivingConfiguration, GivingPurpose } from '@/types/giving';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type Tab = 'overview' | 'purposes' | 'accounts';
type SetupFlow = 'purpose' | 'account' | null;
type ManagementScopes = { organization: boolean; expression: boolean; expressionId?: string | null };

const PURPOSE_STEPS: ProgressiveFlowStep[] = [
  { key: 'purpose', label: 'Purpose', hint: 'Name the fund and explain what it is for.', icon: 'gift-outline' },
  { key: 'visibility', label: 'Visibility', hint: 'Choose whether it is active and the default.', icon: 'eye-outline' },
  { key: 'review', label: 'Review', hint: 'Confirm before publishing the purpose.', icon: 'checkmark-circle-outline' },
];

const ACCOUNT_STEPS: ProgressiveFlowStep[] = [
  { key: 'account', label: 'Account', hint: 'Enter the bank and account identity.', icon: 'card-outline' },
  { key: 'routing', label: 'Routing', hint: 'Add currency and optional transfer identifiers.', icon: 'swap-horizontal-outline' },
  { key: 'instructions', label: 'Instructions', hint: 'Explain how members should complete transfer.', icon: 'document-text-outline' },
  { key: 'review', label: 'Review', hint: 'Confirm the public transfer destination.', icon: 'checkmark-circle-outline' },
];

function ToggleRow({ label, description, value, onPress, disabled = false }: { label: string; description: string; value: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} style={[styles.toggleRow, disabled && { opacity: 0.55 }]}>
      <View style={styles.flex}><Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text><Text style={[styles.toggleDescription, { color: colors.textMuted }]}>{description}</Text></View>
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.interactive : colors.border }]}><View style={[styles.toggleThumb, { backgroundColor: colors.card, transform: [{ translateX: value ? 18 : 0 }] }]} /></View>
    </Pressable>
  );
}

export default function GeneralGivingManageExperience() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const organization = context?.organization ?? context?.organizations?.[0];
  const [tab, setTab] = useState<Tab>('overview');
  const [flow, setFlow] = useState<SetupFlow>(null);
  const [flowStep, setFlowStep] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const scopeAccess = useResource<ManagementScopes>(
    `general:giving-management-scopes:${organization?.id ?? 'none'}`,
    (signal) => organization ? api.request<ManagementScopes>('giving?view=management-scopes', { signal }) : Promise.resolve({ organization: false, expression: false, expressionId: null }),
  );
  const configuration = useResource<ExpressionGivingConfiguration>(
    `general:giving-configuration:${organization?.id ?? 'none'}`,
    (signal) => organization ? api.request<ExpressionGivingConfiguration>('giving?view=configuration&scope=organization', { signal }) : Promise.resolve({ settings: null, purposes: [], bankAccounts: [], campaigns: [] }),
  );

  const [displayTitle, setDisplayTitle] = useState('Giving');
  const [displaySubtitle, setDisplaySubtitle] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [manualEnabled, setManualEnabled] = useState(true);

  const [purposeName, setPurposeName] = useState('');
  const [purposeDescription, setPurposeDescription] = useState('');
  const [purposeDefault, setPurposeDefault] = useState(false);
  const [purposeActive, setPurposeActive] = useState(true);

  const [accountLabel, setAccountLabel] = useState('');
  const [currency, setCurrency] = useState('NGN');
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
    setEnabled(settings.is_enabled);
    setManualEnabled(settings.manual_transfer_enabled);
  }, [configuration.data?.settings?.id]);

  const purposes = configuration.data?.purposes ?? [];
  const accounts = configuration.data?.bankAccounts ?? [];
  const activePurposes = purposes.filter((item) => item.status === 'active').length;
  const activeAccounts = accounts.filter((item) => item.is_active && item.is_public).length;

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await work();
      setNotice(success);
      await configuration.refresh();
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save giving setup.');
      return false;
    } finally { setBusy(false); }
  };

  const saveSettings = async () => {
    await run(() => api.request('giving?scope=organization', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'upsert_settings',
        displayTitle: displayTitle.trim() || 'Giving',
        displaySubtitle: displaySubtitle.trim(),
        isEnabled: enabled,
        manualTransferEnabled: manualEnabled,
        onlinePaymentEnabled: false,
        onlineUnavailableMessage: 'Online giving is not available yet.',
      }),
    }), 'Church-wide giving settings saved.');
  };

  const resetPurpose = () => {
    setPurposeName(''); setPurposeDescription(''); setPurposeDefault(false); setPurposeActive(true); setFlowStep(0); setError('');
  };
  const resetAccount = () => {
    setAccountLabel(''); setCurrency('NGN'); setBankName(''); setAccountName(''); setAccountNumber(''); setRoutingNumber(''); setSwiftCode(''); setIban(''); setTransferInstructions(''); setAdditionalInstructions(''); setReferencePrefix(''); setFlowStep(0); setError('');
  };
  const closeFlow = () => {
    if (busy) return;
    setFlow(null);
    resetPurpose();
    resetAccount();
  };

  const savePurpose = async () => {
    if (!purposeName.trim()) return setError('Enter a giving purpose or fund name.');
    const saved = await run(() => api.request('giving?scope=organization', {
      method: 'POST',
      body: JSON.stringify({ action: 'upsert_purpose', name: purposeName.trim(), description: purposeDescription.trim(), status: purposeActive ? 'active' : 'inactive', isDefault: purposeDefault }),
    }), 'Giving purpose published.');
    if (saved) { setFlow(null); resetPurpose(); setTab('purposes'); }
  };

  const updatePurpose = async (purpose: GivingPurpose, patch: { status?: string; isDefault?: boolean }) => {
    await run(() => api.request('giving?scope=organization', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'upsert_purpose', id: purpose.id, name: purpose.name, description: purpose.description, status: patch.status ?? purpose.status, displayOrder: purpose.display_order, isDefault: patch.isDefault ?? purpose.is_default }),
    }), 'Giving purpose updated.');
  };

  const accountStepValid = () => {
    if (flowStep === 0) return Boolean(accountLabel.trim() && bankName.trim() && accountName.trim() && accountNumber.trim());
    if (flowStep === 1) return /^[A-Z]{3}$/.test(currency.trim().toUpperCase());
    return true;
  };

  const saveAccount = async () => {
    const code = currency.trim().toUpperCase();
    if (!accountLabel.trim() || !bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setFlowStep(0); setError('Label, bank name, account name and account number are required.'); return;
    }
    if (!/^[A-Z]{3}$/.test(code)) {
      setFlowStep(1); setError('Enter a 3-letter currency code, for example NGN, GBP or EUR.'); return;
    }
    const saved = await run(() => api.request('giving?scope=organization', {
      method: 'POST',
      body: JSON.stringify({
        action: 'upsert_bank_account', label: accountLabel.trim(), bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim(), routingNumber: routingNumber.trim() || undefined, swiftCode: swiftCode.trim() || undefined, iban: iban.trim() || undefined, currency: code, transferInstructions: transferInstructions.trim(), additionalInstructions: additionalInstructions.trim(), referencePrefix: referencePrefix.trim() || undefined, isPublic: true, isActive: true,
      }),
    }), `${code} transfer account published.`);
    if (saved) { setFlow(null); resetAccount(); setTab('accounts'); }
  };

  const updateAccount = async (account: BankAccount, isActive: boolean) => {
    await run(() => api.request('giving?scope=organization', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'upsert_bank_account', id: account.id, label: account.label, bankName: account.bank_name, accountName: account.account_name, accountNumber: account.account_number, routingNumber: account.routing_number || undefined, swiftCode: account.swift_code || undefined, iban: account.iban || undefined, currency: account.currency, transferInstructions: account.transfer_instructions, additionalInstructions: account.additional_instructions, referencePrefix: account.reference_prefix || undefined, isPublic: account.is_public, isActive, displayOrder: account.display_order,
      }),
    }), isActive ? 'Transfer account published.' : 'Transfer account hidden.');
  };

  const purposeStep = () => {
    if (flowStep === 0) return <View style={styles.flowBody}><InputField label="Purpose / fund name" value={purposeName} onChangeText={setPurposeName} placeholder="Tithe, Missions, Building fund…" /><InputField label="Description" value={purposeDescription} onChangeText={setPurposeDescription} multiline numberOfLines={4} placeholder="Explain what this giving purpose supports." /></View>;
    if (flowStep === 1) return <View style={styles.flowBody}><ToggleRow label="Active" description="Members can choose this purpose when giving." value={purposeActive} onPress={() => setPurposeActive((value) => !value)} /><ToggleRow label="Default purpose" description="Preselect this purpose when someone opens Giving." value={purposeDefault} onPress={() => setPurposeDefault((value) => !value)} /></View>;
    return <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.reviewTop}><View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}><Icon name="gift-outline" size={20} color={colors.interactive} /></View><Badge label={purposeActive ? 'ACTIVE' : 'INACTIVE'} variant={purposeActive ? 'success' : 'neutral'} /></View><Text style={[styles.reviewTitle, { color: colors.text }]}>{purposeName || 'Unnamed purpose'}</Text><Text style={[styles.reviewCopy, { color: colors.textSecondary }]}>{purposeDescription || 'No description added.'}</Text>{purposeDefault ? <Text style={[styles.reviewMeta, { color: colors.interactive }]}>Default giving purpose</Text> : null}</View>;
  };

  const accountStep = () => {
    if (flowStep === 0) return <View style={styles.flowBody}><InputField label="Public label" value={accountLabel} onChangeText={setAccountLabel} placeholder="NGN church account" /><InputField label="Bank name" value={bankName} onChangeText={setBankName} /><InputField label="Account name" value={accountName} onChangeText={setAccountName} /><InputField label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" /></View>;
    if (flowStep === 1) return <View style={styles.flowBody}><InputField label="Currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} placeholder="NGN" /><InputField label="Routing number (optional)" value={routingNumber} onChangeText={setRoutingNumber} /><InputField label="SWIFT code (optional)" value={swiftCode} onChangeText={setSwiftCode} autoCapitalize="characters" /><InputField label="IBAN (optional)" value={iban} onChangeText={setIban} autoCapitalize="characters" /></View>;
    if (flowStep === 2) return <View style={styles.flowBody}><InputField label="Transfer instructions" value={transferInstructions} onChangeText={setTransferInstructions} multiline numberOfLines={4} placeholder="Explain the transfer process." /><InputField label="Additional instructions" value={additionalInstructions} onChangeText={setAdditionalInstructions} multiline numberOfLines={3} /><InputField label="Reference prefix (optional)" value={referencePrefix} onChangeText={setReferencePrefix} placeholder="COT" /></View>;
    return <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.reviewTop}><View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}><Icon name="card-outline" size={20} color={colors.interactive} /></View><Badge label={currency.trim().toUpperCase() || 'CURRENCY'} variant="primary" /></View><Text style={[styles.reviewTitle, { color: colors.text }]}>{accountLabel || 'Transfer account'}</Text><Text style={[styles.reviewCopy, { color: colors.textSecondary }]}>{bankName || 'Bank'} · {accountName || 'Account name'}</Text><Text style={[styles.accountNumber, { color: colors.text }]}>{accountNumber || 'Account number'}</Text><Text style={[styles.reviewMeta, { color: colors.success }]}>Will be published as an active transfer destination</Text></View>;
  };

  if (!organization) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Choose a church" message="Choose a church before managing giving." iconName="business-outline" /></View>;
  if (!access.accessReady || scopeAccess.loading) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}><View style={styles.body}><Skeleton height={110} count={4} /></View></View>;
  if (!access.canManageGiving || scopeAccess.data?.organization === false) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Giving setup unavailable" message="Church-wide giving setup appears only for roles with giving configuration authority." iconName="lock-closed-outline" /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}>
        <ScreenHeader title="Giving setup" kicker="MINISTRY · FINANCE" subtitle={`Configure the church-wide giving experience for ${organization.name}.`} showBack rightAction={access.canReadGivingFinance ? <Button label="Reports" variant="outline" size="sm" onPress={() => router.push('/general/leadership/giving-finance')} /> : undefined} />
        <View style={styles.body}>
          {notice ? <Pressable onPress={() => setNotice('')} style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{notice}</Text></Pressable> : null}
          {error && !flow ? <Pressable onPress={() => setError('')} style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></Pressable> : null}

          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{activePurposes}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Active purposes</Text></View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><Text style={[styles.summaryValue, { color: colors.text }]}>{activeAccounts}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Public accounts</Text></View>
          </View>

          <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Chip label="Overview" selected={tab === 'overview'} onPress={() => setTab('overview')} /><Chip label="Purposes" count={purposes.length} selected={tab === 'purposes'} onPress={() => setTab('purposes')} /><Chip label="Accounts" count={accounts.length} selected={tab === 'accounts'} onPress={() => setTab('accounts')} /></View>

          {configuration.loading && !configuration.data ? <Skeleton height={130} count={3} /> : configuration.error && !configuration.data ? <ResourceError message={configuration.error} retry={configuration.refresh} /> : null}

          {tab === 'overview' ? <View style={styles.section}>
            <SectionHeader title="Giving experience" subtitle="These controls change what members see in General COT Giving." />
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><InputField label="Display title" value={displayTitle} onChangeText={setDisplayTitle} placeholder="Giving" /><InputField label="Display subtitle" value={displaySubtitle} onChangeText={setDisplaySubtitle} multiline numberOfLines={3} placeholder="A short explanation shown to members." /><ToggleRow label="Giving enabled" description="Show church-wide Giving to members." value={enabled} onPress={() => setEnabled((value) => !value)} /><ToggleRow label="Manual bank transfer" description="Allow members to see configured transfer accounts." value={manualEnabled} onPress={() => setManualEnabled((value) => !value)} /><View style={[styles.infoCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="information-circle-outline" size={18} color={colors.interactive} /><Text style={[styles.infoText, { color: colors.textSecondary }]}>Online payment remains controlled by the existing payment-provider workflow; this screen does not silently enable a provider.</Text></View><Button label="Save giving experience" onPress={() => void saveSettings()} loading={busy} fullWidth /></View>
          </View> : null}

          {tab === 'purposes' ? <View style={styles.section}><SectionHeader title="Giving purposes" badge={purposes.length} subtitle="Funds and categories members can choose" actionLabel="New purpose" onAction={() => { resetPurpose(); setFlow('purpose'); }} />{purposes.length ? purposes.map((purpose) => <View key={purpose.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Icon name="gift-outline" size={19} color={colors.interactive} /></View><View style={styles.flex}><View style={styles.rowTitleLine}><Text style={[styles.rowTitle, { color: colors.text }]}>{purpose.name}</Text>{purpose.is_default ? <Badge label="DEFAULT" variant="primary" /> : null}</View><Text style={[styles.rowCopy, { color: colors.textMuted }]} numberOfLines={2}>{purpose.description || 'No description'}</Text><Text style={[styles.rowMeta, { color: purpose.status === 'active' ? colors.success : colors.textMuted }]}>{purpose.status.toUpperCase()}</Text></View><Button label={purpose.status === 'active' ? 'Hide' : 'Activate'} variant="outline" size="sm" onPress={() => void updatePurpose(purpose, { status: purpose.status === 'active' ? 'inactive' : 'active' })} /></View>) : <EmptyState title="No giving purposes" message="Create clear funds such as Tithe, Missions or Building Fund." iconName="gift-outline" actionLabel="Create purpose" onAction={() => { resetPurpose(); setFlow('purpose'); }} />}</View> : null}

          {tab === 'accounts' ? <View style={styles.section}><SectionHeader title="Transfer accounts" badge={accounts.length} subtitle="Public bank-transfer destinations, kept separate by currency" actionLabel="New account" onAction={() => { resetAccount(); setFlow('account'); }} />{accounts.length ? accounts.map((account) => <View key={account.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Icon name="card-outline" size={19} color={colors.interactive} /></View><View style={styles.flex}><View style={styles.rowTitleLine}><Text style={[styles.rowTitle, { color: colors.text }]}>{account.label}</Text><Badge label={account.currency} variant="neutral" /></View><Text style={[styles.rowCopy, { color: colors.textSecondary }]}>{account.bank_name} · {account.account_name}</Text><Text style={[styles.accountNumber, { color: colors.text }]}>{account.account_number}</Text><Text style={[styles.rowMeta, { color: account.is_active ? colors.success : colors.textMuted }]}>{account.is_active ? 'PUBLIC & ACTIVE' : 'HIDDEN'}</Text></View><Button label={account.is_active ? 'Hide' : 'Publish'} variant="outline" size="sm" onPress={() => void updateAccount(account, !account.is_active)} /></View>) : <EmptyState title="No transfer accounts" message="Add the first bank account members can use for church-wide giving." iconName="card-outline" actionLabel="Add account" onAction={() => { resetAccount(); setFlow('account'); }} />}</View> : null}
        </View>
      </ScrollView>

      <BottomSheet visible={flow === 'purpose'} onClose={closeFlow} title="New giving purpose" subtitle="General COT · Church-wide" maxHeightPercent={94}>{error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}<ProgressiveFlow steps={PURPOSE_STEPS} currentStep={flowStep} onStepChange={setFlowStep} onBack={flowStep === 0 ? closeFlow : () => setFlowStep((value) => Math.max(0, value - 1))} onNext={() => { setError(''); if (!purposeName.trim()) setError('Enter a giving purpose or fund name.'); else setFlowStep((value) => Math.min(PURPOSE_STEPS.length - 1, value + 1)); }} onComplete={() => void savePurpose()} canContinue={flowStep !== 0 || Boolean(purposeName.trim())} busy={busy} completeLabel="Publish purpose">{purposeStep()}</ProgressiveFlow></BottomSheet>

      <BottomSheet visible={flow === 'account'} onClose={closeFlow} title="New transfer account" subtitle="General COT · Public giving destination" maxHeightPercent={96}>{error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}<ProgressiveFlow steps={ACCOUNT_STEPS} currentStep={flowStep} onStepChange={setFlowStep} onBack={flowStep === 0 ? closeFlow : () => setFlowStep((value) => Math.max(0, value - 1))} onNext={() => { setError(''); if (!accountStepValid()) setError(flowStep === 0 ? 'Complete the required account details.' : 'Use a valid 3-letter currency code.'); else setFlowStep((value) => Math.min(ACCOUNT_STEPS.length - 1, value + 1)); }} onComplete={() => void saveAccount()} canContinue={accountStepValid()} busy={busy} completeLabel="Publish account">{accountStep()}</ProgressiveFlow></BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }, noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, summaryValue: { fontSize: 24, lineHeight: 29, fontWeight: '900' }, summaryLabel: { fontSize: 10.5, marginTop: 2 }, tabs: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, section: { gap: spacing.sm },
  settingsCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, toggleRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, toggleLabel: { fontSize: 12.5, fontWeight: '900' }, toggleDescription: { fontSize: 10.5, lineHeight: 15, marginTop: 2 }, toggleTrack: { width: 44, height: 26, borderRadius: 13, padding: 3 }, toggleThumb: { width: 20, height: 20, borderRadius: 10 }, infoCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, infoText: { flex: 1, fontSize: 10.5, lineHeight: 16 },
  rowCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, rowTitleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }, rowTitle: { fontSize: 13.5, fontWeight: '900' }, rowCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 }, rowMeta: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 4 }, accountNumber: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  flowBody: { gap: spacing.md }, reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reviewIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reviewTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' }, reviewCopy: { fontSize: 11.5, lineHeight: 18 }, reviewMeta: { fontSize: 10, fontWeight: '800' },
});

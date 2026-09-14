import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  SectionHeader,
  Skeleton,
} from '@/components';
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type FinancialAccount = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  currency: string;
  account_type: 'documentation_wallet' | 'cash' | 'bank' | 'clearing';
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
};
type Balance = FinancialAccount & { account_id: string; balance_minor: number | string };
type FinancialSession = {
  id: string;
  organization_id: string;
  branch_id: string;
  title: string;
  session_date: string;
  status: 'open' | 'reconciling' | 'reconciled' | 'locked';
  notes: string;
  opened_by: string;
  reconciled_by?: string | null;
  reconciled_at?: string | null;
  created_at: string;
};
type LedgerEntry = {
  id: string;
  account_id: string;
  session_id?: string | null;
  giving_purpose_id?: string | null;
  giving_campaign_id?: string | null;
  contributor_profile_id?: string | null;
  contributor_name?: string | null;
  direction: 'credit' | 'debit';
  amount_minor: number | string;
  currency: string;
  entry_kind: 'tithe' | 'offering' | 'special_giving' | 'campaign' | 'expense' | 'transfer' | 'adjustment' | 'other';
  source_type: 'manual_transfer' | 'cash' | 'online_payment' | 'system' | 'adjustment';
  source_reference?: string | null;
  memo: string;
  occurred_at: string;
  recorded_by?: string | null;
  created_at: string;
};
type GivingPurpose = { id: string; name: string; status: string };
type GivingCampaign = { id: string; name: string; currency: string; status: string };
type GivingSettings = { manual_transfer_enabled?: boolean; online_payment_enabled?: boolean; is_enabled?: boolean } | null;
type FinanceResource = {
  accounts: FinancialAccount[];
  balances: Balance[];
  sessions: FinancialSession[];
  entries: LedgerEntry[];
  purposes: GivingPurpose[];
  campaigns: GivingCampaign[];
  settings: GivingSettings;
};

type EntryKind = LedgerEntry['entry_kind'];
type SourceType = LedgerEntry['source_type'];

function exponentForCurrency(currency: string): number {
  try {
    const digits = new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
    return typeof digits === 'number' ? digits : 2;
  } catch {
    return 2;
  }
}

function toMinor(value: string, currency: string) {
  const amount = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const factor = 10 ** exponentForCurrency(currency);
  const minor = Math.round(amount * factor);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function formatMoney(minorValue: number | string, currency: string) {
  const minor = Number(minorValue || 0);
  const factor = 10 ** exponentForCurrency(currency);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: exponentForCurrency(currency) }).format(minor / factor);
  } catch {
    return `${currency} ${(minor / factor).toLocaleString()}`;
  }
}

export default function ExpressionFinanceManagementExperience() {
  const { auth, context, hasCapability, mode } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.expressions?.find((item) => item.id === expression?.id)?.organizationId ?? '';
  const profileId = context?.profile?.id ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const canRead = Boolean(expression?.id) && (hasCapability('finance.read') || hasCapability('finance.manage'));
  const canManage = Boolean(expression?.id) && hasCapability('finance.manage');

  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [accountName, setAccountName] = useState('Expression wallet');
  const [currency, setCurrency] = useState('NGN');
  const [accountType, setAccountType] = useState<FinancialAccount['account_type']>('documentation_wallet');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState<Date | null>(new Date());
  const [sessionNotes, setSessionNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [entryDirection, setEntryDirection] = useState<'credit' | 'debit'>('credit');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryKind, setEntryKind] = useState<EntryKind>('offering');
  const [sourceType, setSourceType] = useState<SourceType>('manual_transfer');
  const [contributorName, setContributorName] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resource = useResource<FinanceResource>(
    `expression:finance-books:${expression?.id ?? 'none'}:${canRead}:${mode}`,
    async () => {
      if (!canRead || !expression?.id || !organizationId) {
        return { accounts: [], balances: [], sessions: [], entries: [], purposes: [], campaigns: [], settings: null };
      }
      const supabase = await getRuntimeSupabase(accessToken);
      const [accounts, balances, sessions, entries, purposes, campaigns, settings] = await Promise.all([
        supabase.from('financial_accounts').select('*').eq('organization_id', organizationId).eq('branch_id', expression.id).order('created_at'),
        supabase.from('financial_account_balances').select('*').eq('organization_id', organizationId).eq('branch_id', expression.id),
        supabase.from('financial_sessions').select('*').eq('organization_id', organizationId).eq('branch_id', expression.id).order('session_date', { ascending: false }).limit(100),
        supabase.from('financial_ledger_entries').select('*').eq('organization_id', organizationId).eq('branch_id', expression.id).order('occurred_at', { ascending: false }).limit(250),
        supabase.from('giving_purposes').select('id,name,status').eq('organization_id', organizationId).eq('branch_id', expression.id).eq('status', 'active').order('display_order'),
        supabase.from('giving_campaigns').select('id,name,currency,status').eq('organization_id', organizationId).eq('branch_id', expression.id).in('status', ['active', 'completed']).order('created_at', { ascending: false }),
        supabase.from('giving_settings').select('manual_transfer_enabled,online_payment_enabled,is_enabled').eq('organization_id', organizationId).eq('branch_id', expression.id).maybeSingle(),
      ]);
      for (const required of [accounts, balances, sessions, entries]) {
        if (required.error) throw new Error(required.error.message || 'Unable to load Expression finance records.');
      }
      return {
        accounts: (accounts.data ?? []) as FinancialAccount[],
        balances: (balances.data ?? []) as Balance[],
        sessions: (sessions.data ?? []) as FinancialSession[],
        entries: (entries.data ?? []) as LedgerEntry[],
        purposes: purposes.error ? [] : (purposes.data ?? []) as GivingPurpose[],
        campaigns: campaigns.error ? [] : (campaigns.data ?? []) as GivingCampaign[],
        settings: settings.error ? null : settings.data as GivingSettings,
      };
    },
  );

  const accounts = resource.data?.accounts ?? [];
  const balances = resource.data?.balances ?? [];
  const sessions = resource.data?.sessions ?? [];
  const entries = resource.data?.entries ?? [];
  const purposes = resource.data?.purposes ?? [];
  const campaigns = resource.data?.campaigns ?? [];
  const openSessions = sessions.filter((item) => item.status === 'open' || item.status === 'reconciling');

  const totalsByCurrency = useMemo(() => {
    const result = new Map<string, number>();
    balances.forEach((item) => result.set(item.currency, (result.get(item.currency) ?? 0) + Number(item.balance_minor || 0)));
    return [...result.entries()];
  }, [balances]);

  const balanceFor = (accountId: string) => balances.find((item) => item.account_id === accountId);

  const suggestedCurrency = useMemo(() => {
    const firstAccount = accounts[0]?.currency;
    const firstCampaign = campaigns[0]?.currency;
    return firstAccount || firstCampaign || 'NGN';
  }, [accounts, campaigns]);

  const openAccountComposer = () => {
    setCurrency(suggestedCurrency);
    setAccountName(accounts.length ? 'Cash / bank record' : 'Expression wallet');
    setAccountType(accounts.length ? 'bank' : 'documentation_wallet');
    setErrorMsg('');
    setAccountOpen(true);
  };

  const createAccount = async () => {
    if (!canManage || !expression?.id || !organizationId || !profileId) return;
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!accountName.trim()) return setErrorMsg('Give this finance account a name.');
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) return setErrorMsg('Currency must use a three-letter code such as NGN.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('financial_accounts').insert({
        organization_id: organizationId,
        branch_id: expression.id,
        name: accountName.trim(),
        currency: normalizedCurrency,
        account_type: accountType,
        status: 'active',
        created_by: profileId,
      });
      if (error) throw new Error(error.message || 'Unable to create finance account.');
      setAccountOpen(false);
      setSuccessMsg('Finance account created for this Expression.');
      await resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to create finance account.'); }
    finally { setSaving(false); }
  };

  const createSession = async () => {
    if (!canManage || !expression?.id || !organizationId || !profileId) return;
    if (!sessionTitle.trim()) return setErrorMsg('Name the financial session, for example Sunday Service — Morning.');
    if (!sessionDate) return setErrorMsg('Choose the session date.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('financial_sessions').insert({
        organization_id: organizationId,
        branch_id: expression.id,
        title: sessionTitle.trim(),
        session_date: formatDateOnly(sessionDate),
        status: 'open',
        notes: sessionNotes.trim(),
        opened_by: profileId,
      });
      if (error) throw new Error(error.message || 'Unable to open financial session.');
      setSessionOpen(false); setSessionTitle(''); setSessionNotes(''); setSessionDate(new Date());
      setSuccessMsg('Financial session opened. Giving and expenses can now be documented against it.');
      await resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to create financial session.'); }
    finally { setSaving(false); }
  };

  const openEntryComposer = (direction: 'credit' | 'debit') => {
    const firstAccount = accounts[0];
    setEntryDirection(direction);
    setSelectedAccountId(firstAccount?.id ?? '');
    setCurrency(firstAccount?.currency ?? suggestedCurrency);
    setSelectedSessionId(openSessions[0]?.id ?? '');
    setEntryAmount('');
    setEntryKind(direction === 'credit' ? 'offering' : 'expense');
    setSourceType(direction === 'credit' ? 'manual_transfer' : 'cash');
    setContributorName(''); setMemo(''); setSelectedPurposeId(null); setSelectedCampaignId(null); setErrorMsg('');
    setEntryOpen(true);
  };

  const saveEntry = async () => {
    if (!canManage || !expression?.id || !organizationId || !profileId) return;
    const account = accounts.find((item) => item.id === selectedAccountId);
    if (!account) return setErrorMsg('Choose the finance account that received or paid this amount.');
    const amountMinor = toMinor(entryAmount, account.currency);
    if (!amountMinor) return setErrorMsg('Enter a valid positive amount.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('financial_ledger_entries').insert({
        organization_id: organizationId,
        branch_id: expression.id,
        account_id: account.id,
        session_id: selectedSessionId || null,
        giving_purpose_id: entryDirection === 'credit' ? selectedPurposeId : null,
        giving_campaign_id: entryDirection === 'credit' ? selectedCampaignId : null,
        contributor_profile_id: null,
        contributor_name: entryDirection === 'credit' ? contributorName.trim() || null : null,
        direction: entryDirection,
        amount_minor: amountMinor,
        currency: account.currency,
        entry_kind: entryKind,
        source_type: sourceType,
        source_reference: null,
        memo: memo.trim(),
        occurred_at: new Date().toISOString(),
        recorded_by: profileId,
      });
      if (error) throw new Error(error.message || 'Unable to record finance entry.');
      setEntryOpen(false);
      setSuccessMsg(entryDirection === 'credit' ? 'Giving entry recorded in the immutable Expression ledger.' : 'Expense/debit recorded in the immutable Expression ledger.');
      await resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to record finance entry.'); }
    finally { setSaving(false); }
  };

  const updateSessionStatus = async (session: FinancialSession, status: FinancialSession['status']) => {
    if (!canManage || !profileId) return;
    setSaving(true); setErrorMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const patch: Record<string, unknown> = { status };
      if (status === 'reconciled' || status === 'locked') {
        patch.reconciled_by = profileId;
        patch.reconciled_at = new Date().toISOString();
      }
      const { error } = await supabase.from('financial_sessions').update(patch).eq('id', session.id);
      if (error) throw new Error(error.message || 'Unable to update financial session.');
      setSuccessMsg(`Session marked ${status}.`);
      await resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to update financial session.'); }
    finally { setSaving(false); }
  };

  if (!canRead || !expression?.id) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Expression finance is restricted" message="Only authorized Expression finance roles can view the documentation wallet, sessions and ledger." iconName="lock-closed-outline" /></View>;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
    >
      {successMsg ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{successMsg}</Text></View> : null}
      {errorMsg ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{errorMsg}</Text></View> : null}

      <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}><Icon name="wallet-outline" size={23} color={colors.interactive} /></View>
        <View style={styles.flex}><Text style={[styles.stateTitle, { color: colors.text }]}>Expression financial documentation</Text><Text style={[styles.stateText, { color: colors.textSecondary }]}>This records who gave, what was received or spent, the session it belongs to, and which Expression wallet/account was affected. It does not pretend to move money.</Text></View>
      </View>
      <View style={[styles.onlineCard, { backgroundColor: resource.data?.settings?.online_payment_enabled ? colors.successSoft : colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <Icon name={resource.data?.settings?.online_payment_enabled ? 'checkmark-circle-outline' : 'time-outline'} size={17} color={resource.data?.settings?.online_payment_enabled ? colors.success : colors.textMuted} />
        <Text style={[styles.onlineText, { color: colors.textSecondary }]}>{resource.data?.settings?.online_payment_enabled ? 'Online giving is enabled. Successful provider-confirmed donations automatically enter the correct documentation wallet.' : 'Online giving is still disabled. Manual transfer/cash documentation works now; the database bridge is ready for online payments later.'}</Text>
      </View>

      {resource.loading && !resource.data ? <Skeleton height={96} count={4} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : (
        <>
          <View style={styles.section}>
            <SectionHeader title="Balances" badge={accounts.length} subtitle="Documentation balances by account and currency" actionLabel={canManage ? 'Account' : undefined} onAction={canManage ? openAccountComposer : undefined} />
            {totalsByCurrency.length ? <View style={styles.totalRow}>{totalsByCurrency.map(([code, minor]) => <View key={code} style={[styles.totalCard, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }]}><Text style={[styles.totalCurrency, { color: colors.interactive }]}>{code}</Text><Text style={[styles.totalValue, { color: colors.text }]}>{formatMoney(minor, code)}</Text></View>)}</View> : null}
            {accounts.length ? accounts.map((account) => { const balance = balanceFor(account.id); return <View key={account.id} style={[styles.accountRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}><View style={[styles.accountIcon, { backgroundColor: colors.bgSecondary }]}><Icon name={account.account_type === 'bank' ? 'business-outline' : account.account_type === 'cash' ? 'cash-outline' : 'wallet-outline'} size={18} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.accountName, { color: colors.text }]}>{account.name}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{account.account_type.replace('_', ' ')} · {account.currency}</Text></View><Text style={[styles.accountBalance, { color: colors.text }]}>{formatMoney(balance?.balance_minor ?? 0, account.currency)}</Text></View>; }) : <EmptyState title="No finance account yet" message={canManage ? 'Create the Expression wallet or bank/cash documentation account before recording manual activity.' : 'No finance accounts are configured for this Expression.'} iconName="wallet-outline" actionLabel={canManage ? 'Create account' : undefined} onAction={canManage ? openAccountComposer : undefined} />}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Financial sessions" badge={sessions.length} subtitle="Document service, programme or reporting periods" actionLabel={canManage ? 'Open session' : undefined} onAction={canManage ? () => setSessionOpen(true) : undefined} />
            {sessions.length ? sessions.slice(0, 12).map((session) => <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.sessionTop}><View style={styles.flex}><Text style={[styles.sessionTitle, { color: colors.text }]}>{session.title}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(`${session.session_date}T12:00:00`).toLocaleDateString()} · {session.status}</Text></View><Badge label={session.status.toUpperCase()} variant={session.status === 'reconciled' || session.status === 'locked' ? 'success' : 'active'} /></View>{session.notes ? <Text style={[styles.sessionNotes, { color: colors.textSecondary }]}>{session.notes}</Text> : null}{canManage && session.status !== 'locked' ? <View style={styles.actions}>{session.status === 'open' ? <Button label="Reconcile" onPress={() => void updateSessionStatus(session, 'reconciling')} variant="outline" size="sm" /> : null}{session.status === 'reconciling' ? <Button label="Mark reconciled" onPress={() => void updateSessionStatus(session, 'reconciled')} size="sm" /> : null}{session.status === 'reconciled' ? <Button label="Lock" onPress={() => void updateSessionStatus(session, 'locked')} variant="outline" size="sm" /> : null}</View> : null}</View>) : <Text style={[styles.emptyLine, { color: colors.textMuted }]}>No financial sessions recorded yet.</Text>}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Immutable ledger" badge={entries.length} subtitle="Corrections are recorded as new adjustment entries; past rows are not edited" />
            {canManage && accounts.length ? <View style={styles.actions}><Button label="Record giving" onPress={() => openEntryComposer('credit')} size="sm" /><Button label="Record expense" onPress={() => openEntryComposer('debit')} variant="outline" size="sm" /></View> : null}
            {entries.length ? entries.slice(0, 80).map((entry) => { const account = accounts.find((item) => item.id === entry.account_id); const session = sessions.find((item) => item.id === entry.session_id); return <View key={entry.id} style={[styles.entryRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={[styles.directionIcon, { backgroundColor: entry.direction === 'credit' ? colors.successSoft : colors.liveSoft }]}><Icon name={entry.direction === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'} size={17} color={entry.direction === 'credit' ? colors.success : colors.live} /></View><View style={styles.flex}><Text style={[styles.entryTitle, { color: colors.text }]}>{entry.entry_kind.replace('_', ' ')}{entry.contributor_name ? ` · ${entry.contributor_name}` : ''}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{account?.name || 'Account'}{session ? ` · ${session.title}` : ''} · {entry.source_type.replace('_', ' ')}</Text>{entry.memo ? <Text style={[styles.entryMemo, { color: colors.textSecondary }]} numberOfLines={2}>{entry.memo}</Text> : null}</View><View style={styles.amountWrap}><Text style={[styles.entryAmount, { color: entry.direction === 'credit' ? colors.success : colors.live }]}>{entry.direction === 'credit' ? '+' : '−'}{formatMoney(entry.amount_minor, entry.currency)}</Text><Text style={[styles.entryDate, { color: colors.textMuted }]}>{new Date(entry.occurred_at).toLocaleDateString()}</Text></View></View>; }) : <EmptyState title="Ledger is empty" message="Manual giving, expenses and future online-payment records will appear here." iconName="document-text-outline" />}
          </View>
        </>
      )}

      <BottomSheet visible={accountOpen} onClose={() => { if (!saving) setAccountOpen(false); }} title="Create finance account" subtitle="Documentation wallet, bank or cash account" maxHeightPercent={88}>
        <View style={styles.form}><InputField label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Expression wallet" /><InputField label="Currency" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase().slice(0, 3))} placeholder="NGN" autoCapitalize="characters" /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ACCOUNT TYPE</Text><View style={styles.chips}><Chip label="Wallet" selected={accountType === 'documentation_wallet'} onPress={() => setAccountType('documentation_wallet')} /><Chip label="Bank" selected={accountType === 'bank'} onPress={() => setAccountType('bank')} /><Chip label="Cash" selected={accountType === 'cash'} onPress={() => setAccountType('cash')} /><Chip label="Clearing" selected={accountType === 'clearing'} onPress={() => setAccountType('clearing')} /></View><Button label="Create account" onPress={() => void createAccount()} loading={saving} size="lg" fullWidth /></View>
      </BottomSheet>

      <BottomSheet visible={sessionOpen} onClose={() => { if (!saving) setSessionOpen(false); }} title="Open financial session" subtitle="Group entries that belong to the same service or reporting period" maxHeightPercent={90}>
        <View style={styles.form}><InputField label="Session title" value={sessionTitle} onChangeText={setSessionTitle} placeholder="Sunday Service — Morning" /><DateTimeField label="Session date" value={sessionDate} onChange={setSessionDate} includeTime={false} minYear={new Date().getFullYear() - 3} maxYear={new Date().getFullYear() + 1} /><InputField label="Notes (optional)" value={sessionNotes} onChangeText={setSessionNotes} multiline numberOfLines={3} placeholder="Special giving, programme note, counting team…" /><Button label="Open session" onPress={() => void createSession()} loading={saving} size="lg" fullWidth /></View>
      </BottomSheet>

      <BottomSheet visible={entryOpen} onClose={() => { if (!saving) setEntryOpen(false); }} title={entryDirection === 'credit' ? 'Record giving' : 'Record expense / debit'} subtitle="This creates a new immutable ledger row" maxHeightPercent={96}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ACCOUNT</Text><View style={styles.chips}>{accounts.map((account) => <Chip key={account.id} label={`${account.name} · ${account.currency}`} selected={selectedAccountId === account.id} onPress={() => { setSelectedAccountId(account.id); setCurrency(account.currency); }} />)}</View>
          {openSessions.length ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SESSION (OPTIONAL)</Text><View style={styles.chips}><Chip label="No session" selected={!selectedSessionId} onPress={() => setSelectedSessionId('')} />{openSessions.map((session) => <Chip key={session.id} label={session.title} selected={selectedSessionId === session.id} onPress={() => setSelectedSessionId(session.id)} />)}</View></> : null}
          <InputField label={`Amount (${accounts.find((item) => item.id === selectedAccountId)?.currency || currency})`} value={entryAmount} onChangeText={setEntryAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TYPE</Text><View style={styles.chips}>{(entryDirection === 'credit' ? ['tithe','offering','special_giving','campaign','other'] : ['expense','transfer','adjustment','other']).map((kind) => <Chip key={kind} label={kind.replace('_', ' ')} selected={entryKind === kind} onPress={() => setEntryKind(kind as EntryKind)} />)}</View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SOURCE</Text><View style={styles.chips}>{(entryDirection === 'credit' ? ['manual_transfer','cash','adjustment'] : ['cash','manual_transfer','adjustment']).map((source) => <Chip key={source} label={source.replace('_', ' ')} selected={sourceType === source} onPress={() => setSourceType(source as SourceType)} />)}</View>
          {entryDirection === 'credit' ? <InputField label="Contributor name (optional)" value={contributorName} onChangeText={setContributorName} placeholder="Who sent/gave this?" /> : null}
          {entryDirection === 'credit' && purposes.length ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>GIVING PURPOSE (OPTIONAL)</Text><View style={styles.chips}><Chip label="None" selected={!selectedPurposeId} onPress={() => setSelectedPurposeId(null)} />{purposes.map((purpose) => <Chip key={purpose.id} label={purpose.name} selected={selectedPurposeId === purpose.id} onPress={() => setSelectedPurposeId(purpose.id)} />)}</View></> : null}
          {entryDirection === 'credit' && campaigns.length ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CAMPAIGN (OPTIONAL)</Text><View style={styles.chips}><Chip label="None" selected={!selectedCampaignId} onPress={() => setSelectedCampaignId(null)} />{campaigns.map((campaign) => <Chip key={campaign.id} label={campaign.name} selected={selectedCampaignId === campaign.id} onPress={() => setSelectedCampaignId(campaign.id)} />)}</View></> : null}
          <InputField label="Memo (optional)" value={memo} onChangeText={setMemo} multiline numberOfLines={3} placeholder="Transfer reference, expense details, counting note…" />
          <Button label="Record in ledger" onPress={() => void saveEntry()} loading={saving} size="lg" fullWidth />
        </ScrollView>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: spacing.md, paddingBottom: 110, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 }, section: { gap: spacing.sm },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' }, stateCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, stateIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, stateTitle: { fontSize: 13, fontWeight: '900' }, stateText: { fontSize: 11, lineHeight: 17, marginTop: 2 }, onlineCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, onlineText: { flex: 1, fontSize: 11, lineHeight: 17 },
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, totalCard: { minWidth: 150, flexGrow: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md }, totalCurrency: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, totalValue: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  accountRow: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, accountIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, accountName: { fontSize: 13, fontWeight: '800' }, meta: { fontSize: 10.5, lineHeight: 15, marginTop: 2 }, accountBalance: { fontSize: 13, fontWeight: '900' },
  sessionCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, sessionTitle: { fontSize: 13, fontWeight: '900' }, sessionNotes: { fontSize: 11.5, lineHeight: 17 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, emptyLine: { fontSize: 11.5, lineHeight: 17 },
  entryRow: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, directionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, entryTitle: { fontSize: 11.5, fontWeight: '800', textTransform: 'capitalize' }, entryMemo: { fontSize: 10.5, lineHeight: 15, marginTop: 2 }, amountWrap: { alignItems: 'flex-end', minWidth: 100 }, entryAmount: { fontSize: 12, fontWeight: '900' }, entryDate: { fontSize: 9.5, marginTop: 3 },
  form: { gap: spacing.md }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

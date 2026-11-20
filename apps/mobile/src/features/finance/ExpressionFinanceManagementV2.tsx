import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, SectionHeader, Skeleton } from '@/components';
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { ExpressionMemberPicker, financeMemberProfile, type FinanceMemberCandidate } from './ExpressionMemberPicker';

type Account = { id: string; name: string; currency: string; account_type: string; status: string; created_at: string };
type Balance = Account & { account_id: string; balance_minor: number | string };
type Session = { id: string; title: string; session_date: string; status: 'open' | 'reconciling' | 'reconciled' | 'locked'; notes?: string | null };
type EntryKind = 'tithe' | 'offering' | 'special_giving' | 'campaign' | 'expense' | 'transfer' | 'adjustment' | 'other';
type SourceType = 'manual_transfer' | 'cash' | 'online_payment' | 'system' | 'adjustment';
type Entry = {
  id: string; account_id: string; session_id?: string | null; giving_purpose_id?: string | null; giving_campaign_id?: string | null;
  contributor_profile_id?: string | null; contributor_name?: string | null; direction: 'credit' | 'debit'; amount_minor: number | string;
  currency: string; entry_kind: EntryKind; source_type: SourceType; memo?: string | null; occurred_at: string; created_at: string;
};
type Purpose = { id: string; name: string; status: string };
type Campaign = { id: string; name: string; currency: string; status: string };
type Settings = { online_payment_enabled?: boolean; manual_transfer_enabled?: boolean; is_enabled?: boolean } | null;
type FinanceData = { accounts: Account[]; balances: Balance[]; sessions: Session[]; entries: Entry[]; purposes: Purpose[]; campaigns: Campaign[]; settings: Settings };
type ViewMode = 'overview' | 'activity' | 'sessions';
type EntryMode = 'aggregate' | 'individual' | 'expense';

function exponent(currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; }
}
function toMinor(value: string, currency: string) {
  const amount = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minor = Math.round(amount * (10 ** exponent(currency)));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}
function money(value: number | string, currency: string) {
  const minor = Number(value || 0); const amount = minor / (10 ** exponent(currency));
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: exponent(currency) }).format(amount); } catch { return `${currency} ${amount.toLocaleString()}`; }
}
function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }

export default function ExpressionFinanceManagementV2() {
  const { auth, context, hasCapability, mode } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.expressions?.find((item) => item.id === expression?.id)?.organizationId ?? '';
  const profileId = context?.profile?.id ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const canRead = Boolean(expression?.id) && (hasCapability('finance.read') || hasCapability('finance.manage'));
  const canManage = Boolean(expression?.id) && hasCapability('finance.manage');

  const [view, setView] = useState<ViewMode>('overview');
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('aggregate');
  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [accountName, setAccountName] = useState('Expression wallet');
  const [newAccountCurrency, setNewAccountCurrency] = useState('NGN');
  const [accountType, setAccountType] = useState('documentation_wallet');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [entryKind, setEntryKind] = useState<EntryKind>('offering');
  const [sourceType, setSourceType] = useState<SourceType>('manual_transfer');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<Date | null>(new Date());
  const [memo, setMemo] = useState('');
  const [member, setMember] = useState<FinanceMemberCandidate | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState<Date | null>(new Date());
  const [sessionNotes, setSessionNotes] = useState('');

  const resource = useResource<FinanceData>(
    `expression:finance-v2:${expression?.id ?? 'none'}:${canRead}:${mode}`,
    async () => {
      if (!canRead || !expression?.id || !organizationId) return { accounts: [], balances: [], sessions: [], entries: [], purposes: [], campaigns: [], settings: null };
      const supabase = await getRuntimeSupabase(accessToken);
      const [accounts, balances, sessions, entries, purposes, campaigns, settings] = await Promise.all([
        supabase.from('financial_accounts').select('id,name,currency,account_type,status,created_at').eq('organization_id', organizationId).eq('branch_id', expression.id).eq('status', 'active').order('created_at'),
        supabase.from('financial_account_balances').select('*').eq('organization_id', organizationId).eq('branch_id', expression.id),
        supabase.from('financial_sessions').select('id,title,session_date,status,notes').eq('organization_id', organizationId).eq('branch_id', expression.id).order('session_date', { ascending: false }).limit(120),
        supabase.from('financial_ledger_entries').select('id,account_id,session_id,giving_purpose_id,giving_campaign_id,contributor_profile_id,contributor_name,direction,amount_minor,currency,entry_kind,source_type,memo,occurred_at,created_at').eq('organization_id', organizationId).eq('branch_id', expression.id).order('occurred_at', { ascending: false }).limit(500),
        supabase.from('giving_purposes').select('id,name,status').eq('organization_id', organizationId).eq('branch_id', expression.id).eq('status', 'active').order('display_order'),
        supabase.from('giving_campaigns').select('id,name,currency,status').eq('organization_id', organizationId).eq('branch_id', expression.id).in('status', ['active', 'completed']).order('created_at', { ascending: false }),
        supabase.from('giving_settings').select('online_payment_enabled,manual_transfer_enabled,is_enabled').eq('organization_id', organizationId).eq('branch_id', expression.id).maybeSingle(),
      ]);
      for (const response of [accounts, balances, sessions, entries]) if (response.error) throw new Error(response.error.message || 'Unable to load Expression finance.');
      return {
        accounts: (accounts.data ?? []) as Account[], balances: (balances.data ?? []) as Balance[], sessions: (sessions.data ?? []) as Session[], entries: (entries.data ?? []) as Entry[],
        purposes: purposes.error ? [] : (purposes.data ?? []) as Purpose[], campaigns: campaigns.error ? [] : (campaigns.data ?? []) as Campaign[], settings: settings.error ? null : settings.data as Settings,
      };
    },
  );

  const accounts = resource.data?.accounts ?? [];
  const entries = resource.data?.entries ?? [];
  const sessions = resource.data?.sessions ?? [];
  const purposes = resource.data?.purposes ?? [];
  const campaigns = resource.data?.campaigns ?? [];
  const openSessions = sessions.filter((item) => item.status === 'open' || item.status === 'reconciling');

  const summary = useMemo(() => {
    const map = new Map<string, { received: number; spent: number; net: number; count: number; individualCount: number }>();
    entries.forEach((entry) => {
      const row = map.get(entry.currency) ?? { received: 0, spent: 0, net: 0, count: 0, individualCount: 0 };
      const amountMinor = Number(entry.amount_minor || 0);
      if (entry.direction === 'credit') row.received += amountMinor; else row.spent += amountMinor;
      row.net += entry.direction === 'credit' ? amountMinor : -amountMinor;
      row.count += 1;
      if (entry.direction === 'credit' && entry.contributor_profile_id) row.individualCount += 1;
      map.set(entry.currency, row);
    });
    return [...map.entries()];
  }, [entries]);

  const balanceByAccount = useMemo(() => new Map((resource.data?.balances ?? []).map((balance) => [balance.account_id, balance])), [resource.data?.balances]);
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) ?? accounts[0];
  const selectedMemberProfile = financeMemberProfile(member);

  const resetEntry = (modeToOpen: EntryMode) => {
    const first = accounts[0];
    setEntryMode(modeToOpen); setSelectedAccountId(first?.id ?? ''); setAmount(''); setMemo(''); setOccurredAt(new Date()); setSelectedSessionId(openSessions[0]?.id ?? ''); setSelectedPurposeId(null); setSelectedCampaignId(null); setMember(null);
    setEntryKind(modeToOpen === 'expense' ? 'expense' : 'offering'); setSourceType(modeToOpen === 'expense' ? 'cash' : 'manual_transfer'); setErrorMessage(''); setMessage(''); setEntryOpen(true);
  };

  const saveEntry = async () => {
    if (!canManage || !expression?.id || !organizationId || !profileId) return;
    const account = accounts.find((item) => item.id === selectedAccountId);
    if (!account) return setErrorMessage('Choose the account that received or paid this amount.');
    const amountMinor = toMinor(amount, account.currency);
    if (!amountMinor) return setErrorMessage('Enter a valid amount greater than zero.');
    if (!occurredAt) return setErrorMessage('Choose the date this money was received or spent.');
    if (entryMode === 'individual' && !selectedMemberProfile?.id) return setErrorMessage('Choose the member whose giving you want to attribute.');
    setSaving(true); setErrorMessage(''); setMessage('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const direction = entryMode === 'expense' ? 'debit' : 'credit';
      const { error } = await supabase.from('financial_ledger_entries').insert({
        organization_id: organizationId, branch_id: expression.id, account_id: account.id, session_id: selectedSessionId || null,
        giving_purpose_id: direction === 'credit' ? selectedPurposeId : null, giving_campaign_id: direction === 'credit' ? selectedCampaignId : null,
        contributor_profile_id: entryMode === 'individual' ? selectedMemberProfile?.id ?? null : null,
        contributor_name: entryMode === 'individual' ? selectedMemberProfile?.display_name || selectedMemberProfile?.username || null : null,
        direction, amount_minor: amountMinor, currency: account.currency, entry_kind: entryKind, source_type: sourceType, source_reference: null,
        memo: memo.trim(), occurred_at: occurredAt.toISOString(), recorded_by: profileId,
      });
      if (error) throw new Error(error.message || 'Unable to save this finance entry.');
      setEntryOpen(false);
      setMessage(entryMode === 'aggregate' ? 'Total received was added as one ledger receipt. You do not need to enter every giver.' : entryMode === 'individual' ? `Giving attributed to ${selectedMemberProfile?.display_name || selectedMemberProfile?.username || 'the selected member'}.` : 'Expense recorded in the immutable ledger.');
      await resource.refresh();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Unable to save this finance entry.'); }
    finally { setSaving(false); }
  };

  const createAccount = async () => {
    if (!canManage || !expression?.id || !organizationId || !profileId) return;
    const code = newAccountCurrency.trim().toUpperCase();
    if (!accountName.trim()) return setErrorMessage('Give this account a name.');
    if (!/^[A-Z]{3}$/.test(code)) return setErrorMessage('Use a 3-letter currency code such as NGN.');
    setSaving(true); setErrorMessage('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('financial_accounts').insert({ organization_id: organizationId, branch_id: expression.id, name: accountName.trim(), currency: code, account_type: accountType, status: 'active', created_by: profileId });
      if (error) throw new Error(error.message || 'Unable to create account.');
      setAccountOpen(false); setMessage('Finance account created.'); await resource.refresh();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Unable to create account.'); } finally { setSaving(false); }
  };

  const createSession = async () => {
    if (!canManage || !expression?.id || !organizationId || !profileId) return;
    if (!sessionTitle.trim()) return setErrorMessage('Enter a session name, for example Sunday Service — Morning.');
    if (!sessionDate) return setErrorMessage('Choose the session date.');
    setSaving(true); setErrorMessage('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('financial_sessions').insert({ organization_id: organizationId, branch_id: expression.id, title: sessionTitle.trim(), session_date: formatDateOnly(sessionDate), status: 'open', notes: sessionNotes.trim(), opened_by: profileId });
      if (error) throw new Error(error.message || 'Unable to create session.');
      setSessionOpen(false); setSessionTitle(''); setSessionNotes(''); setSessionDate(new Date()); setMessage('Financial session opened.'); await resource.refresh();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Unable to create session.'); } finally { setSaving(false); }
  };

  const updateSession = async (session: Session, next: Session['status']) => {
    if (!canManage || !profileId) return;
    setSaving(true); setErrorMessage('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'reconciled' || next === 'locked') { patch.reconciled_by = profileId; patch.reconciled_at = new Date().toISOString(); }
      const { error } = await supabase.from('financial_sessions').update(patch).eq('id', session.id);
      if (error) throw new Error(error.message || 'Unable to update session.');
      setMessage(`Session marked ${next}.`); await resource.refresh();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Unable to update session.'); } finally { setSaving(false); }
  };

  if (!canRead || !expression?.id) return <View style={[styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Finance access is restricted" message="Only authorized Expression finance roles can view this workspace." iconName="lock-closed-outline" /></View>;

  const workflowCards = canManage ? (
    <View style={styles.workflowGrid}>
      <Pressable onPress={() => accounts.length ? resetEntry('aggregate') : setAccountOpen(true)} style={({ pressed }) => [styles.workflowCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }, pressed && styles.pressed]} accessibilityRole="button">
        <View style={[styles.workflowIcon, { backgroundColor: colors.card }]}><Icon name="cash-outline" size={21} color={colors.interactive} /></View>
        <Text style={[styles.workflowTitle, { color: colors.text }]}>Record total received</Text>
        <Text style={[styles.workflowText, { color: colors.textSecondary }]}>One entry for the total bank transfer, cash count or service giving. Best when many people gave.</Text>
      </Pressable>
      <Pressable onPress={() => accounts.length ? resetEntry('individual') : setAccountOpen(true)} style={({ pressed }) => [styles.workflowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button">
        <View style={[styles.workflowIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="person-outline" size={21} color={colors.interactive} /></View>
        <Text style={[styles.workflowTitle, { color: colors.text }]}>Individual giving</Text>
        <Text style={[styles.workflowText, { color: colors.textSecondary }]}>Optional detailed record. Select a real Expression member from their public profile.</Text>
      </Pressable>
      <Pressable onPress={() => accounts.length ? resetEntry('expense') : setAccountOpen(true)} style={({ pressed }) => [styles.workflowCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button">
        <View style={[styles.workflowIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="receipt-outline" size={21} color={colors.interactive} /></View>
        <Text style={[styles.workflowTitle, { color: colors.text }]}>Record expense</Text>
        <Text style={[styles.workflowText, { color: colors.textSecondary }]}>Document money spent without mixing it into giving received.</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}>
      {message ? <Pressable onPress={() => setMessage('')} style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{message}</Text></Pressable> : null}
      {errorMessage ? <Pressable onPress={() => setErrorMessage('')} style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{errorMessage}</Text></Pressable> : null}

      <View style={[styles.introCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={[styles.introIcon, { backgroundColor: colors.primarySoft }]}><Icon name="wallet-outline" size={24} color={colors.interactive} /></View>
        <View style={styles.flex}><Text style={[styles.introTitle, { color: colors.text }]}>Finance</Text><Text style={[styles.introText, { color: colors.textSecondary }]}>Start with totals. Add individual names only when you actually need that level of detail. Confirmed online giving is recorded automatically.</Text></View>
      </View>

      <View style={[styles.segmented, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        {([{ key: 'overview', label: 'Overview', icon: 'grid-outline' }, { key: 'activity', label: 'Activity', icon: 'list-outline' }, { key: 'sessions', label: 'Sessions', icon: 'calendar-outline' }] as const).map((item) => (
          <Pressable key={item.key} onPress={() => setView(item.key)} style={[styles.segment, view === item.key && { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name={item.icon} size={15} color={view === item.key ? colors.interactive : colors.textMuted} /><Text style={[styles.segmentText, { color: view === item.key ? colors.text : colors.textMuted }]}>{item.label}</Text></Pressable>
        ))}
      </View>

      {resource.loading && !resource.data ? <Skeleton height={110} count={4} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : view === 'overview' ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="Total giving received" subtitle="All credit entries for this Expression, including automatic online giving and manual totals" />
            {summary.length ? summary.map(([currencyCode, value]) => (
              <View key={currencyCode} style={[styles.heroTotal, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
                <View><Text style={[styles.heroLabel, { color: colors.interactive }]}>{currencyCode} RECEIVED</Text><Text style={[styles.heroValue, { color: colors.text }]}>{money(value.received, currencyCode)}</Text></View>
                <View style={styles.heroStats}><View><Text style={[styles.statValue, { color: colors.text }]}>{value.count}</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>ledger rows</Text></View><View><Text style={[styles.statValue, { color: colors.text }]}>{value.individualCount}</Text><Text style={[styles.statLabel, { color: colors.textMuted }]}>individual</Text></View></View>
              </View>
            )) : <EmptyState title="No giving recorded yet" message="Record one total for a service or transfer. You do not need to enter every giver." iconName="cash-outline" />}
          </View>

          {workflowCards}

          <View style={styles.section}>
            <SectionHeader title="Money position" subtitle="Received, spent and current documentation balance" actionLabel={canManage ? 'Add account' : undefined} onAction={canManage ? () => setAccountOpen(true) : undefined} />
            {summary.map(([currencyCode, value]) => <View key={`position-${currencyCode}`} style={styles.metrics}><View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.metricLabel, { color: colors.textMuted }]}>Received</Text><Text style={[styles.metricValue, { color: colors.success }]}>{money(value.received, currencyCode)}</Text></View><View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.metricLabel, { color: colors.textMuted }]}>Spent</Text><Text style={[styles.metricValue, { color: colors.live }]}>{money(value.spent, currencyCode)}</Text></View><View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.metricLabel, { color: colors.textMuted }]}>Net</Text><Text style={[styles.metricValue, { color: colors.text }]}>{money(value.net, currencyCode)}</Text></View></View>)}
            {accounts.map((account) => { const balance = balanceByAccount.get(account.id); return <View key={account.id} style={[styles.accountRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={[styles.accountIcon, { backgroundColor: colors.bgSecondary }]}><Icon name={account.account_type === 'bank' ? 'business-outline' : account.account_type === 'cash' ? 'cash-outline' : 'wallet-outline'} size={18} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.accountName, { color: colors.text }]}>{account.name}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{titleCase(account.account_type)} · {account.currency}</Text></View><Text style={[styles.accountBalance, { color: colors.text }]}>{money(balance?.balance_minor ?? 0, account.currency)}</Text></View>; })}
          </View>

          <View style={[styles.autoCard, { backgroundColor: resource.data?.settings?.online_payment_enabled ? colors.successSoft : colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name={resource.data?.settings?.online_payment_enabled ? 'flash-outline' : 'information-circle-outline'} size={18} color={resource.data?.settings?.online_payment_enabled ? colors.success : colors.textMuted} /><Text style={[styles.autoText, { color: colors.textSecondary }]}>{resource.data?.settings?.online_payment_enabled ? 'Online giving is automatic: confirmed provider payments enter the ledger without an admin retyping them.' : 'Online giving is currently disabled. Bank-transfer and cash totals can still be documented here without entering each giver.'}</Text></View>
        </>
      ) : view === 'activity' ? (
        <View style={styles.section}>
          <SectionHeader title="Finance activity" badge={entries.length} subtitle="Newest ledger records first" />
          {workflowCards}
          {entries.length ? entries.map((entry) => { const account = accounts.find((item) => item.id === entry.account_id); const session = sessions.find((item) => item.id === entry.session_id); const individual = Boolean(entry.contributor_profile_id); return (
            <View key={entry.id} style={[styles.entryRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <View style={[styles.directionIcon, { backgroundColor: entry.direction === 'credit' ? colors.successSoft : colors.liveSoft }]}><Icon name={entry.direction === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'} size={17} color={entry.direction === 'credit' ? colors.success : colors.live} /></View>
              <View style={styles.flex}><View style={styles.entryTitleRow}><Text style={[styles.entryTitle, { color: colors.text }]}>{individual ? entry.contributor_name || 'Member giving' : entry.direction === 'credit' ? 'Total received' : titleCase(entry.entry_kind)}</Text>{entry.source_type === 'online_payment' ? <Badge label="AUTO" variant="success" /> : null}</View><Text style={[styles.meta, { color: colors.textMuted }]}>{titleCase(entry.entry_kind)} · {account?.name || 'Account'}{session ? ` · ${session.title}` : ''}</Text>{entry.memo ? <Text style={[styles.entryMemo, { color: colors.textSecondary }]} numberOfLines={2}>{entry.memo}</Text> : null}</View>
              <View style={styles.amountWrap}><Text style={[styles.entryAmount, { color: entry.direction === 'credit' ? colors.success : colors.live }]}>{entry.direction === 'credit' ? '+' : '−'}{money(entry.amount_minor, entry.currency)}</Text><Text style={[styles.entryDate, { color: colors.textMuted }]}>{new Date(entry.occurred_at).toLocaleDateString()}</Text></View>
            </View>
          ); }) : <EmptyState title="No finance activity" message="Giving totals, individual records, automatic online payments and expenses will appear here." iconName="document-text-outline" />}
        </View>
      ) : (
        <View style={styles.section}>
          <SectionHeader title="Financial sessions" badge={sessions.length} subtitle="Use sessions when you want to group one service, programme or counting period" actionLabel={canManage ? 'Open session' : undefined} onAction={canManage ? () => setSessionOpen(true) : undefined} />
          {sessions.length ? sessions.map((session) => <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.sessionTop}><View style={styles.flex}><Text style={[styles.sessionTitle, { color: colors.text }]}>{session.title}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(`${session.session_date}T12:00:00`).toLocaleDateString()}</Text></View><Badge label={session.status.toUpperCase()} variant={session.status === 'reconciled' || session.status === 'locked' ? 'success' : 'active'} /></View>{session.notes ? <Text style={[styles.sessionNotes, { color: colors.textSecondary }]}>{session.notes}</Text> : null}{canManage && session.status !== 'locked' ? <View style={styles.actions}>{session.status === 'open' ? <Button label="Start reconciliation" onPress={() => void updateSession(session, 'reconciling')} variant="outline" size="sm" /> : null}{session.status === 'reconciling' ? <Button label="Mark reconciled" onPress={() => void updateSession(session, 'reconciled')} size="sm" /> : null}{session.status === 'reconciled' ? <Button label="Lock session" onPress={() => void updateSession(session, 'locked')} variant="outline" size="sm" /> : null}</View> : null}</View>) : <EmptyState title="No sessions yet" message="Sessions are optional. Open one when a service or programme needs its own reconciliation." iconName="calendar-outline" actionLabel={canManage ? 'Open session' : undefined} onAction={canManage ? () => setSessionOpen(true) : undefined} />}
        </View>
      )}

      <BottomSheet visible={entryOpen} onClose={() => { if (!saving) setEntryOpen(false); }} title={entryMode === 'aggregate' ? 'Record total received' : entryMode === 'individual' ? 'Record individual giving' : 'Record expense'} subtitle={entryMode === 'aggregate' ? 'Use one receipt for many givers — no names required.' : entryMode === 'individual' ? 'Choose the member from this Expression.' : 'Keep spending separate from giving received.'} maxHeightPercent={96}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ACCOUNT</Text><View style={styles.chips}>{accounts.map((account) => <Chip key={account.id} label={`${account.name} · ${account.currency}`} selected={selectedAccountId === account.id} onPress={() => setSelectedAccountId(account.id)} />)}</View>
          <InputField label={`Amount (${selectedAccount?.currency || 'NGN'})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <DateTimeField label={entryMode === 'expense' ? 'Date spent' : 'Date received'} value={occurredAt} onChange={setOccurredAt} includeTime minYear={new Date().getFullYear() - 3} maxYear={new Date().getFullYear() + 1} />
          {entryMode === 'individual' ? <ExpressionMemberPicker expressionId={expression.id} selectedProfileId={selectedMemberProfile?.id ?? null} onSelect={setMember} onClear={() => setMember(null)} /> : null}
          {openSessions.length ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SESSION (OPTIONAL)</Text><View style={styles.chips}><Chip label="No session" selected={!selectedSessionId} onPress={() => setSelectedSessionId('')} />{openSessions.map((session) => <Chip key={session.id} label={session.title} selected={selectedSessionId === session.id} onPress={() => setSelectedSessionId(session.id)} />)}</View></> : null}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TYPE</Text><View style={styles.chips}>{(entryMode === 'expense' ? ['expense','transfer','adjustment','other'] : ['tithe','offering','special_giving','campaign','other']).map((kind) => <Chip key={kind} label={titleCase(kind)} selected={entryKind === kind} onPress={() => setEntryKind(kind as EntryKind)} />)}</View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SOURCE</Text><View style={styles.chips}>{(entryMode === 'expense' ? ['cash','manual_transfer','adjustment'] : ['manual_transfer','cash','adjustment']).map((source) => <Chip key={source} label={titleCase(source)} selected={sourceType === source} onPress={() => setSourceType(source as SourceType)} />)}</View>
          {entryMode !== 'expense' && purposes.length ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PURPOSE (OPTIONAL)</Text><View style={styles.chips}><Chip label="None" selected={!selectedPurposeId} onPress={() => setSelectedPurposeId(null)} />{purposes.map((purpose) => <Chip key={purpose.id} label={purpose.name} selected={selectedPurposeId === purpose.id} onPress={() => setSelectedPurposeId(purpose.id)} />)}</View></> : null}
          {entryMode !== 'expense' && campaigns.length ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CAMPAIGN (OPTIONAL)</Text><View style={styles.chips}><Chip label="None" selected={!selectedCampaignId} onPress={() => setSelectedCampaignId(null)} />{campaigns.map((campaign) => <Chip key={campaign.id} label={campaign.name} selected={selectedCampaignId === campaign.id} onPress={() => setSelectedCampaignId(campaign.id)} />)}</View></> : null}
          <InputField label="Note (optional)" value={memo} onChangeText={setMemo} multiline numberOfLines={3} placeholder={entryMode === 'aggregate' ? 'e.g. Sunday service transfer total' : 'Reference or finance note'} />
          <Button label={entryMode === 'aggregate' ? 'Record total' : entryMode === 'individual' ? 'Record member giving' : 'Record expense'} onPress={() => void saveEntry()} loading={saving} size="lg" fullWidth />
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={accountOpen} onClose={() => { if (!saving) setAccountOpen(false); }} title="Add finance account" subtitle="Create a bank, cash or documentation account." maxHeightPercent={88}>
        <View style={styles.form}><InputField label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Expression wallet" /><InputField label="Currency" value={newAccountCurrency} onChangeText={(value) => setNewAccountCurrency(value.toUpperCase().slice(0, 3))} placeholder="NGN" autoCapitalize="characters" /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ACCOUNT TYPE</Text><View style={styles.chips}>{['documentation_wallet','bank','cash','clearing'].map((type) => <Chip key={type} label={titleCase(type)} selected={accountType === type} onPress={() => setAccountType(type)} />)}</View><Button label="Create account" onPress={() => void createAccount()} loading={saving} size="lg" fullWidth /></View>
      </BottomSheet>

      <BottomSheet visible={sessionOpen} onClose={() => { if (!saving) setSessionOpen(false); }} title="Open financial session" subtitle="Optional grouping for one service or reporting period." maxHeightPercent={90}>
        <View style={styles.form}><InputField label="Session title" value={sessionTitle} onChangeText={setSessionTitle} placeholder="Sunday Service — Morning" /><DateTimeField label="Session date" value={sessionDate} onChange={setSessionDate} includeTime={false} minYear={new Date().getFullYear() - 3} maxYear={new Date().getFullYear() + 1} /><InputField label="Notes (optional)" value={sessionNotes} onChangeText={setSessionNotes} multiline numberOfLines={3} placeholder="Counting team or programme note" /><Button label="Open session" onPress={() => void createSession()} loading={saving} size="lg" fullWidth /></View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg }, content: { padding: spacing.md, paddingBottom: 140, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 }, pressed: { opacity: 0.84, transform: [{ scale: 0.992 }] },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  introCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, introIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, introTitle: { fontSize: 18, fontWeight: '900' }, introText: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  segmented: { borderWidth: 1, borderRadius: radius.xl, padding: 4, flexDirection: 'row', gap: 4 }, segment: { flex: 1, minHeight: 42, borderRadius: radius.lg, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, segmentText: { fontSize: 10.5, fontWeight: '800' },
  section: { gap: spacing.sm }, heroTotal: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, heroLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, heroValue: { fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 3, letterSpacing: -0.8 }, heroStats: { flexDirection: 'row', gap: spacing.lg }, statValue: { textAlign: 'right', fontSize: 15, fontWeight: '900' }, statLabel: { fontSize: 9.5, marginTop: 1 },
  workflowGrid: { gap: spacing.sm }, workflowCard: { minHeight: 122, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 5 }, workflowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }, workflowTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' }, workflowText: { fontSize: 11.5, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, metricCard: { minWidth: 100, flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, metricLabel: { fontSize: 9.5, fontWeight: '700' }, metricValue: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  accountRow: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, accountIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, accountName: { fontSize: 12.5, fontWeight: '800' }, accountBalance: { fontSize: 12.5, fontWeight: '900' }, meta: { fontSize: 9.5, lineHeight: 14, marginTop: 2 }, autoCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, autoText: { flex: 1, fontSize: 11, lineHeight: 16 },
  entryRow: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, directionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }, entryTitle: { fontSize: 12.5, fontWeight: '800' }, entryMemo: { fontSize: 10.5, lineHeight: 15, marginTop: 3 }, amountWrap: { alignItems: 'flex-end', maxWidth: '36%' }, entryAmount: { fontSize: 11.5, fontWeight: '900' }, entryDate: { fontSize: 9, marginTop: 3 },
  sessionCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }, sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, sessionTitle: { fontSize: 13, fontWeight: '900' }, sessionNotes: { fontSize: 11, lineHeight: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  form: { gap: spacing.md, paddingBottom: spacing.xl }, fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

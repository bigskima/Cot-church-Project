import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Chip, EmptyState, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { BankAccount, PublicGivingDetails } from '@/types/giving';

type GroupGivingOption = {
  id: string;
  giving_purpose_id: string;
  label: string;
  note?: string | null;
  is_active?: boolean;
  purpose?: { id: string; name: string; description?: string | null } | null;
};

type AvailablePurpose = {
  id: string;
  branch_id?: string | null;
  name: string;
  description?: string | null;
  status: string;
};

type GroupGivingPayload = {
  group: {
    id: string;
    name: string;
    description?: string | null;
    branch_id?: string | null;
  };
  permissions: {
    manageGiving: boolean;
  };
  givingOptions: GroupGivingOption[];
  availableGivingPurposes: AvailablePurpose[];
};

function AccountCard({ account, reference }: { account: BankAccount; reference: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
      <View style={styles.row}>
        <View style={[styles.iconBubble, { backgroundColor: colors.primarySoft }]}>
          <Icon name='business-outline' size={18} color={colors.interactive} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{account.label}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{account.bank_name}</Text>
        </View>
        <Badge label={account.currency} variant='primary' />
      </View>
      <View style={styles.detail}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Account name</Text>
        <Text selectable style={[styles.value, { color: colors.text }]}>{account.account_name}</Text>
      </View>
      <View style={styles.detail}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Account number</Text>
        <Text selectable style={[styles.accountNumber, { color: colors.interactive }]}>{account.account_number}</Text>
      </View>
      {account.routing_number ? <Text selectable style={[styles.meta, { color: colors.textSecondary }]}>Routing: {account.routing_number}</Text> : null}
      {account.swift_code ? <Text selectable style={[styles.meta, { color: colors.textSecondary }]}>SWIFT: {account.swift_code}</Text> : null}
      {account.iban ? <Text selectable style={[styles.meta, { color: colors.textSecondary }]}>IBAN: {account.iban}</Text> : null}
      <View style={[styles.referenceBox, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.label, { color: colors.interactive }]}>GROUP GIVING REFERENCE</Text>
        <Text selectable style={[styles.reference, { color: colors.text }]}>{reference}</Text>
      </View>
      {account.transfer_instructions ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{account.transfer_instructions}</Text> : null}
      {account.additional_instructions ? <Text style={[styles.meta, { color: colors.textMuted }]}>{account.additional_instructions}</Text> : null}
    </View>
  );
}

export function GroupGivingExperience({ groupId }: { groupId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const organizationId = context?.organization?.id ?? '';
  const groupKey = `group-chat:${groupId}:giving`;
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');

  const group = useResource<GroupGivingPayload>(groupKey, (signal) => {
    if (mode !== 'authenticated' || !groupId) return Promise.reject(new Error('Join this Group to open Group Giving.'));
    return api.request<GroupGivingPayload>(`group-chat?groupId=${encodeURIComponent(groupId)}`, { signal, context: 'current' });
  });

  const expressionId = group.data?.group.branch_id ?? context?.expression?.id ?? null;
  const expressionGiving = useResource<PublicGivingDetails>(
    `group-giving:expression:${organizationId || 'none'}:${expressionId ?? 'none'}`,
    (signal) => {
      if (!organizationId || !expressionId) return Promise.reject(new Error('This Group is not attached to an Expression giving scope.'));
      const params = new URLSearchParams({ organizationId, expressionId });
      return api.request<PublicGivingDetails>(`public-giving?${params.toString()}`, { signal });
    },
  );

  const options = group.data?.givingOptions ?? [];
  useEffect(() => {
    if (!options.length) {
      setSelectedOptionId(null);
      return;
    }
    if (!selectedOptionId || !options.some((item) => item.id === selectedOptionId)) setSelectedOptionId(options[0].id);
  }, [options.map((item) => item.id).join('|'), selectedOptionId]);

  const selectedOption = options.find((item) => item.id === selectedOptionId) ?? null;
  const expressionPurpose = expressionGiving.data?.purposes.find((item) => item.id === selectedOption?.giving_purpose_id) ?? null;
  const currencies = expressionGiving.data?.currencies ?? [];
  useEffect(() => {
    if (!currencies.length) {
      setCurrency(null);
      return;
    }
    if (!currency || !currencies.includes(currency)) setCurrency(currencies[0]);
  }, [currencies.join('|'), currency]);

  const accounts = useMemo(
    () => (expressionGiving.data?.bankAccounts ?? []).filter((account) => !currency || account.currency === currency),
    [expressionGiving.data?.bankAccounts, currency],
  );

  const mutate = async (action: 'link_giving' | 'unlink_giving', purpose: AvailablePurpose | GroupGivingOption) => {
    setBusy(`${action}:${action === 'link_giving' ? purpose.id : (purpose as GroupGivingOption).giving_purpose_id}`);
    setActionError('');
    setFeedback('');
    try {
      const givingPurposeId = action === 'link_giving' ? purpose.id : (purpose as GroupGivingOption).giving_purpose_id;
      await api.request('group-chat', {
        method: 'POST',
        context: 'current',
        body: JSON.stringify({
          action,
          groupId,
          givingPurposeId,
          ...(action === 'link_giving' ? { label: (purpose as AvailablePurpose).name } : {}),
        }),
      });
      setFeedback(action === 'link_giving' ? 'Giving purpose added to this Group.' : 'Giving purpose removed from this Group.');
      invalidate(`group-chat:${groupId}:`);
      group.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update Group Giving.');
    } finally {
      setBusy('');
    }
  };

  if (group.loading && !group.data) return <View style={[styles.center, { backgroundColor: colors.bg }]}><Skeleton height={130} count={3} /></View>;
  if (group.error && !group.data) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}><ScreenHeader title='Group Giving' showBack /><View style={styles.body}><ResourceError message={group.error} retry={group.refresh} /></View></View>;
  if (!group.data) return null;

  const groupName = group.data.group.name;
  const referenceLabel = `${groupName} · ${selectedOption?.label ?? expressionPurpose?.name ?? 'Group Giving'}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 100 }}>
        <ScreenHeader
          title='Group Giving'
          kicker='GROUP · GIVING'
          subtitle={`Giving inside ${groupName}. Payment destinations remain owned by this Group's Expression.`}
          showBack
        />
        <View style={styles.body}>
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.iconBubble, { backgroundColor: colors.primarySoft }]}><Icon name='gift-outline' size={22} color={colors.interactive} /></View>
            <View style={styles.flex}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>{groupName}</Text>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>Group gifts stay attributed to this Group and its Expression.</Text>
            </View>
            {group.data.permissions.manageGiving ? <Badge label='GIVING MANAGER' variant='active' /> : null}
          </View>

          {feedback ? <View style={[styles.notice, { backgroundColor: colors.successSoft }]}><Text style={{ color: colors.success }}>{feedback}</Text></View> : null}
          {actionError ? <View style={[styles.notice, { backgroundColor: colors.liveSoft }]}><Text style={{ color: colors.live }}>{actionError}</Text></View> : null}

          <SectionHeader title='Group giving purposes' badge={options.length} subtitle='Only purposes approved in this Expression and enabled for this Group appear here.' />
          {options.length ? (
            <>
              <View style={styles.chips}>
                {options.map((item) => <Chip key={item.id} label={item.label} selected={selectedOptionId === item.id} onPress={() => setSelectedOptionId(item.id)} />)}
              </View>
              {selectedOption?.note ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{selectedOption.note}</Text> : expressionPurpose?.description ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{expressionPurpose.description}</Text> : null}
            </>
          ) : (
            <EmptyState title='Group Giving is not configured yet' message='A Group Giving Manager can enable an approved purpose from this Expression.' iconName='gift-outline' />
          )}

          {options.length && expressionGiving.loading ? <Skeleton height={120} count={2} /> : null}
          {options.length && expressionGiving.error ? <ResourceError message={expressionGiving.error} retry={expressionGiving.refresh} /> : null}

          {options.length && expressionGiving.data ? (
            <>
              <SectionHeader title='Give to this Group' subtitle='Use the Expression-approved payment destination below. Your Group reference keeps the gift identifiable.' />
              {currencies.length > 1 ? <View style={styles.chips}>{currencies.map((code) => <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />)}</View> : null}
              {expressionGiving.data.methods.manualBankTransfer && accounts.length ? (
                accounts.map((account) => <AccountCard key={account.id} account={account} reference={referenceLabel} />)
              ) : (
                <EmptyState title='No active transfer destination' message='This Expression has not published an active bank-transfer destination for Group Giving.' iconName='business-outline' />
              )}
            </>
          ) : null}

          {group.data.permissions.manageGiving ? (
            <View style={[styles.manager, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              <SectionHeader title='Manage Group Giving' subtitle='This authority is limited to this Group. It does not grant Expression finance access.' />
              {options.map((item) => (
                <View key={item.id} style={styles.manageRow}>
                  <View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.label}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Enabled in this Group</Text></View>
                  <Button label='Remove' variant='ghost' size='sm' loading={busy === `unlink_giving:${item.giving_purpose_id}`} onPress={() => void mutate('unlink_giving', item)} />
                </View>
              ))}
              {group.data.availableGivingPurposes.filter((purpose) => !options.some((item) => item.giving_purpose_id === purpose.id)).map((purpose) => (
                <View key={purpose.id} style={styles.manageRow}>
                  <View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{purpose.name}</Text>{purpose.description ? <Text style={[styles.meta, { color: colors.textMuted }]}>{purpose.description}</Text> : null}</View>
                  <Button label='Add' variant='outline' size='sm' loading={busy === `link_giving:${purpose.id}`} onPress={() => void mutate('link_giving', purpose)} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  hero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroTitle: { fontSize: 18, fontWeight: '900' },
  iconBubble: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  copy: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  accountCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  detail: { gap: 2 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: '600' },
  accountNumber: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  referenceBox: { borderRadius: radius.lg, padding: spacing.sm, gap: 3 },
  reference: { fontSize: 13, fontWeight: '800' },
  notice: { borderRadius: radius.lg, padding: spacing.sm },
  manager: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
});

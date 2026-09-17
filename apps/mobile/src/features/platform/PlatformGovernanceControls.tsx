import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet, Button, Icon, InputField } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { hasPlatformPermission, type PlatformAdministrationContext } from './usePlatformAdministration';

type AnyRecord = Record<string, any>;
type Props = { data: unknown; refresh: () => void; authority?: PlatformAdministrationContext | null };

function objectValue(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function arrayValue(value: unknown): AnyRecord[] { return Array.isArray(value) ? value as AnyRecord[] : []; }
function label(item: AnyRecord) { return item.name || item.display_name || item.email || item.title || item.code || item.key || item.id || 'Record'; }

function Notice({ error, message }: { error: string; message: string }) {
  const { colors } = useTheme();
  if (!error && !message) return null;
  return <View style={[styles.notice, { backgroundColor: error ? colors.bgSecondary : colors.primarySoft, borderColor: error ? colors.live : colors.primarySoftStrong }]}><Icon name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={17} color={error ? colors.live : colors.interactive} /><Text style={[styles.noticeText, { color: colors.textSecondary }]}>{error || message}</Text></View>;
}

function RecordCard({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>{subtitle ? <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}</View>{badge ? <Badge label={badge} variant="neutral" /> : null}</View>{children ? <View style={styles.actions}>{children}</View> : null}</View>;
}

export function OrganizationControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const items = arrayValue(objectValue(data).items);
  const canManage = hasPlatformPermission(authority, 'platform.organizations.manage');
  const [target, setTarget] = useState<AnyRecord | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const apply = async () => {
    if (!target || !canManage) return;
    const next = target.status === 'active' ? 'suspended' : 'active';
    if (next === 'suspended' && reason.trim().length < 3) { setError('Add a short reason before suspending this church organisation.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await api.request('platform-organizations', { method: 'PATCH', body: JSON.stringify({ organizationId: target.id, status: next, reason: next === 'suspended' ? reason.trim() : undefined }) });
      setMessage(next === 'active' ? `${label(target)} restored.` : `${label(target)} suspended.`);
      setTarget(null); setReason(''); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update organisation status.'); }
    finally { setBusy(false); }
  };

  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Organisation controls</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Lifecycle controls from Platform Administration, kept inside Ministry Tools.</Text><Notice error={error} message={message} />{items.slice(0, 40).map((item) => <RecordCard key={item.id} title={label(item)} subtitle={`/${item.slug ?? 'church'} · ${item.timezone ?? 'UTC'}`} badge={String(item.status ?? 'unknown').toUpperCase()}>{canManage && item.status !== 'archived' ? <Button label={item.status === 'active' ? 'Suspend' : 'Restore'} variant={item.status === 'active' ? 'outline' : 'primary'} size="sm" onPress={() => { setTarget(item); setReason(''); setError(''); }} /> : null}</RecordCard>)}<BottomSheet visible={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.status === 'active' ? 'Suspend church organisation' : 'Restore church organisation'} subtitle={target ? label(target) : undefined}>{target?.status === 'active' ? <InputField label="Reason" value={reason} onChangeText={setReason} multiline placeholder="Why should this organisation be suspended?" /> : <Text style={[styles.confirmCopy, { color: colors.textSecondary }]}>Restore this church organisation and allow its preserved records to become available again.</Text>}<Button label={target?.status === 'active' ? 'Confirm suspension' : 'Restore organisation'} loading={busy} onPress={() => void apply()} fullWidth /></BottomSheet></View>;
}

export function ExpressionControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const items = arrayValue(objectValue(data).items);
  const canManage = hasPlatformPermission(authority, 'platform.expressions.manage');
  const [target, setTarget] = useState<AnyRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnyRecord | null>(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const applyLifecycle = async () => {
    if (!target || !canManage) return;
    const next = !target.is_active;
    if (!next && reason.trim().length < 3) { setError('Add a reason before disabling this Expression.'); return; }
    setBusy(true); setError('');
    try {
      await api.request('platform-expressions', { method: 'PATCH', body: JSON.stringify({ expressionId: target.id, isActive: next, reason: next ? undefined : reason.trim() }) });
      setMessage(next ? `${label(target)} restored.` : `${label(target)} disabled.`); setTarget(null); setReason(''); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update Expression.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget || !canManage) return;
    if (reason.trim().length < 3) { setError('Add a reason before deleting this Expression.'); return; }
    if (confirmation.trim().toUpperCase() !== String(deleteTarget.code ?? '').toUpperCase()) { setError('Enter the exact Expression code to confirm deletion.'); return; }
    setBusy(true); setError('');
    try {
      await api.request('platform-expressions', { method: 'DELETE', body: JSON.stringify({ expressionId: deleteTarget.id, reason: reason.trim(), confirmation: confirmation.trim() }) });
      setMessage(`${label(deleteTarget)} deleted from member-facing COT. Historical audit and financial records remain preserved.`); setDeleteTarget(null); setReason(''); setConfirmation(''); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to delete Expression.'); }
    finally { setBusy(false); }
  };

  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Expression governance</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Disable/restore is reversible. Delete is a confirmed member-facing removal.</Text><Notice error={error} message={message} />{items.slice(0, 50).map((item) => <RecordCard key={item.id} title={label(item)} subtitle={`Code ${item.code ?? '—'} · ${item.organizations?.name ?? item.organization_id ?? 'Church'}`} badge={item.deleted_at ? 'DELETED' : item.is_active ? 'ACTIVE' : 'DISABLED'}>{canManage && !item.deleted_at ? <><Button label={item.is_active ? 'Disable' : 'Restore'} variant="outline" size="sm" onPress={() => { setTarget(item); setReason(''); setError(''); }} /><Button label="Delete" variant="outline" size="sm" onPress={() => { setDeleteTarget(item); setReason(''); setConfirmation(''); setError(''); }} /></> : null}</RecordCard>)}<BottomSheet visible={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?.is_active ? 'Disable Expression' : 'Restore Expression'} subtitle={target ? label(target) : undefined}>{target?.is_active ? <InputField label="Governance reason" value={reason} onChangeText={setReason} multiline /> : <Text style={[styles.confirmCopy, { color: colors.textSecondary }]}>Restore this Expression for member access.</Text>}<Button label={target?.is_active ? 'Disable Expression' : 'Restore Expression'} loading={busy} onPress={() => void applyLifecycle()} fullWidth /></BottomSheet><BottomSheet visible={!!deleteTarget} onClose={() => { if (!busy) setDeleteTarget(null); }} title="Delete Expression" subtitle={deleteTarget ? `${label(deleteTarget)} · code ${deleteTarget.code}` : undefined}><Text style={[styles.dangerCopy, { color: colors.live }]}>This removes the Expression from member-facing COT. Use only when permanent removal is intended.</Text><InputField label="Reason" value={reason} onChangeText={setReason} multiline /><InputField label="Type the Expression code to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" /><Button label="Confirm deletion" loading={busy} onPress={() => void remove()} fullWidth /></BottomSheet></View>;
}

export function UserControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const items = arrayValue(objectValue(data).items);
  const canManage = hasPlatformPermission(authority, 'platform.users.manage');
  const [target, setTarget] = useState<AnyRecord | null>(null);
  const [action, setAction] = useState<'account' | 'posting'>('account');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const apply = async () => {
    if (!target || !canManage) return;
    const operation = action === 'posting' ? (target.posting_allowed === false ? 'restore_posting' : 'restrict_posting') : (target.account_status === 'banned' ? 'restore' : 'ban');
    const restricting = operation === 'ban' || operation === 'restrict_posting';
    if (restricting && reason.trim().length < 3) { setError('Add a reason before applying this restriction.'); return; }
    setBusy(true); setError('');
    try {
      await api.request('platform-users', { method: 'PATCH', body: JSON.stringify({ profileId: target.id, action: operation, reason: restricting ? reason.trim() : undefined }) });
      setMessage(`${label(target)} updated.`); setTarget(null); setReason(''); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update this account.'); }
    finally { setBusy(false); }
  };

  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Account safety controls</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Account bans and public-posting restrictions remain separate controls.</Text><Notice error={error} message={message} />{items.slice(0, 60).map((item) => <RecordCard key={item.id} title={label(item)} subtitle={item.email ?? item.phone ?? item.id} badge={String(item.account_status ?? 'active').toUpperCase()}>{canManage ? <><Button label={item.posting_allowed === false ? 'Restore posting' : 'Restrict posting'} variant="outline" size="sm" onPress={() => { setTarget(item); setAction('posting'); setReason(''); setError(''); }} /><Button label={item.account_status === 'banned' ? 'Restore account' : 'Ban account'} variant="outline" size="sm" onPress={() => { setTarget(item); setAction('account'); setReason(''); setError(''); }} /></> : null}</RecordCard>)}<BottomSheet visible={!!target} onClose={() => { if (!busy) setTarget(null); }} title={action === 'posting' ? (target?.posting_allowed === false ? 'Restore posting' : 'Restrict posting') : (target?.account_status === 'banned' ? 'Restore account' : 'Ban account')} subtitle={target ? label(target) : undefined}>{((action === 'posting' && target?.posting_allowed !== false) || (action === 'account' && target?.account_status !== 'banned')) ? <InputField label="Reason" value={reason} onChangeText={setReason} multiline /> : <Text style={[styles.confirmCopy, { color: colors.textSecondary }]}>Restore this access now.</Text>}<Button label="Apply account control" loading={busy} onPress={() => void apply()} fullWidth /></BottomSheet></View>;
}

export function FeatureControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const items = arrayValue(objectValue(data).items);
  const canManage = hasPlatformPermission(authority, 'platform.features.manage');
  const [target, setTarget] = useState<AnyRecord | null>(null);
  const [rollout, setRollout] = useState('100');
  const [reason, setReason] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const enable = async (item: AnyRecord) => {
    if (!canManage) return;
    setBusyKey(item.key); setError('');
    try { await api.request('platform-features', { method: 'PATCH', body: JSON.stringify({ action: 'set_global', key: item.key, enabled: true, rolloutPercentage: item.rollout_percentage ?? 100, configuration: item.configuration ?? {} }) }); setMessage(`${item.name ?? item.key} enabled.`); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to enable feature.'); }
    finally { setBusyKey(''); }
  };

  const save = async () => {
    if (!target || !canManage) return;
    const percentage = Number(rollout);
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) { setError('Rollout percentage must be an integer from 0 to 100.'); return; }
    if (target.global_enabled && reason.trim().length < 3) { setError('Add a reason before disabling a feature.'); return; }
    setBusyKey(target.key); setError('');
    try { await api.request('platform-features', { method: 'PATCH', body: JSON.stringify({ action: 'set_global', key: target.key, enabled: !target.global_enabled, rolloutPercentage: percentage, configuration: target.configuration ?? {}, reason: target.global_enabled ? reason.trim() : undefined }) }); setMessage(`${target.name ?? target.key} ${target.global_enabled ? 'disabled' : 'enabled'}.`); setTarget(null); setReason(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to update feature policy.'); }
    finally { setBusyKey(''); }
  };

  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Feature availability controls</Text><Notice error={error} message={message} />{items.map((item) => <RecordCard key={item.key} title={item.name ?? item.key} subtitle={`${item.category ?? 'feature'} · rollout ${item.rollout_percentage ?? 0}%`} badge={item.global_enabled ? 'ENABLED' : 'DISABLED'}>{canManage ? item.global_enabled ? <Button label="Policy / disable" variant="outline" size="sm" onPress={() => { setTarget(item); setRollout(String(item.rollout_percentage ?? 100)); setReason(''); }} /> : <><Button label="Enable now" loading={busyKey === item.key} size="sm" onPress={() => void enable(item)} /><Button label="Policy" variant="outline" size="sm" onPress={() => { setTarget(item); setRollout(String(item.rollout_percentage ?? 100)); setReason(''); }} /></> : null}</RecordCard>)}<BottomSheet visible={!!target} onClose={() => { if (!busyKey) setTarget(null); }} title="Feature policy" subtitle={target?.name ?? target?.key}><InputField label="Rollout percentage" value={rollout} onChangeText={setRollout} keyboardType="number-pad" />{target?.global_enabled ? <InputField label="Reason for disabling" value={reason} onChangeText={setReason} multiline /> : null}<Button label={target?.global_enabled ? 'Save & disable' : 'Save & enable'} loading={!!busyKey} onPress={() => void save()} fullWidth /></BottomSheet></View>;
}

export function BrandingControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const source = objectValue(data);
  const canManage = hasPlatformPermission(authority, 'platform.branding.manage');
  const [draft, setDraft] = useState<AnyRecord>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { setDraft(source); }, [data]);
  const field = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!canManage) return;
    if (!String(draft.platform_name ?? '').trim()) { setError('Platform name is required.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await api.request('branding', { method: 'PATCH', body: JSON.stringify({ platformName: String(draft.platform_name).trim(), primaryLogoUrl: draft.primary_logo_url || null, compactLogoUrl: draft.compact_logo_url || null, darkLogoUrl: draft.dark_logo_url || null, publicHeaderLogoUrl: draft.public_header_logo_url || null, launchLogoUrl: draft.launch_logo_url || null, launchBackgroundUrl: draft.launch_background_url || null, defaultPlaceholderLogoUrl: draft.default_placeholder_logo_url || null, defaultLeaderPlaceholderUrl: draft.default_leader_placeholder_url || null, themeTokens: draft.theme_tokens ?? {} }) });
      setMessage('Platform branding saved.'); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save branding.'); }
    finally { setBusy(false); }
  };

  if (!canManage) return null;
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Branding controls</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Update platform identity using the same branding contract as the web dashboard.</Text><Notice error={error} message={message} /><InputField label="Platform name" value={String(draft.platform_name ?? '')} onChangeText={(value) => field('platform_name', value)} /><InputField label="Primary logo URL" value={String(draft.primary_logo_url ?? '')} onChangeText={(value) => field('primary_logo_url', value)} autoCapitalize="none" /><InputField label="Compact logo URL" value={String(draft.compact_logo_url ?? '')} onChangeText={(value) => field('compact_logo_url', value)} autoCapitalize="none" /><InputField label="Dark logo URL" value={String(draft.dark_logo_url ?? '')} onChangeText={(value) => field('dark_logo_url', value)} autoCapitalize="none" /><InputField label="Public header logo URL" value={String(draft.public_header_logo_url ?? '')} onChangeText={(value) => field('public_header_logo_url', value)} autoCapitalize="none" /><InputField label="Launch logo URL" value={String(draft.launch_logo_url ?? '')} onChangeText={(value) => field('launch_logo_url', value)} autoCapitalize="none" /><InputField label="Launch background URL" value={String(draft.launch_background_url ?? '')} onChangeText={(value) => field('launch_background_url', value)} autoCapitalize="none" /><InputField label="Default placeholder logo URL" value={String(draft.default_placeholder_logo_url ?? '')} onChangeText={(value) => field('default_placeholder_logo_url', value)} autoCapitalize="none" /><InputField label="Default leader placeholder URL" value={String(draft.default_leader_placeholder_url ?? '')} onChangeText={(value) => field('default_leader_placeholder_url', value)} autoCapitalize="none" /><Button label="Save branding" loading={busy} onPress={() => void save()} fullWidth /></View>;
}

export function PlatformGovernanceControls({ moduleKey, data, refresh, authority }: Props & { moduleKey: string }) {
  const component = useMemo(() => {
    if (moduleKey === 'organizations') return <OrganizationControls data={data} refresh={refresh} authority={authority} />;
    if (moduleKey === 'expressions') return <ExpressionControls data={data} refresh={refresh} authority={authority} />;
    if (moduleKey === 'users') return <UserControls data={data} refresh={refresh} authority={authority} />;
    if (moduleKey === 'features') return <FeatureControls data={data} refresh={refresh} authority={authority} />;
    if (moduleKey === 'branding') return <BrandingControls data={data} refresh={refresh} authority={authority} />;
    return null;
  }, [authority, data, moduleKey, refresh]);
  return component;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm }, sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' }, sectionCopy: { fontSize: 10.8, lineHeight: 16, marginTop: -4 }, flex: { flex: 1, minWidth: 0 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, cardTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' }, cardSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 3 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 10.5, lineHeight: 16, fontWeight: '700' }, confirmCopy: { fontSize: 12, lineHeight: 18, marginBottom: spacing.md }, dangerCopy: { fontSize: 11.5, lineHeight: 17, fontWeight: '800', marginBottom: spacing.md },
});
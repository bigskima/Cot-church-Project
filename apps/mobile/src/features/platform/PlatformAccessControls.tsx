import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet, Button, Chip, Icon, InputField, SearchBar } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { hasPlatformPermission, isPlatformSuperAdmin, type PlatformAdministrationContext } from './usePlatformAdministration';

type AnyRecord = Record<string, any>;
type Props = { data: unknown; refresh: () => void; authority?: PlatformAdministrationContext | null };
function objectValue(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function arrayValue(value: unknown): AnyRecord[] { return Array.isArray(value) ? value as AnyRecord[] : []; }
function personLabel(item: AnyRecord) { return item.display_name || item.profile?.display_name || item.email || item.username || item.id || 'COT account'; }

function Notice({ error, message }: { error: string; message: string }) {
  const { colors } = useTheme();
  if (!error && !message) return null;
  return <View style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: error ? colors.live : colors.primarySoftStrong }]}><Icon name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={17} color={error ? colors.live : colors.interactive} /><Text style={[styles.noticeText, { color: colors.textSecondary }]}>{error || message}</Text></View>;
}

function Card({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>{subtitle ? <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}</View>{badge ? <Badge label={badge} variant="neutral" /> : null}</View>{children ? <View style={styles.actions}>{children}</View> : null}</View>;
}

export function ModerationControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const state = objectValue(data);
  const policy = objectValue(state.policy);
  const exemptions = arrayValue(state.exemptions);
  const canManage = hasPlatformPermission(authority, 'platform.moderation.manage');
  const [mode, setMode] = useState<'open' | 'closed' | 'allowlist'>((policy.mode as any) || 'open');
  const [reason, setReason] = useState(String(policy.reason ?? ''));
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<AnyRecord[]>([]);
  const [reports, setReports] = useState<AnyRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { setMode((policy.mode as any) || 'open'); setReason(String(policy.reason ?? '')); }, [policy.mode, policy.reason]);
  useEffect(() => {
    let active = true;
    void api.request<{ items?: AnyRecord[] }>('platform-moderation?view=reports&status=open&pageSize=50')
      .then((value) => { if (active) setReports(value.items ?? []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [api]);

  const savePolicy = async () => {
    if (!canManage) return;
    if (mode !== 'open' && reason.trim().length < 3) { setError('Add a reason before restricting public posting.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await api.request('platform-moderation', { method: 'PATCH', body: JSON.stringify({ action: 'set_public_posting_policy', mode, reason: reason.trim() }) });
      setMessage(mode === 'open' ? 'Public posting is open.' : mode === 'closed' ? 'Public posting is paused.' : 'Public posting is limited to approved accounts.'); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update posting policy.'); }
    finally { setBusy(false); }
  };

  const findAccount = async () => {
    if (search.trim().length < 2) return;
    setBusy(true); setError('');
    try { const result = await api.request<{ items?: AnyRecord[] }>(`platform-users?q=${encodeURIComponent(search.trim())}&pageSize=12`); setMatches(result.items ?? []); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to search accounts.'); }
    finally { setBusy(false); }
  };

  const setApproval = async (item: AnyRecord, enabled: boolean) => {
    if (!canManage) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.request('platform-moderation', { method: 'PATCH', body: JSON.stringify(enabled ? { action: 'add_public_posting_exemption', profileId: item.id, reason: 'Approved from COT Ministry Tools' } : { action: 'remove_public_posting_exemption', profileId: item.profileId ?? item.profile_id ?? item.id }) });
      setMessage(enabled ? `${personLabel(item)} approved for public posting.` : 'Public posting approval removed.'); refresh(); setMatches([]); setSearch('');
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update public posting approval.'); }
    finally { setBusy(false); }
  };

  const resolveReport = async (report: AnyRecord, decision: 'review' | 'dismiss' | 'hide_target') => {
    if (!canManage) return;
    setBusy(true); setError('');
    try {
      await api.request('platform-moderation', { method: 'PATCH', body: JSON.stringify({ action: 'resolve_report', reportId: report.id, decision, note: decision === 'dismiss' ? 'Reviewed from COT Ministry Tools' : undefined }) });
      setReports((current) => current.filter((item) => item.id !== report.id)); setMessage(decision === 'review' ? 'Report moved into review.' : decision === 'dismiss' ? 'Report dismissed.' : 'Reported target hidden.');
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to update moderation report.'); }
    finally { setBusy(false); }
  };

  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Public posting policy</Text><Notice error={error} message={message} /><View style={styles.chips}>{(['open','allowlist','closed'] as const).map((item) => <Chip key={item} label={item === 'open' ? 'Open' : item === 'allowlist' ? 'Approved only' : 'Paused'} selected={mode === item} onPress={canManage ? () => setMode(item) : undefined} />)}</View><InputField label={mode === 'open' ? 'Policy note' : 'Reason for restriction'} value={reason} onChangeText={setReason} multiline editable={canManage} /><Button label="Apply posting policy" onPress={() => void savePolicy()} loading={busy} disabled={!canManage} fullWidth />
  <Text style={[styles.sectionTitle, { color: colors.text }]}>Approved public posters</Text>{canManage ? <View style={styles.searchRow}><View style={styles.flex}><SearchBar value={search} onChangeText={setSearch} placeholder="Search account" onSubmitEditing={() => void findAccount()} /></View><Button label="Find" size="sm" onPress={() => void findAccount()} loading={busy} /></View> : null}{matches.map((item) => <Card key={item.id} title={personLabel(item)} subtitle={item.email ?? item.phone ?? item.id} badge={String(item.account_status ?? 'active').toUpperCase()}><Button label="Approve" size="sm" onPress={() => void setApproval(item, true)} disabled={!canManage || item.account_status === 'banned'} /></Card>)}{exemptions.map((item) => <Card key={item.profileId ?? item.profile_id} title={item.displayName || item.profile?.display_name || item.email || item.profileId} subtitle={item.reason || 'Approved for public posting'} badge="APPROVED">{canManage ? <Button label="Revoke approval" variant="outline" size="sm" onPress={() => void setApproval(item, false)} /> : null}</Card>)}
  <Text style={[styles.sectionTitle, { color: colors.text }]}>Open moderation reports</Text>{reports.length ? reports.map((report) => <Card key={report.id} title={report.content?.displayTitle || report.comment?.body?.slice(0, 80) || 'Reported item'} subtitle={`${report.reason ?? 'Report'} · ${report.reporter?.display_name ?? 'Reporter'}`} badge={String(report.status ?? 'OPEN').toUpperCase()}>{canManage ? <><Button label="Review" variant="outline" size="sm" onPress={() => void resolveReport(report, 'review')} /><Button label="Dismiss" variant="outline" size="sm" onPress={() => void resolveReport(report, 'dismiss')} /><Button label="Hide target" size="sm" onPress={() => void resolveReport(report, 'hide_target')} /></> : null}</Card>) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>No open reports returned.</Text>}</View>;
}

export function RolesAccessControls({ authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const canManage = hasPlatformPermission(authority, 'platform.roles.manage');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AnyRecord[]>([]);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [access, setAccess] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const search = async () => {
    if (query.trim().length < 2) return;
    setBusy(true); setError('');
    try { const result = await api.request<{ items?: AnyRecord[] }>(`platform-users?q=${encodeURIComponent(query.trim())}&pageSize=20`); setUsers(result.items ?? []); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to search accounts.'); }
    finally { setBusy(false); }
  };
  const select = async (item: AnyRecord) => {
    setSelected(item); setBusy(true); setError('');
    try { setAccess(await api.request<AnyRecord>(`platform-roles-access?profileId=${encodeURIComponent(item.id)}`)); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to load account access.'); setAccess(null); }
    finally { setBusy(false); }
  };
  const assignmentMap = useMemo(() => new Map(arrayValue(access?.assignments).filter((item) => item.is_active && (!item.expires_at || Date.parse(item.expires_at) > Date.now())).map((item) => [item.permission_code, item])), [access]);
  const toggle = async (capability: AnyRecord) => {
    if (!selected || !canManage) return;
    const enabled = !assignmentMap.has(capability.code);
    setBusy(true); setError(''); setMessage('');
    try { await api.request('platform-roles-access', { method: 'PATCH', body: JSON.stringify({ profileId: selected.id, permissionCode: capability.code, enabled, reason: `Updated from mobile Ministry Tools: ${capability.name}` }) }); setMessage(`${capability.name} ${enabled ? 'granted' : 'revoked'}.`); await select(selected); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to update permission.'); }
    finally { setBusy(false); }
  };

  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>General Community roles & access</Text><Notice error={error} message={message} /><View style={styles.searchRow}><View style={styles.flex}><SearchBar value={query} onChangeText={setQuery} placeholder="Search name, email or phone" onSubmitEditing={() => void search()} /></View><Button label="Find" size="sm" onPress={() => void search()} loading={busy} /></View>{users.map((item) => <Pressable key={item.id} onPress={() => void select(item)}><Card title={personLabel(item)} subtitle={item.email ?? item.phone ?? item.id} badge={selected?.id === item.id ? 'SELECTED' : undefined} /></Pressable>)}{selected ? <View style={styles.section}><Text style={[styles.subheading, { color: colors.text }]}>{personLabel(selected)}</Text>{arrayValue(access?.platformRoles).length ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>Platform roles: {arrayValue(access?.platformRoles).map((item) => item.platform_roles?.name || item.role_code).join(', ')}</Text> : null}{arrayValue(access?.capabilities).map((capability) => { const granted = assignmentMap.has(capability.code); return <Card key={capability.code} title={capability.name ?? capability.code} subtitle={`${capability.description ?? ''}\n${capability.code}`} badge={granted ? 'GRANTED' : 'NOT GRANTED'}>{canManage ? <Button label={granted ? 'Revoke' : 'Grant'} variant={granted ? 'outline' : 'primary'} size="sm" onPress={() => void toggle(capability)} loading={busy} /> : null}</Card>; })}</View> : null}</View>;
}

export function AdminInvitationControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const payload = objectValue(data);
  const invitations = arrayValue(payload.invitations);
  const roles = arrayValue(payload.roles);
  const canManage = isPlatformSuperAdmin(authority) && hasPlatformPermission(authority, 'platform.roles.manage');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [messageText, setMessageText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (!roleCode && roles.length) setRoleCode(roles.find((item) => item.code === 'admin')?.code ?? roles[0].code); }, [roleCode, roles]);
  const send = async () => {
    if (!canManage || !email.trim() || !roleCode) { setError('Enter a registered user email and choose a role.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-admin-invitations', { method: 'POST', body: JSON.stringify({ email: email.trim(), roleCode, message: messageText.trim() }) }); setMessage(`Administrator invitation sent to ${email.trim()}.`); setOpen(false); setEmail(''); setMessageText(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to send invitation.'); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    if (!canManage) return;
    setBusy(true); setError('');
    try { await api.request('platform-admin-invitations', { method: 'DELETE', body: JSON.stringify({ invitationId: id }) }); setMessage('Pending invitation revoked.'); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to revoke invitation.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.section}><View style={styles.headingRow}><View style={styles.flex}><Text style={[styles.sectionTitle, { color: colors.text }]}>Administrator invitations</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Role offers take effect only after acceptance.</Text></View>{canManage ? <Button label="Invite" size="sm" onPress={() => setOpen(true)} /> : null}</View><Notice error={error} message={message} />{invitations.map((item) => <Card key={item.id} title={item.target_email} subtitle={`${roles.find((role) => role.code === item.platform_role_code)?.name ?? item.platform_role_code} · expires ${new Date(item.expires_at).toLocaleDateString()}`} badge={String(item.status).toUpperCase()}>{canManage && item.status === 'pending' ? <Button label="Revoke" variant="outline" size="sm" onPress={() => void revoke(item.id)} loading={busy} /> : null}</Card>)}<BottomSheet visible={open} onClose={() => { if (!busy) setOpen(false); }} title="Invite administrator" subtitle="Registered COT accounts only"><InputField label="Registered user email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Administrator role</Text><View style={styles.chips}>{roles.map((role) => <Chip key={role.code} label={role.name ?? role.code} selected={roleCode === role.code} onPress={() => setRoleCode(role.code)} />)}</View><InputField label="Invitation message (optional)" value={messageText} onChangeText={setMessageText} multiline /><Button label="Send invitation" onPress={() => void send()} loading={busy} fullWidth /></BottomSheet></View>;
}

export function ExpressionCreatorControls({ data, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const organizations = arrayValue(objectValue(data).items);
  const canManage = isPlatformSuperAdmin(authority) && hasPlatformPermission(authority, 'platform.expression_creators.manage');
  const [organizationId, setOrganizationId] = useState('');
  const [authorizations, setAuthorizations] = useState<AnyRecord[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (!organizationId && organizations.length) setOrganizationId(organizations.find((item) => item.status === 'active')?.id ?? organizations[0].id); }, [organizationId, organizations]);
  const load = async (id = organizationId) => { if (!id) return; setBusy(true); try { setAuthorizations(await api.request<AnyRecord[]>(`expression-creators?organizationId=${encodeURIComponent(id)}`)); } catch (value) { setError(value instanceof Error ? value.message : 'Unable to load creator access.'); } finally { setBusy(false); } };
  useEffect(() => { if (organizationId) void load(organizationId); }, [organizationId]);
  const setAccess = async (targetEmail: string, enabled: boolean) => {
    if (!organizationId || !targetEmail.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try { await api.request('expression-creators', { method: 'POST', body: JSON.stringify({ organizationId, email: targetEmail.trim(), enabled }) }); setMessage(enabled ? `${targetEmail} can now create an Expression for this church.` : `Creation access revoked for ${targetEmail}.`); setEmail(''); await load(organizationId); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to update creator access.'); }
    finally { setBusy(false); }
  };
  if (!canManage) return null;
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Expression creation authority</Text><Notice error={error} message={message} /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Church organisation</Text><View style={styles.chips}>{organizations.map((item) => <Chip key={item.id} label={item.name} selected={organizationId === item.id} onPress={() => setOrganizationId(item.id)} />)}</View><InputField label="Registered account email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" helperText="The account must already exist in COT." /><Button label="Grant creation access" onPress={() => void setAccess(email, true)} loading={busy} fullWidth />{authorizations.map((item) => <Card key={`${item.organization_id}:${item.profile_id}`} title={item.profile?.display_name || item.email || item.profile_id} subtitle={item.email ?? item.profile_id} badge={item.is_active ? 'ALLOWED' : 'REVOKED'}>{item.is_active && item.email ? <Button label="Revoke" variant="outline" size="sm" onPress={() => void setAccess(item.email, false)} /> : null}</Card>)}</View>;
}

export function PlatformAccessControls({ moduleKey, data, refresh, authority }: Props & { moduleKey: string }) {
  if (moduleKey === 'moderation') return <ModerationControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'roles-access') return <RolesAccessControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'admin-invitations') return <AdminInvitationControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'expression-creators') return <ExpressionCreatorControls data={data} refresh={refresh} authority={authority} />;
  return null;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm }, flex: { flex: 1, minWidth: 0 }, sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: spacing.sm }, subheading: { fontSize: 15, lineHeight: 20, fontWeight: '900' }, sectionCopy: { fontSize: 10.8, lineHeight: 16, marginTop: -4 }, headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, cardTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' }, cardSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 3 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 10.5, lineHeight: 16, fontWeight: '700' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }, searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, emptyText: { fontSize: 11, lineHeight: 16 }, fieldLabel: { fontSize: 11, lineHeight: 16, fontWeight: '800', marginBottom: 3 },
});
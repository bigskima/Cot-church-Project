import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet, Button, Chip, Icon, InputField } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { hasPlatformPermission, type PlatformAdministrationContext } from './usePlatformAdministration';

type AnyRecord = Record<string, any>;
type Props = { data: unknown; refresh: () => void; authority?: PlatformAdministrationContext | null };
function objectValue(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function arrayValue(value: unknown): AnyRecord[] { return Array.isArray(value) ? value as AnyRecord[] : []; }
function itemLabel(item: AnyRecord) { return item.name || item.display_name || item.displayName || item.title || item.code || item.key || item.secret_reference || item.id || 'Record'; }

function Notice({ error, message }: { error: string; message: string }) {
  const { colors } = useTheme();
  if (!error && !message) return null;
  return <View style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: error ? colors.live : colors.primarySoftStrong }]}><Icon name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={17} color={error ? colors.live : colors.interactive} /><Text style={[styles.noticeText, { color: colors.textSecondary }]}>{error || message}</Text></View>;
}

function Card({ title, subtitle, badge, children, onPress }: { title: string; subtitle?: string; badge?: string; children?: React.ReactNode; onPress?: () => void }) {
  const { colors } = useTheme();
  const body = <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>{subtitle ? <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}</View>{badge ? <Badge label={badge} variant="neutral" /> : null}</View>{children ? <View style={styles.actions}>{children}</View> : null}</View>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function CredentialControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const items = arrayValue(data);
  const canManage = hasPlatformPermission(authority, 'platform.secrets.manage');
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('ai');
  const [providerCode, setProviderCode] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [checks, setChecks] = useState<Record<string, string>>({});

  const openEditor = (item?: AnyRecord) => {
    setReference(item?.secret_reference ?? ''); setCategory(item?.category ?? 'ai'); setProviderCode(item?.provider_code ?? ''); setDescription(item?.description ?? ''); setValue(''); setError(''); setOpen(true);
  };
  const store = async () => {
    const normalized = reference.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(normalized)) { setError('Credential name must use uppercase letters, numbers or underscores and begin with a letter.'); return; }
    if (!value) { setError('Paste the credential value before saving.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-secrets', { method: 'POST', body: JSON.stringify({ action: 'store', reference: normalized, value, category, providerCode: providerCode.trim() || undefined, description: description.trim() || undefined }) }); setMessage(`${normalized} stored securely. Its value will not be displayed again.`); setOpen(false); setValue(''); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to store credential.'); }
    finally { setBusy(false); }
  };
  const check = async (item: AnyRecord) => {
    setBusy(true); setError('');
    try { const result = await api.request<AnyRecord>('platform-secrets', { method: 'POST', body: JSON.stringify({ action: 'check', reference: item.secret_reference }) }); setChecks((current) => ({ ...current, [item.secret_reference]: result.configured ? (result.source === 'platform_vault' ? 'READY' : 'READY (HOSTING)') : 'MISSING' })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to check credential.'); }
    finally { setBusy(false); }
  };
  const remove = async (item: AnyRecord) => {
    if (!canManage) return;
    setBusy(true); setError('');
    try { await api.request('platform-secrets', { method: 'POST', body: JSON.stringify({ action: 'delete', reference: item.secret_reference }) }); setMessage(`${item.secret_reference} removed from secure credential storage.`); refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to remove credential.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.section}><View style={styles.headingRow}><View style={styles.flex}><Text style={[styles.sectionTitle, { color: colors.text }]}>Secure credential controls</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Values are write-only after storage. Rotate by saving a new value under the same reference.</Text></View>{canManage ? <Button label="Add" size="sm" onPress={() => openEditor()} /> : null}</View><Notice error={error} message={message} />{items.map((item) => <Card key={item.secret_reference} title={item.secret_reference} subtitle={`${item.category ?? 'other'} · ${item.provider_code ?? 'provider'}`} badge={checks[item.secret_reference] ?? 'PROTECTED'}>{canManage ? <><Button label="Check" variant="outline" size="sm" onPress={() => void check(item)} loading={busy} /><Button label="Rotate" variant="outline" size="sm" onPress={() => openEditor(item)} /><Button label="Remove" variant="outline" size="sm" onPress={() => void remove(item)} /></> : null}</Card>)}<BottomSheet visible={open} onClose={() => { if (!busy) setOpen(false); }} title={items.some((item) => item.secret_reference === reference.trim().toUpperCase()) ? 'Rotate credential' : 'Add credential'} subtitle="The value cannot be displayed after a successful save"><InputField label="Credential reference" value={reference} onChangeText={(text) => setReference(text.toUpperCase())} autoCapitalize="characters" /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text><View style={styles.chips}>{['ai','streaming','payments','communications','integration','other'].map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View><InputField label="Provider code" value={providerCode} onChangeText={(text) => setProviderCode(text.toLowerCase())} autoCapitalize="none" /><InputField label="Description" value={description} onChangeText={setDescription} /><InputField label="Credential value" value={value} onChangeText={setValue} secureTextEntry autoCapitalize="none" autoCorrect={false} /><Button label="Encrypt & save" onPress={() => void store()} loading={busy} fullWidth /></BottomSheet></View>;
}

export function StreamingControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const payload = objectValue(data);
  const providers = arrayValue(payload.providers);
  const configs = arrayValue(payload.globalConfigs);
  const streams = arrayValue(payload.streams);
  const canManage = hasPlatformPermission(authority, 'platform.streaming.manage');
  const [provider, setProvider] = useState<AnyRecord | null>(null);
  const [secretReference, setSecretReference] = useState('');
  const [webhookReference, setWebhookReference] = useState('');
  const [signingReference, setSigningReference] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [reason, setReason] = useState('');
  const [terminate, setTerminate] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const configMap = useMemo(() => new Map(configs.map((item) => [item.provider_id, item])), [configs]);
  const openProvider = (item: AnyRecord) => { const config = configMap.get(item.id); setProvider(item); setSecretReference(config?.secret_reference ?? `STREAMING_${String(item.code).toUpperCase()}_PRIMARY`); setWebhookReference(config?.webhook_secret_reference ?? `STREAMING_${String(item.code).toUpperCase()}_WEBHOOK`); setSigningReference(config?.signing_key_reference ?? ''); setMakeDefault(Boolean(config?.is_default) || !configs.some((entry) => entry.is_active && entry.is_default)); setReason(''); setError(''); };
  const saveConfig = async () => {
    if (!provider || !canManage) return;
    if (!secretReference.trim() || !webhookReference.trim()) { setError('Primary and webhook credential references are required.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-streaming', { method: 'PATCH', body: JSON.stringify({ action: 'configure_global', providerId: provider.id, secretReference: secretReference.trim().toUpperCase(), webhookSecretReference: webhookReference.trim().toUpperCase(), signingKeyReference: signingReference.trim().toUpperCase() || undefined, configuration: configMap.get(provider.id)?.configuration ?? {}, isDefault: makeDefault, isActive: true }) }); setMessage(`${provider.name} configuration saved.`); setProvider(null); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to configure streaming provider.'); }
    finally { setBusy(false); }
  };
  const toggleProvider = async (item: AnyRecord) => {
    const next = !item.is_active;
    if (!next) { setProvider(item); setReason(''); return; }
    setBusy(true); setError('');
    try { await api.request('platform-streaming', { method: 'PATCH', body: JSON.stringify({ action: 'set_provider_active', providerId: item.id, isActive: true }) }); setMessage(`${item.name} enabled.`); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to enable provider.'); }
    finally { setBusy(false); }
  };
  const disableProvider = async () => {
    if (!provider || reason.trim().length < 3) { setError('Add a governance reason before disabling this provider.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-streaming', { method: 'PATCH', body: JSON.stringify({ action: 'set_provider_active', providerId: provider.id, isActive: false, reason: reason.trim() }) }); setMessage(`${provider.name} disabled.`); setProvider(null); setReason(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to disable provider.'); }
    finally { setBusy(false); }
  };
  const terminateStream = async () => {
    if (!terminate || reason.trim().length < 3) { setError('Add a safety or governance reason before emergency termination.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-streaming', { method: 'PATCH', body: JSON.stringify({ action: 'terminate_stream', streamId: terminate.id, reason: reason.trim() }) }); setMessage('Stream termination request applied.'); setTerminate(null); setReason(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to terminate stream.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Streaming service controls</Text><Notice error={error} message={message} />{providers.map((item) => <Card key={item.id} title={item.name} subtitle={`${item.code} · ${arrayValue(item.capabilities).join(', ')}`} badge={item.is_active ? 'ENABLED' : 'DISABLED'}>{canManage ? <><Button label="Configure" variant="outline" size="sm" onPress={() => openProvider(item)} /><Button label={item.is_active ? 'Disable' : 'Enable'} variant="outline" size="sm" onPress={() => void toggleProvider(item)} /></> : null}</Card>)}<Text style={[styles.sectionTitle, { color: colors.text }]}>Broadcast monitor</Text>{streams.map((item) => <Card key={item.id} title={item.title} subtitle={`${item.organizations?.name ?? item.organization_id} · ${item.branches?.name ?? 'Organisation-wide'}`} badge={String(item.status).toUpperCase()}>{canManage && ['live','ready','provisioning'].includes(item.status) ? <Button label="Emergency terminate" variant="outline" size="sm" onPress={() => { setTerminate(item); setReason(''); }} /> : null}</Card>)}<BottomSheet visible={!!provider} onClose={() => { if (!busy) setProvider(null); }} title={provider ? `Configure ${provider.name}` : 'Streaming service'} subtitle="Use Secure Credentials to store/rotate secret values; this screen binds their references.">{provider?.is_active ? <><InputField label="Primary credential reference" value={secretReference} onChangeText={setSecretReference} autoCapitalize="characters" /><InputField label="Webhook credential reference" value={webhookReference} onChangeText={setWebhookReference} autoCapitalize="characters" /><InputField label="Playback signing reference (optional)" value={signingReference} onChangeText={setSigningReference} autoCapitalize="characters" /><View style={styles.chips}><Chip label="Default provider" selected={makeDefault} onPress={() => setMakeDefault((value) => !value)} /></View><Button label="Save provider configuration" onPress={() => void saveConfig()} loading={busy} fullWidth /><InputField label="Reason to disable provider" value={reason} onChangeText={setReason} multiline /><Button label="Disable provider" variant="outline" onPress={() => void disableProvider()} loading={busy} fullWidth /></> : <><Text style={[styles.body, { color: colors.textSecondary }]}>This provider is disabled. Enable it first, then configure its credential references.</Text><Button label="Enable provider" onPress={() => provider && void toggleProvider(provider)} loading={busy} fullWidth /></>}</BottomSheet><BottomSheet visible={!!terminate} onClose={() => { if (!busy) setTerminate(null); }} title="Emergency stream termination" subtitle={terminate?.title}><InputField label="Safety / governance reason" value={reason} onChangeText={setReason} multiline /><Button label="Terminate stream" onPress={() => void terminateStream()} loading={busy} fullWidth /></BottomSheet></View>;
}

export function AiControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const payload = objectValue(data);
  const providers = arrayValue(payload.providers);
  const models = arrayValue(payload.models);
  const capabilities = arrayValue(payload.capabilities);
  const routes = arrayValue(payload.globalRoutes);
  const canManage = hasPlatformPermission(authority, 'platform.ai.manage');
  const [provider, setProvider] = useState<AnyRecord | null>(null);
  const [status, setStatus] = useState('active');
  const [secretReference, setSecretReference] = useState('');
  const [reason, setReason] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [modelProviderId, setModelProviderId] = useState('');
  const [modelKey, setModelKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [contextWindow, setContextWindow] = useState('');
  const [routeCapability, setRouteCapability] = useState<AnyRecord | null>(null);
  const [routeModel, setRouteModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const activeModels = models.filter((item) => item.is_active);
  const routeMap = useMemo(() => new Map(routes.map((item) => [item.capability_code, item])), [routes]);
  const openProvider = (item: AnyRecord) => { setProvider(item); setStatus(item.status === 'disabled' ? 'active' : item.status); setSecretReference(item.secret_reference || `AI_${String(item.code).toUpperCase()}_PRIMARY`); setReason(''); setError(''); };
  const saveProvider = async () => {
    if (!provider || !canManage) return;
    if (status !== 'active' && reason.trim().length < 3) { setError('Add a governance reason when degrading or disabling a provider.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-ai', { method: 'PATCH', body: JSON.stringify({ action: 'configure_provider', providerId: provider.id, status, secretReference: secretReference.trim().toUpperCase(), configuration: provider.configuration ?? {}, reason: status === 'active' ? undefined : reason.trim() }) }); setMessage(`${provider.name} configuration saved.`); setProvider(null); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to configure AI provider.'); }
    finally { setBusy(false); }
  };
  const saveModel = async () => {
    if (!canManage || !modelProviderId || !modelKey.trim() || !modelName.trim()) { setError('Provider, model key and display name are required.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-ai', { method: 'PATCH', body: JSON.stringify({ action: 'upsert_model', providerId: modelProviderId, modelKey: modelKey.trim(), displayName: modelName.trim(), inputCostPerMillion: 0, outputCostPerMillion: 0, contextWindow: contextWindow ? Number(contextWindow) : null, isActive: true, configuration: {} }) }); setMessage(`${modelName.trim()} added.`); setModelOpen(false); setModelKey(''); setModelName(''); setContextWindow(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to save AI model.'); }
    finally { setBusy(false); }
  };
  const saveRoute = async () => {
    if (!routeCapability || !routeModel || !canManage) { setError('Select an active model for this AI task.'); return; }
    const existing = routeMap.get(routeCapability.code);
    setBusy(true); setError('');
    try { await api.request('platform-ai', { method: 'PATCH', body: JSON.stringify({ action: 'set_route', capabilityCode: routeCapability.code, primaryModelId: routeModel, fallbackModelIds: existing?.fallback_model_ids ?? [], timeoutMs: existing?.timeout_ms ?? 30000, maxRetries: existing?.max_retries ?? 1, isActive: true }) }); setMessage(`${routeCapability.name} route updated.`); setRouteCapability(null); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to save AI route.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.section}><View style={styles.headingRow}><View style={styles.flex}><Text style={[styles.sectionTitle, { color: colors.text }]}>AI service controls</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>Provider-independent routing remains backend-driven. Secret values are managed in Secure Credentials.</Text></View>{canManage ? <Button label="Add model" size="sm" onPress={() => { setModelProviderId(providers[0]?.id ?? ''); setModelOpen(true); }} /> : null}</View><Notice error={error} message={message} />{providers.map((item) => <Card key={item.id} title={item.name} subtitle={`${item.code} · credential ${item.secret_reference ?? 'not set'}`} badge={String(item.status).toUpperCase()}>{canManage ? <Button label="Configure" variant="outline" size="sm" onPress={() => openProvider(item)} /> : null}</Card>)}<Text style={[styles.sectionTitle, { color: colors.text }]}>AI models</Text>{models.map((item) => <Card key={item.id} title={item.display_name ?? item.model_key} subtitle={`${item.ai_providers?.name ?? providers.find((entry) => entry.id === item.provider_id)?.name ?? item.provider_id} · ${item.model_key}`} badge={item.is_active ? 'ACTIVE' : 'DISABLED'} />)}<Text style={[styles.sectionTitle, { color: colors.text }]}>Capability routes</Text>{capabilities.map((item) => { const route = routeMap.get(item.code); const model = models.find((entry) => entry.id === route?.primary_model_id); return <Card key={item.code} title={item.name} subtitle={`${item.code} · ${item.risk_level ?? 'low'} risk`} badge={model?.display_name ?? 'UNROUTED'}>{canManage ? <Button label="Assign model" variant="outline" size="sm" onPress={() => { setRouteCapability(item); setRouteModel(route?.primary_model_id ?? activeModels[0]?.id ?? ''); }} /> : null}</Card>; })}<BottomSheet visible={!!provider} onClose={() => { if (!busy) setProvider(null); }} title={provider ? `Configure ${provider.name}` : 'AI provider'}><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Provider state</Text><View style={styles.chips}>{['active','degraded','disabled'].map((item) => <Chip key={item} label={item} selected={status === item} onPress={() => setStatus(item)} />)}</View><InputField label="Credential reference" value={secretReference} onChangeText={setSecretReference} autoCapitalize="characters" />{status !== 'active' ? <InputField label="Governance reason" value={reason} onChangeText={setReason} multiline /> : null}<Button label="Save AI provider" onPress={() => void saveProvider()} loading={busy} fullWidth /></BottomSheet><BottomSheet visible={modelOpen} onClose={() => { if (!busy) setModelOpen(false); }} title="Add AI model"><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Provider</Text><View style={styles.chips}>{providers.map((item) => <Chip key={item.id} label={item.name} selected={modelProviderId === item.id} onPress={() => setModelProviderId(item.id)} />)}</View><InputField label="Model key" value={modelKey} onChangeText={setModelKey} autoCapitalize="none" /><InputField label="Display name" value={modelName} onChangeText={setModelName} /><InputField label="Context window (optional)" value={contextWindow} onChangeText={setContextWindow} keyboardType="number-pad" /><Button label="Add active model" onPress={() => void saveModel()} loading={busy} fullWidth /></BottomSheet><BottomSheet visible={!!routeCapability} onClose={() => { if (!busy) setRouteCapability(null); }} title="Assign AI task" subtitle={routeCapability?.name}><View style={styles.chips}>{activeModels.map((item) => <Chip key={item.id} label={item.display_name ?? item.model_key} selected={routeModel === item.id} onPress={() => setRouteModel(item.id)} />)}</View><Button label="Save route" onPress={() => void saveRoute()} loading={busy} fullWidth /></BottomSheet></View>;
}

export function PaymentControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const providers = arrayValue(objectValue(data).providers);
  const canManage = hasPlatformPermission(authority, 'platform.payments.manage');
  const [provider, setProvider] = useState<AnyRecord | null>(null);
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');
  const [secretReference, setSecretReference] = useState('');
  const [webhookReference, setWebhookReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const open = (item: AnyRecord) => { const existing = arrayValue(item.configurations).find((entry) => entry.organization_id === null && entry.environment === 'production') ?? arrayValue(item.configurations).find((entry) => entry.organization_id === null); setProvider(item); setEnvironment(existing?.environment ?? 'production'); setSecretReference(existing?.secret_reference ?? `PAYMENT_${String(item.code).toUpperCase()}_PRIMARY`); setWebhookReference(existing?.webhook_secret_reference ?? `PAYMENT_${String(item.code).toUpperCase()}_WEBHOOK`); setError(''); };
  const save = async () => {
    if (!provider || !canManage) return;
    if (!secretReference.trim() || !webhookReference.trim()) { setError('Payment and webhook credential references are required.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-payments', { method: 'PATCH', body: JSON.stringify({ action: 'upsert_provider_config', providerId: provider.id, organizationId: null, environment, secretReference: secretReference.trim().toUpperCase(), webhookSecretReference: webhookReference.trim().toUpperCase(), configuration: arrayValue(provider.configurations).find((entry) => entry.organization_id === null)?.configuration ?? {}, isDefault: false, isActive: false, reason: 'Prepared from COT Ministry Tools; online payments remain release-locked.' }) }); setMessage(`${provider.name} configuration prepared. Online payment remains inactive.`); setProvider(null); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to prepare payment provider.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Payment service preparation</Text><Text style={[styles.sectionCopy, { color: colors.textMuted }]}>This preserves the current release lock: saving configuration does not activate online giving.</Text><Notice error={error} message={message} />{providers.map((item) => <Card key={item.id} title={item.name} subtitle={`${item.code} · ${arrayValue(item.supported_currencies).join(', ')}`} badge="FUTURE / OFF">{canManage ? <Button label="Prepare configuration" variant="outline" size="sm" onPress={() => open(item)} /> : null}</Card>)}<BottomSheet visible={!!provider} onClose={() => { if (!busy) setProvider(null); }} title={provider ? `Prepare ${provider.name}` : 'Payment provider'} subtitle="Store secret values in Secure Credentials first"><View style={styles.chips}><Chip label="Production" selected={environment === 'production'} onPress={() => setEnvironment('production')} /><Chip label="Sandbox" selected={environment === 'sandbox'} onPress={() => setEnvironment('sandbox')} /></View><InputField label="Payment credential reference" value={secretReference} onChangeText={setSecretReference} autoCapitalize="characters" /><InputField label="Webhook credential reference" value={webhookReference} onChangeText={setWebhookReference} autoCapitalize="characters" /><Button label="Save inactive preparation" onPress={() => void save()} loading={busy} fullWidth /></BottomSheet></View>;
}

export function IntegrationControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const payload = objectValue(data);
  const canManage = hasPlatformPermission(authority, 'platform.integrations.manage');
  const connections = arrayValue(payload.connections);
  const jobs = ([
    ...arrayValue(payload.notifications).map((item) => ({ ...item, _queue: 'notification' })),
    ...arrayValue(payload.workflows).map((item) => ({ ...item, _queue: 'workflow' })),
    ...arrayValue(payload.deliveries).map((item) => ({ ...item, _queue: 'integration' })),
  ] as AnyRecord[]).filter((item) => item.status === 'failed' || item.status === 'dead_letter');
  const [target, setTarget] = useState<AnyRecord | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const retry = async () => {
    if (!target || !canManage || reason.trim().length < 3) { setError('Enter an audit reason before retrying a failed job.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-integrations', { method: 'PATCH', body: JSON.stringify({ action: 'retry_job', queue: target._queue, id: target.id, reason: reason.trim() }) }); setMessage('Failed background job queued for retry.'); setTarget(null); setReason(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to retry job.'); }
    finally { setBusy(false); }
  };
  const toggleConnection = async (item: AnyRecord) => {
    const next = item.status === 'active' ? 'disabled' : 'active';
    if (next === 'disabled') { setTarget({ ...item, _connection: true, _next: next }); setReason(''); return; }
    setBusy(true); setError('');
    try { await api.request('platform-integrations', { method: 'PATCH', body: JSON.stringify({ action: 'set_connection_status', connectionId: item.id, status: next }) }); setMessage(`${item.name ?? item.provider} enabled.`); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to update connection.'); }
    finally { setBusy(false); }
  };
  const disableConnection = async () => {
    if (!target?._connection || reason.trim().length < 3) { setError('Add a governance reason before disabling this connection.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-integrations', { method: 'PATCH', body: JSON.stringify({ action: 'set_connection_status', connectionId: target.id, status: 'disabled', reason: reason.trim() }) }); setMessage(`${target.name ?? target.provider} disabled.`); setTarget(null); setReason(''); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to disable connection.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Integration connections</Text><Notice error={error} message={message} />{connections.map((item) => <Card key={item.id} title={item.name ?? item.provider} subtitle={`${item.provider} · ${item.organizations?.name ?? 'Platform'}`} badge={String(item.status).toUpperCase()}>{canManage ? <Button label={item.status === 'active' ? 'Disable' : 'Enable'} variant="outline" size="sm" onPress={() => void toggleConnection(item)} /> : null}</Card>)}<Text style={[styles.sectionTitle, { color: colors.text }]}>Failed background work</Text>{jobs.length ? jobs.map((item) => <Card key={`${item._queue}:${item.id}`} title={`${String(item._queue).toUpperCase()} · ${item.id}`} subtitle={item.last_error ?? `Attempts: ${item.attempts ?? 0}`} badge={String(item.status).toUpperCase()}>{canManage ? <Button label="Retry" variant="outline" size="sm" onPress={() => { setTarget(item); setReason(''); }} /> : null}</Card>) : <Text style={[styles.body, { color: colors.textMuted }]}>No failed/dead-letter work in the current telemetry.</Text>}<BottomSheet visible={!!target} onClose={() => { if (!busy) setTarget(null); }} title={target?._connection ? 'Disable integration connection' : 'Retry failed background job'} subtitle={target?._connection ? target?.name ?? target?.provider : `${target?._queue ?? ''} ${target?.id ?? ''}`}><InputField label="Audit / governance reason" value={reason} onChangeText={setReason} multiline /><Button label={target?._connection ? 'Disable connection' : 'Retry job'} onPress={() => void (target?._connection ? disableConnection() : retry())} loading={busy} fullWidth /></BottomSheet></View>;
}

export function PublicDirectoryControls({ data, refresh, authority }: Props) {
  const { api } = useSession();
  const { colors } = useTheme();
  const organizations = arrayValue(objectValue(data).organizations);
  const canManage = hasPlatformPermission(authority, 'platform.public_directory.manage');
  const [organizationId, setOrganizationId] = useState('');
  const [directory, setDirectory] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (!organizationId && organizations.length) setOrganizationId(organizations.find((item) => item.status === 'active')?.id ?? organizations[0].id); }, [organizationId, organizations]);
  const load = async (id = organizationId) => { if (!id) return; setBusy(true); try { const value = await api.request<AnyRecord>(`platform-public-directory?organizationId=${encodeURIComponent(id)}`); setDirectory(value); setDraft(value.story ?? { title: 'Our Story & Heritage', subtitle: '', mission: '', vision: '', founding_story: '', founding_year: null, history_milestones: [], values: [], banner_image_url: null, is_published: false }); } catch (value) { setError(value instanceof Error ? value.message : 'Unable to load public directory.'); } finally { setBusy(false); } };
  useEffect(() => { if (organizationId) void load(organizationId); }, [organizationId]);
  const setField = (key: string, value: any) => setDraft((current) => ({ ...current, [key]: value }));
  const saveStory = async () => {
    if (!canManage || !organizationId || !String(draft.title ?? '').trim()) { setError('Story title is required.'); return; }
    setBusy(true); setError('');
    try { await api.request('platform-public-directory', { method: 'PATCH', body: JSON.stringify({ action: 'upsert_story', organizationId, title: String(draft.title).trim(), subtitle: String(draft.subtitle ?? '').trim(), mission: String(draft.mission ?? '').trim(), vision: String(draft.vision ?? '').trim(), foundingStory: String(draft.founding_story ?? '').trim(), foundingYear: draft.founding_year ? Number(draft.founding_year) : null, historyMilestones: arrayValue(draft.history_milestones), values: arrayValue(draft.values), bannerImageUrl: draft.banner_image_url || null, isPublished: Boolean(draft.is_published) }) }); setMessage('General Community church story saved.'); await load(organizationId); refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to save church story.'); }
    finally { setBusy(false); }
  };
  if (!canManage) return null;
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>Public church directory</Text><Notice error={error} message={message} /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Church organisation</Text><View style={styles.chips}>{organizations.map((item) => <Chip key={item.id} label={item.name} selected={organizationId === item.id} onPress={() => setOrganizationId(item.id)} />)}</View>{directory ? <><InputField label="Public story title" value={String(draft.title ?? '')} onChangeText={(value) => setField('title', value)} /><InputField label="Subtitle" value={String(draft.subtitle ?? '')} onChangeText={(value) => setField('subtitle', value)} /><InputField label="Mission" value={String(draft.mission ?? '')} onChangeText={(value) => setField('mission', value)} multiline /><InputField label="Vision" value={String(draft.vision ?? '')} onChangeText={(value) => setField('vision', value)} multiline /><InputField label="Founding story" value={String(draft.founding_story ?? '')} onChangeText={(value) => setField('founding_story', value)} multiline /><InputField label="Founding year" value={draft.founding_year == null ? '' : String(draft.founding_year)} onChangeText={(value) => setField('founding_year', value)} keyboardType="number-pad" /><InputField label="Banner image URL" value={String(draft.banner_image_url ?? '')} onChangeText={(value) => setField('banner_image_url', value)} autoCapitalize="none" /><View style={styles.chips}><Chip label={draft.is_published ? 'Published' : 'Draft'} selected={Boolean(draft.is_published)} onPress={() => setField('is_published', !draft.is_published)} /></View><Button label="Save public church story" onPress={() => void saveStory()} loading={busy} fullWidth /><Text style={[styles.sectionTitle, { color: colors.text }]}>Central public leadership</Text>{arrayValue(directory.leaders).map((item) => <Card key={item.id} title={item.display_name} subtitle={`${item.role_title ?? 'Leader'} · order ${item.display_order ?? 0}`} badge={item.is_active ? 'ACTIVE' : 'ARCHIVED'} />)}<Text style={[styles.body, { color: colors.textMuted }]}>Leadership creation, portrait upload and detailed editing remain available through the related native Church Leadership control above this section.</Text></> : null}</View>;
}

export function PlatformServiceControls({ moduleKey, data, refresh, authority }: Props & { moduleKey: string }) {
  if (moduleKey === 'credentials') return <CredentialControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'streaming') return <StreamingControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'ai') return <AiControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'payments') return <PaymentControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'integrations') return <IntegrationControls data={data} refresh={refresh} authority={authority} />;
  if (moduleKey === 'public-directory') return <PublicDirectoryControls data={data} refresh={refresh} authority={authority} />;
  return null;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm }, flex: { flex: 1, minWidth: 0 }, sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: spacing.sm }, sectionCopy: { fontSize: 10.8, lineHeight: 16, marginTop: -4 }, headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, body: { fontSize: 11, lineHeight: 16 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, cardTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' }, cardSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 3 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 10.5, lineHeight: 16, fontWeight: '700' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }, fieldLabel: { fontSize: 11, lineHeight: 16, fontWeight: '800', marginBottom: 3 },
});
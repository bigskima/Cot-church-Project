import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, StatWidget, Table } from '../components/ui';

interface StreamingProvider {
  id: string;
  code: string;
  name: string;
  adapter_version: string;
  capabilities: string[];
  is_active: boolean;
}

interface ProviderConfig {
  id: string;
  provider_id: string;
  secret_reference: string;
  webhook_secret_reference: string;
  signing_key_reference?: string | null;
  configuration?: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
  streaming_providers?: StreamingProvider | null;
}

interface ActiveStream {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  title: string;
  status: string;
  latency_mode?: string | null;
  scheduled_start?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  lifecycle_error?: string | null;
  organizations?: { id: string; name: string; slug: string } | null;
  branches?: { id: string; name: string; code: string } | null;
}

interface WebhookEvent {
  id: string;
  provider_id: string;
  event_type: string;
  signature_valid: boolean;
  received_at: string;
  processed_at?: string | null;
  processing_error?: string | null;
}

interface StreamingPayload {
  providers: StreamingProvider[];
  globalConfigs: ProviderConfig[];
  streams: ActiveStream[];
  recentWebhooks: WebhookEvent[];
}

export function StreamingInfrastructure({ api, canManage = false, canManageSecrets = false }: { api: ApiClient; canManage?: boolean; canManageSecrets?: boolean }) {
  const [data, setData] = useState<StreamingPayload>({ providers: [], globalConfigs: [], streams: [], recentWebhooks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedStreamToKill, setSelectedStreamToKill] = useState<ActiveStream | null>(null);
  const [terminationReason, setTerminationReason] = useState('');
  const [providerStateTarget, setProviderStateTarget] = useState<StreamingProvider | null>(null);
  const [providerStateReason, setProviderStateReason] = useState('');
  const [configProvider, setConfigProvider] = useState<StreamingProvider | null>(null);
  const [secretReference, setSecretReference] = useState('');
  const [webhookSecretReference, setWebhookSecretReference] = useState('');
  const [signingKeyReference, setSigningKeyReference] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [muxTokenId, setMuxTokenId] = useState('');
  const [muxTokenSecret, setMuxTokenSecret] = useState('');
  const [muxWebhookSecret, setMuxWebhookSecret] = useState('');
  const [muxSigningKeyId, setMuxSigningKeyId] = useState('');
  const [muxSigningPrivateKey, setMuxSigningPrivateKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [youtubeChannelId, setYoutubeChannelId] = useState('');
  const [agoraAppId, setAgoraAppId] = useState('');
  const [agoraAppCertificate, setAgoraAppCertificate] = useState('');
  const [agoraCohostAuthEnabled, setAgoraCohostAuthEnabled] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.request<StreamingPayload>('platform-streaming'));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load streaming infrastructure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [api]);

  const liveCount = data.streams.filter((stream) => stream.status === 'live').length;
  const routedConfig = (scope: 'general' | 'expression') => data.globalConfigs.find((config) =>
    config.is_active &&
    Array.isArray(config.configuration?.routingScopes) &&
    config.configuration!.routingScopes.includes(scope)
  );
  const generalConfig = routedConfig('general');
  const expressionConfig = routedConfig('expression');
  const webhookIssues = data.recentWebhooks.filter((event) => !event.signature_valid || Boolean(event.processing_error)).length;
  const configByProvider = useMemo(() => new Map(data.globalConfigs.map((config) => [config.provider_id, config])), [data.globalConfigs]);
  const routeLabel = (config?: ProviderConfig) => {
    const scopes = config?.configuration?.routingScopes;
    return Array.isArray(scopes) ? scopes.map(String).join(' + ').toUpperCase() : '';
  };

  const clearSecretInputs = () => {
    setMuxTokenId('');
    setMuxTokenSecret('');
    setMuxWebhookSecret('');
    setMuxSigningKeyId('');
    setMuxSigningPrivateKey('');
    setYoutubeApiKey('');
    setAgoraAppId('');
    setAgoraAppCertificate('');
  };

  const openConfig = (provider: StreamingProvider) => {
    if (!canManage) return;
    const config = configByProvider.get(provider.id);
    setConfigProvider(provider);
    const defaultPrimary = provider.code === 'mux'
      ? 'STREAMING_MUX_PRIMARY'
      : provider.code === 'youtube'
        ? 'STREAMING_YOUTUBE_DATA_API'
        : provider.code === 'agora'
          ? 'STREAMING_AGORA_PRIMARY'
          : `STREAMING_${provider.code.toUpperCase()}_PRIMARY`;
    const defaultWebhook = provider.code === 'mux' ? 'STREAMING_MUX_WEBHOOK_PRIMARY' : defaultPrimary;
    setSecretReference(config?.secret_reference ?? defaultPrimary);
    setWebhookSecretReference(config?.webhook_secret_reference ?? defaultWebhook);
    setSigningKeyReference(config?.signing_key_reference ?? (provider.code === 'mux' ? 'STREAMING_MUX_SIGNING_PRIMARY' : ''));
    setYoutubeChannelId(provider.code === 'youtube' && typeof config?.configuration?.channelId === 'string' ? String(config.configuration.channelId) : '');
    setAgoraCohostAuthEnabled(provider.code === 'agora' && config?.configuration?.cohostAuthenticationEnabled === true);
    const hasActiveDefault = data.globalConfigs.some((item) => item.is_active && item.is_default);
    setMakeDefault(Boolean(config?.is_default) || !hasActiveDefault);
    clearSecretInputs();
    setError('');
    setSuccess('');
  };

  const storeSecret = async (reference: string, value: string, description: string) => {
    if (!canManageSecrets) throw new Error('Your role cannot store or rotate platform secrets.');
    await api.request('platform-secrets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'store',
        reference,
        value,
        category: 'streaming',
        providerCode: configProvider?.code,
        description,
      }),
    });
  };

  const saveConfig = async () => {
    if (!canManage || !configProvider) return;
    if ((muxTokenId || muxTokenSecret || muxWebhookSecret || muxSigningKeyId || muxSigningPrivateKey || youtubeApiKey || agoraAppId || agoraAppCertificate) && !canManageSecrets) {
      setError('Your role can configure streaming but cannot store or rotate platform secrets.');
      return;
    }
    const primaryRef = secretReference.trim().toUpperCase();
    const webhookRef = (webhookSecretReference.trim() || primaryRef).toUpperCase();
    const signingRef = signingKeyReference.trim().toUpperCase();
    if (!primaryRef) {
      setError('Streaming credential name is required.');
      return;
    }
    if (configProvider.code === 'mux') {
      if (Boolean(muxTokenId) !== Boolean(muxTokenSecret)) {
        setError('Enter both the Mux Token ID and Token Secret, or leave both blank to reuse the currently stored credential.');
        return;
      }
      if (Boolean(muxSigningKeyId) !== Boolean(muxSigningPrivateKey)) {
        setError('Enter both the Mux Signing Key ID and private key PEM, or leave both blank.');
        return;
      }
    }
    if (configProvider.code === 'youtube' && !youtubeChannelId.trim()) {
      setError('Enter the YouTube Channel ID that General COT should follow.');
      return;
    }
    if (configProvider.code === 'agora' && Boolean(agoraAppId) !== Boolean(agoraAppCertificate)) {
      setError('Enter both the Agora App ID and App Certificate, or leave both blank to reuse the stored credential.');
      return;
    }

    setActionBusy(true);
    setError('');
    setSuccess('');
    try {
      if (configProvider.code === 'mux' && muxTokenId && muxTokenSecret) {
        await storeSecret(primaryRef, JSON.stringify({ tokenId: muxTokenId.trim(), tokenSecret: muxTokenSecret.trim() }), 'Mux API access token used by the broadcast service');
      }
      if (configProvider.code === 'mux' && muxWebhookSecret) {
        await storeSecret(webhookRef, muxWebhookSecret.trim(), 'Mux webhook signing secret');
      }
      if (configProvider.code === 'mux' && muxSigningKeyId && muxSigningPrivateKey && signingRef) {
        await storeSecret(signingRef, JSON.stringify({ keyId: muxSigningKeyId.trim(), privateKeyPem: muxSigningPrivateKey.trim() }), 'Mux signed-playback private key');
      }
      if (configProvider.code === 'youtube' && youtubeApiKey) {
        await storeSecret(primaryRef, youtubeApiKey.trim(), 'YouTube Data API key used to discover the configured General COT live channel');
      }
      if (configProvider.code === 'agora' && agoraAppId && agoraAppCertificate) {
        await storeSecret(primaryRef, JSON.stringify({ appId: agoraAppId.trim(), appCertificate: agoraAppCertificate.trim() }), 'Agora RTC credentials used for secure Expression livestream tokens');
      }

      const currentConfiguration = configByProvider.get(configProvider.id)?.configuration ?? {};
      const configuration = configProvider.code === 'youtube'
        ? { ...currentConfiguration, routingScopes: ['general'], channelId: youtubeChannelId.trim(), includeUpcoming: true }
        : configProvider.code === 'agora'
          ? { ...currentConfiguration, routingScopes: ['expression'], tokenTtlSeconds: Number(currentConfiguration.tokenTtlSeconds ?? 3600), cohostAuthenticationEnabled: agoraCohostAuthEnabled, freeTierMonthlyParticipantMinutes: 10000, usageWarningPercent: Number(currentConfiguration.usageWarningPercent ?? 85) }
          : currentConfiguration;

      await api.request('platform-streaming', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'configure_global',
          providerId: configProvider.id,
          secretReference: primaryRef,
          webhookSecretReference: webhookRef,
          signingKeyReference: configProvider.code === 'mux' ? (signingRef || undefined) : undefined,
          configuration,
          isDefault: makeDefault,
          isActive: true,
        }),
      });
      clearSecretInputs();
      setSuccess(`${configProvider.name} configuration saved. Any credentials entered here were encrypted in Platform Vault.`);
      setConfigProvider(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save streaming provider configuration.');
    } finally {
      setActionBusy(false);
    }
  };

  const requestProviderStateChange = (provider: StreamingProvider) => {
    if (!canManage) return;
    setProviderStateTarget(provider);
    setProviderStateReason('');
    setError('');
  };

  const applyProviderStateChange = async () => {
    if (!canManage || !providerStateTarget) return;
    const nextActive = !providerStateTarget.is_active;
    if (!nextActive && !providerStateReason.trim()) {
      setError('A governance reason is required before disabling a streaming provider.');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      await api.request('platform-streaming', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'set_provider_active',
          providerId: providerStateTarget.id,
          isActive: nextActive,
          reason: nextActive ? undefined : providerStateReason.trim(),
        }),
      });
      setProviderStateTarget(null);
      setProviderStateReason('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change provider state.');
    } finally {
      setActionBusy(false);
    }
  };

  const terminateStream = async () => {
    if (!canManage || !selectedStreamToKill) return;
    if (!terminationReason.trim()) {
      setError('A safety or governance reason is required for emergency termination.');
      return;
    }
    setActionBusy(true);
    setError('');
    try {
      await api.request('platform-streaming', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'terminate_stream', streamId: selectedStreamToKill.id, reason: terminationReason.trim() }),
      });
      setSelectedStreamToKill(null);
      setTerminationReason('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Emergency termination failed.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-stats-grid">
        <StatWidget title="Active Live Broadcasts" value={liveCount} subtitle={`${data.streams.length} scheduled or active COT-managed broadcasts`} trend={{ value: liveCount > 0 ? 'LIVE NOW' : 'No internal live feeds', isPositive: true }} icon="LIVE" variant="live" />
        <StatWidget title="General COT live" value={generalConfig?.streaming_providers?.name ?? 'Not configured'} subtitle={generalConfig ? 'Public livestream source' : 'Assign a provider to the General route'} trend={{ value: generalConfig ? 'ROUTED' : 'ACTION REQUIRED', isPositive: Boolean(generalConfig) }} icon="VIDEO" variant="gold" />
        <StatWidget title="Expression live" value={expressionConfig?.streaming_providers?.name ?? 'Not configured'} subtitle={expressionConfig ? 'Private Expression livestream provider' : 'Assign a provider to the Expression route'} trend={{ value: expressionConfig ? 'ROUTED' : 'ACTION REQUIRED', isPositive: Boolean(expressionConfig) }} icon="RADIO" />
        <StatWidget title="Recent delivery health" value={webhookIssues === 0 ? 'Healthy' : `${webhookIssues} issue(s)`} subtitle={`${data.recentWebhooks.length} recent provider events reviewed`} trend={{ value: webhookIssues === 0 ? 'NO RECENT ERRORS' : 'REVIEW ACTIVITY', isPositive: webhookIssues === 0 }} icon="HOOKS" variant="success" />
      </div>

      {error && !providerStateTarget ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {success ? <div className="admin-status-message admin-status-success">{success}</div> : null}

      <Card title="Streaming services" subtitle="Set up approved streaming services and add protected credentials when needed." headerAction={<Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>}>
        <div className="admin-provider-grid">
          {data.providers.map((provider) => {
            const config = configByProvider.get(provider.id);
            return (
              <div key={provider.id} className="admin-provider-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div><h4 style={{ fontSize: 16, fontWeight: 900 }}>{provider.name}</h4><p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{provider.code} · connection {provider.adapter_version}</p></div>
                  <Badge label={provider.is_active ? 'ENABLED' : 'DISABLED'} variant={provider.is_active ? 'active' : 'suspended'} pulse={provider.is_active} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Global config: <strong style={{ color: config?.is_active ? 'var(--gold)' : 'var(--text-muted)' }}>{config?.is_active ? 'ACTIVE' : 'NOT CONFIGURED'}</strong>{config?.is_default ? ' · DEFAULT' : ''}
                  {routeLabel(config) ? <> · {routeLabel(config)}</> : null}
                </div>
                {config ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>Credential name: <code>{config.secret_reference}</code><br />Verification name: <code>{config.webhook_secret_reference}</code>{config.signing_key_reference ? <><br />Playback signing name: <code>{config.signing_key_reference}</code></> : null}</div> : null}
                <div className="admin-capability-tags">{provider.capabilities.map((capability) => <span key={capability} className="active">{capability}</span>)}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  {canManage ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openConfig(provider)}>{canManageSecrets ? 'Configure & credentials' : 'Configure'}</Button>
                      <Button variant={provider.is_active ? 'danger' : 'gold'} size="sm" disabled={actionBusy} onClick={() => requestProviderStateChange(provider)}>{provider.is_active ? 'Disable provider' : 'Enable provider'}</Button>
                    </>
                  ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Read only</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Live broadcast monitor" subtitle="Platform-wide active, scheduled, provisioning and failed streams across church organisations" headerAction={<Button variant="outline" size="md" onClick={() => void load()} loading={loading}>Refresh</Button>}>
        <Table
          columns={[
            { header: 'STREAM', accessor: (item) => <div><div style={{ fontWeight: 800 }}>{item.title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.organizations?.name ?? item.organization_id}</div></div> },
            { header: 'EXPRESSION', accessor: (item) => item.branches?.name ?? 'Organisation-wide' },
            { header: 'STATUS', accessor: (item) => <Badge label={item.status.toUpperCase()} variant={item.status === 'live' ? 'live' : item.status === 'failed' ? 'suspended' : item.status === 'scheduled' ? 'gold' : 'neutral'} pulse={item.status === 'live'} /> },
            { header: 'LATENCY', accessor: (item) => item.latency_mode ?? 'standard' },
            { header: 'EMERGENCY', accessor: (item) => canManage ? <Button variant="danger" size="sm" disabled={!['live', 'ready', 'provisioning'].includes(item.status)} onClick={() => { setSelectedStreamToKill(item); setTerminationReason(''); }}>Terminate</Button> : <span style={{ color: 'var(--text-muted)' }}>Read only</span> },
          ]}
          data={data.streams}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No active or scheduled streams across the ecosystem."
        />
      </Card>

      <Modal
        isOpen={canManage && !!configProvider}
        onClose={() => { if (!actionBusy) { setConfigProvider(null); clearSecretInputs(); } }}
        title={configProvider ? `Configure ${configProvider.name}` : 'Configure streaming provider'}
        subtitle="You may add real service credentials here. Values are encrypted and protected; only their credential names remain visible in administration."
        footer={<div style={{ display: 'flex', gap: 12 }}><Button variant="outline" size="md" disabled={actionBusy} onClick={() => { setConfigProvider(null); clearSecretInputs(); }}>Cancel</Button><Button variant="gold" size="md" loading={actionBusy} onClick={() => void saveConfig()}>{canManageSecrets ? 'Encrypt credentials & save' : 'Save configuration'}</Button></div>}
      >
        <InputField label="Streaming credential name" value={secretReference} onChange={(event) => setSecretReference(event.target.value.toUpperCase())} placeholder="STREAMING_PROVIDER_PRIMARY" helperText="Stable protected credential name used by COT. Leave provider secret fields blank to keep the saved value." />
        {configProvider?.code === 'mux' ? (
          <>
            <InputField label="Delivery verification credential name" value={webhookSecretReference} onChange={(event) => setWebhookSecretReference(event.target.value.toUpperCase())} placeholder="STREAMING_MUX_WEBHOOK_PRIMARY" />
            <InputField label="Playback signing credential name (optional)" value={signingKeyReference} onChange={(event) => setSigningKeyReference(event.target.value.toUpperCase())} placeholder="STREAMING_MUX_SIGNING_PRIMARY" />
          </>
        ) : null}

        {configProvider?.code === 'mux' ? (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <h4 style={{ marginBottom: 8 }}>Mux credentials</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Leave a field blank to keep the currently stored secret. Values are cleared from the form after a successful save.</p>
            <InputField label="Mux Token ID" type="password" value={muxTokenId} onChange={(event) => setMuxTokenId(event.target.value)} autoComplete="new-password" placeholder="Paste Token ID" />
            <InputField label="Mux Token Secret" type="password" value={muxTokenSecret} onChange={(event) => setMuxTokenSecret(event.target.value)} autoComplete="new-password" placeholder="Paste Token Secret" />
            <InputField label="Mux Webhook Signing Secret" type="password" value={muxWebhookSecret} onChange={(event) => setMuxWebhookSecret(event.target.value)} autoComplete="new-password" placeholder="Paste webhook secret" />
            <InputField label="Mux Playback Signing Key ID (optional)" type="password" value={muxSigningKeyId} onChange={(event) => setMuxSigningKeyId(event.target.value)} autoComplete="new-password" placeholder="Paste key ID" />
            <div className="admin-form-group">
              <label className="admin-form-label">Mux Playback Private Key PEM (optional)</label>
              <textarea className="admin-form-input admin-form-textarea" rows={6} value={muxSigningPrivateKey} onChange={(event) => setMuxSigningPrivateKey(event.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" autoComplete="off" spellCheck={false} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)' }} />
              <span className="admin-form-helper">Required only for signed/private playback. Stored encrypted with the key ID.</span>
            </div>
          </div>
        ) : configProvider?.code === 'youtube' ? (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <h4 style={{ marginBottom: 8 }}>General COT · YouTube Live</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>COT does not need the YouTube account password. It follows this public channel and embeds its active or upcoming livestream.</p>
            <InputField label="YouTube Channel ID" value={youtubeChannelId} onChange={(event) => setYoutubeChannelId(event.target.value.trim())} autoComplete="off" placeholder="UC…" helperText="Switch this later to the official COT channel without a code deployment." />
            <InputField label="YouTube Data API key" type="password" value={youtubeApiKey} onChange={(event) => setYoutubeApiKey(event.target.value)} autoComplete="new-password" placeholder="Paste API key" helperText="Leave blank to keep the API key already stored under the credential name above." />
            <div className="admin-info-callout">Routing: General COT only. YouTube remains the broadcaster; COT is the public viewer surface.</div>
          </div>
        ) : configProvider?.code === 'agora' ? (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <h4 style={{ marginBottom: 8 }}>Expression Live · Agora</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Agora is reserved for private Expression broadcasts. COT generates short-lived host and audience tokens server-side.</p>
            <InputField label="Agora App ID" type="password" value={agoraAppId} onChange={(event) => setAgoraAppId(event.target.value)} autoComplete="new-password" placeholder="Paste App ID" />
            <InputField label="Agora App Certificate" type="password" value={agoraAppCertificate} onChange={(event) => setAgoraAppCertificate(event.target.value)} autoComplete="new-password" placeholder="Paste App Certificate" helperText="The certificate is encrypted in Platform Vault and is never sent to the mobile app." />
            <label className="admin-inline-check">
              <input type="checkbox" checked={agoraCohostAuthEnabled} onChange={(event) => setAgoraCohostAuthEnabled(event.target.checked)} />
              <span>I enabled <strong>Co-host token authentication</strong> for this Agora project. COT will not enable Expression livestreaming until this is confirmed.</span>
            </label>
            <div className="admin-info-callout">Routing: Expressions only · token lifetime defaults to 60 minutes · free-tier warning target 85% of the configured monthly allowance.</div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Use Secure Credentials to save credentials for this service, then select the same credential names here.</p>
        )}

        <label className="admin-inline-check"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} /><span>Use this provider as a fallback default when no more specific streaming route is configured.</span></label>
      </Modal>

      <Modal
        isOpen={canManage && !!providerStateTarget}
        onClose={() => { if (!actionBusy) { setProviderStateTarget(null); setProviderStateReason(''); } }}
        title={providerStateTarget?.is_active ? 'Disable streaming provider' : 'Enable streaming provider'}
        subtitle={providerStateTarget?.name}
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setProviderStateTarget(null)}>Cancel</Button>
            <Button
              variant={providerStateTarget?.is_active ? 'danger' : 'gold'}
              size="md"
              loading={actionBusy}
              onClick={() => void applyProviderStateChange()}
            >
              {providerStateTarget?.is_active ? 'Disable provider' : 'Enable provider'}
            </Button>
          </>
        }
      >
        {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
        {providerStateTarget?.is_active ? (
          <InputField
            label="Governance reason"
            value={providerStateReason}
            onChange={(event) => setProviderStateReason(event.target.value)}
            placeholder="Provider incident, security issue, service restriction…"
            helperText="The provider-state change and reason are written to the platform audit trail."
          />
        ) : (
          <div className="admin-info-callout">Enabling this service makes it available for streaming again. The active streaming setup still determines whether it can carry production broadcasts.</div>
        )}
      </Modal>

      <Modal
        isOpen={canManage && !!selectedStreamToKill}
        onClose={() => { if (!actionBusy) setSelectedStreamToKill(null); }}
        title="Emergency Broadcast Termination"
        subtitle="This stops the live broadcast through the connected streaming service and then updates COT’s broadcast status."
        footer={<div style={{ display: 'flex', gap: 12 }}><Button variant="outline" size="md" disabled={actionBusy} onClick={() => setSelectedStreamToKill(null)}>Cancel</Button><Button variant="danger" size="md" loading={actionBusy} onClick={() => void terminateStream()}>Terminate provider feed</Button></div>}
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14, marginBottom: 14 }}>You are terminating <strong style={{ color: 'var(--text-primary)' }}>{selectedStreamToKill?.title}</strong>. The provider broadcast is stopped first; the platform record is marked ended only after the provider confirms the stop request.</p>
        <InputField label="Emergency governance reason" value={terminationReason} onChange={(event) => setTerminationReason(event.target.value)} placeholder="Policy violation, compromised ingest credential, safety incident..." helperText="This reason is written to the Level-1 audit trail." />
      </Modal>
    </div>
  );
}

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

export function StreamingInfrastructure({ api }: { api: ApiClient }) {
  const [data, setData] = useState<StreamingPayload>({ providers: [], globalConfigs: [], streams: [], recentWebhooks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedStreamToKill, setSelectedStreamToKill] = useState<ActiveStream | null>(null);
  const [terminationReason, setTerminationReason] = useState('');
  const [configProvider, setConfigProvider] = useState<StreamingProvider | null>(null);
  const [secretReference, setSecretReference] = useState('');
  const [webhookSecretReference, setWebhookSecretReference] = useState('');
  const [signingKeyReference, setSigningKeyReference] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

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

  useEffect(() => {
    void load();
  }, [api]);

  const liveCount = data.streams.filter((stream) => stream.status === 'live').length;
  const primaryConfig = data.globalConfigs.find((config) => config.is_default && config.is_active);
  const webhookIssues = data.recentWebhooks.filter((event) => !event.signature_valid || Boolean(event.processing_error)).length;

  const configByProvider = useMemo(
    () => new Map(data.globalConfigs.map((config) => [config.provider_id, config])),
    [data.globalConfigs]
  );

  const openConfig = (provider: StreamingProvider) => {
    const config = configByProvider.get(provider.id);
    setConfigProvider(provider);
    setSecretReference(config?.secret_reference ?? '');
    setWebhookSecretReference(config?.webhook_secret_reference ?? '');
    setSigningKeyReference(config?.signing_key_reference ?? '');
    setMakeDefault(Boolean(config?.is_default));
  };

  const saveConfig = async () => {
    if (!configProvider) return;
    if (!secretReference.trim() || !webhookSecretReference.trim()) {
      setError('Provider and webhook secret references are required. Enter secret names, not secret values.');
      return;
    }
    setActionBusy(true);
    setError('');
    try {
      await api.request('platform-streaming', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'configure_global',
          providerId: configProvider.id,
          secretReference: secretReference.trim(),
          webhookSecretReference: webhookSecretReference.trim(),
          signingKeyReference: signingKeyReference.trim() || undefined,
          configuration: configByProvider.get(configProvider.id)?.configuration ?? {},
          isDefault: makeDefault,
          isActive: true,
        }),
      });
      setConfigProvider(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save streaming provider configuration.');
    } finally {
      setActionBusy(false);
    }
  };

  const toggleProvider = async (provider: StreamingProvider) => {
    const nextActive = !provider.is_active;
    const reason = nextActive ? undefined : window.prompt('Governance reason for disabling this provider:')?.trim();
    if (!nextActive && !reason) return;
    setActionBusy(true);
    setError('');
    try {
      await api.request('platform-streaming', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'set_provider_active', providerId: provider.id, isActive: nextActive, reason }),
      });
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change provider state.');
    } finally {
      setActionBusy(false);
    }
  };

  const terminateStream = async () => {
    if (!selectedStreamToKill) return;
    if (!terminationReason.trim()) {
      setError('A safety or governance reason is required for emergency termination.');
      return;
    }
    setActionBusy(true);
    setError('');
    try {
      await api.request('platform-streaming', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'terminate_stream',
          streamId: selectedStreamToKill.id,
          reason: terminationReason.trim(),
        }),
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
    <div>
      <div className="admin-stats-grid">
        <StatWidget
          title="Active Live Broadcasts"
          value={liveCount}
          subtitle={`${data.streams.length} active/scheduled control-plane records`}
          trend={{ value: liveCount > 0 ? 'LIVE NOW' : 'No live feeds', isPositive: true }}
          icon="📡"
          variant="live"
        />
        <StatWidget
          title="Primary Video Provider"
          value={primaryConfig?.streaming_providers?.name ?? 'Not configured'}
          subtitle={primaryConfig ? `Secret ref: ${primaryConfig.secret_reference}` : 'Set a global default provider'}
          trend={{ value: primaryConfig ? 'ACTIVE' : 'ACTION REQUIRED', isPositive: Boolean(primaryConfig) }}
          icon="⚡"
          variant="gold"
        />
        <StatWidget
          title="Recent Webhook Health"
          value={webhookIssues === 0 ? 'Healthy' : `${webhookIssues} issue(s)`}
          subtitle={`${data.recentWebhooks.length} recent delivery events inspected`}
          trend={{ value: webhookIssues === 0 ? 'NO RECENT ERRORS' : 'REVIEW EVENTS', isPositive: webhookIssues === 0 }}
          icon="🛡"
          variant="success"
        />
      </div>

      {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 20 }}>{error}</div> : null}

      <Card
        title="Live Stream Provider Registry"
        subtitle="Installed provider adapters and global secret references. Secret values never pass through this dashboard."
        headerAction={<Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {data.providers.map((provider) => {
            const config = configByProvider.get(provider.id);
            return (
              <div
                key={provider.id}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 900 }}>{provider.name}</h4>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{provider.code} · adapter {provider.adapter_version}</p>
                  </div>
                  <Badge label={provider.is_active ? 'ENABLED' : 'DISABLED'} variant={provider.is_active ? 'active' : 'suspended'} pulse={provider.is_active} />
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Global config: <strong style={{ color: config?.is_active ? 'var(--gold)' : 'var(--text-muted)' }}>{config?.is_active ? 'ACTIVE' : 'NOT CONFIGURED'}</strong>
                  {config?.is_default ? ' · DEFAULT' : ''}
                </div>

                {config ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                    Credential ref: <code>{config.secret_reference}</code><br />
                    Webhook ref: <code>{config.webhook_secret_reference}</code>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {provider.capabilities.map((capability) => (
                    <span key={capability} style={{ fontSize: 10, fontWeight: 800, backgroundColor: 'var(--bg-card)', padding: '3px 8px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)' }}>
                      {capability}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  <Button variant="outline" size="sm" onClick={() => openConfig(provider)}>Configure</Button>
                  <Button variant={provider.is_active ? 'danger' : 'gold'} size="sm" disabled={actionBusy} onClick={() => void toggleProvider(provider)}>
                    {provider.is_active ? 'Disable provider' : 'Enable provider'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Live Broadcast Monitor & Emergency Controls"
        subtitle="Platform-wide active, scheduled, provisioning and failed streams across church organisations"
        headerAction={<Button variant="outline" size="md" onClick={() => void load()} loading={loading}>Refresh Streams</Button>}
      >
        <Table
          columns={[
            {
              header: 'STREAM',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.organizations?.name ?? item.organization_id}</div>
                </div>
              ),
            },
            {
              header: 'EXPRESSION',
              accessor: (item) => item.branches?.name ?? 'Organisation-wide',
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge
                  label={item.status.toUpperCase()}
                  variant={item.status === 'live' ? 'live' : item.status === 'failed' ? 'suspended' : item.status === 'scheduled' ? 'gold' : 'neutral'}
                  pulse={item.status === 'live'}
                />
              ),
            },
            { header: 'LATENCY', accessor: (item) => item.latency_mode ?? 'standard' },
            {
              header: 'EMERGENCY',
              accessor: (item) => (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!['live', 'ready', 'provisioning'].includes(item.status)}
                  onClick={() => {
                    setSelectedStreamToKill(item);
                    setTerminationReason('');
                  }}
                >
                  Terminate
                </Button>
              ),
            },
          ]}
          data={data.streams}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No active or scheduled streams across the ecosystem."
        />
      </Card>

      <Modal
        isOpen={!!configProvider}
        onClose={() => {
          if (!actionBusy) setConfigProvider(null);
        }}
        title={configProvider ? `Configure ${configProvider.name}` : 'Configure streaming provider'}
        subtitle="Store only environment/Vault reference names here. Actual credentials remain in Supabase secrets."
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setConfigProvider(null)}>Cancel</Button>
            <Button variant="gold" size="md" loading={actionBusy} onClick={() => void saveConfig()}>Save global config</Button>
          </div>
        }
      >
        <InputField label="Provider credential secret reference" value={secretReference} onChange={(event) => setSecretReference(event.target.value.toUpperCase())} placeholder="MUX_API_CREDENTIALS" />
        <InputField label="Webhook secret reference" value={webhookSecretReference} onChange={(event) => setWebhookSecretReference(event.target.value.toUpperCase())} placeholder="MUX_WEBHOOK_SECRET" />
        <InputField label="Playback signing key reference (optional)" value={signingKeyReference} onChange={(event) => setSigningKeyReference(event.target.value.toUpperCase())} placeholder="MUX_SIGNING_KEY" />
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />
          Use this provider as the global default for organisations without an override.
        </label>
      </Modal>

      <Modal
        isOpen={!!selectedStreamToKill}
        onClose={() => {
          if (!actionBusy) setSelectedStreamToKill(null);
        }}
        title="Emergency Broadcast Termination"
        subtitle="This performs a real provider stop through the configured adapter and then finalizes platform state."
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setSelectedStreamToKill(null)}>Cancel</Button>
            <Button variant="danger" size="md" loading={actionBusy} onClick={() => void terminateStream()}>Terminate provider feed</Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14, marginBottom: 14 }}>
          You are terminating <strong style={{ color: 'var(--text-primary)' }}>{selectedStreamToKill?.title}</strong>. The provider broadcast is stopped first; the platform record is marked ended only after the provider confirms the stop request.
        </p>
        <InputField
          label="Emergency governance reason"
          value={terminationReason}
          onChange={(event) => setTerminationReason(event.target.value)}
          placeholder="Policy violation, compromised ingest credential, safety incident..."
          helperText="This reason is written to the Level-1 audit trail."
        />
      </Modal>
    </div>
  );
}

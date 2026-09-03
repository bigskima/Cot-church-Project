import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, Table } from '../components/ui';

type ProviderStatus = 'active' | 'disabled' | 'degraded';

type PaymentConfig = {
  id: string;
  organization_id: string | null;
  provider_id: string;
  environment: 'production' | 'sandbox';
  secret_reference: string;
  webhook_secret_reference: string;
  is_default: boolean;
  is_active: boolean;
  configuration?: Record<string, unknown>;
};

type PaymentProvider = {
  id: string;
  code: string;
  name: string;
  adapter_version: string;
  status: ProviderStatus;
  capabilities: string[];
  supported_currencies: string[];
  configured: boolean;
  activeConfigurationCount: number;
  configurations: PaymentConfig[];
};

type PaymentRoute = {
  id: string;
  organization_id: string | null;
  currency: string;
  payment_method: string;
  priority: number;
  is_active: boolean;
  payment_providers?: { code?: string; name?: string; status?: string } | null;
};

type PaymentAttempt = {
  id: string;
  provider: string;
  amount_minor: number;
  currency: string;
  status: string;
  failure_code?: string | null;
  created_at: string;
  organizations?: { name?: string } | null;
};

type PaymentPayload = {
  generatedAt: string;
  summary: {
    attempts24h: number;
    succeeded24h: number;
    failed24h: number;
    processing24h: number;
    pendingEvents: number;
    invalidSignatureEvents: number;
    activeConfigs: number;
    activeRoutes: number;
    reconciliation24h: number;
    refundPending: number;
    refundFailed: number;
  };
  providers: PaymentProvider[];
  routes: PaymentRoute[];
  recentAttempts: PaymentAttempt[];
};

const emptyPayload: PaymentPayload = {
  generatedAt: '',
  summary: {
    attempts24h: 0,
    succeeded24h: 0,
    failed24h: 0,
    processing24h: 0,
    pendingEvents: 0,
    invalidSignatureEvents: 0,
    activeConfigs: 0,
    activeRoutes: 0,
    reconciliation24h: 0,
    refundPending: 0,
    refundFailed: 0,
  },
  providers: [],
  routes: [],
  recentAttempts: [],
};

const defaultReferences: Record<string, { primary: string; webhook: string }> = {
  paystack: { primary: 'PAYMENT_PAYSTACK_PRIMARY', webhook: 'PAYMENT_PAYSTACK_WEBHOOK' },
  stripe: { primary: 'PAYMENT_STRIPE_PRIMARY', webhook: 'PAYMENT_STRIPE_WEBHOOK' },
};

function money(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amountMinor || 0) / 100);
  } catch {
    return `${currency} ${(Number(amountMinor || 0) / 100).toFixed(2)}`;
  }
}

export function PaymentInfrastructure({ api }: { api: ApiClient }) {
  const [data, setData] = useState<PaymentPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');
  const [secretReference, setSecretReference] = useState('');
  const [webhookReference, setWebhookReference] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [webhookValue, setWebhookValue] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.request<PaymentPayload>('platform-payments'));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load payment infrastructure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [api]);

  const preparedConfigs = useMemo(
    () => data.providers.reduce((total, item) => total + item.configurations.length, 0),
    [data.providers],
  );

  const openConfiguration = (item: PaymentProvider) => {
    const existing = item.configurations.find((config) => config.organization_id === null && config.environment === 'production')
      ?? item.configurations.find((config) => config.organization_id === null);
    const defaults = defaultReferences[item.code] ?? {
      primary: `PAYMENT_${item.code.toUpperCase()}_PRIMARY`,
      webhook: `PAYMENT_${item.code.toUpperCase()}_WEBHOOK`,
    };
    setProvider(item);
    setEnvironment(existing?.environment ?? 'production');
    setSecretReference(existing?.secret_reference ?? defaults.primary);
    setWebhookReference(existing?.webhook_secret_reference ?? defaults.webhook);
    setSecretValue('');
    setWebhookValue('');
    setShowSecrets(false);
    setError('');
    setMessage('');
  };

  const storeSecret = async (reference: string, value: string, description: string) => {
    if (!value.trim()) return;
    await api.request('platform-secrets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'store',
        reference,
        category: 'payment',
        provider: provider?.code ?? 'payment',
        description,
        value,
      }),
    });
  };

  const savePreparation = async () => {
    if (!provider || !secretReference.trim() || !webhookReference.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await storeSecret(secretReference.trim().toUpperCase(), secretValue, `${provider.name} provider credential`);
      await storeSecret(webhookReference.trim().toUpperCase(), webhookValue, `${provider.name} webhook verification secret`);

      await api.request('platform-payments', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'upsert_provider_config',
          providerId: provider.id,
          organizationId: null,
          environment,
          secretReference: secretReference.trim().toUpperCase(),
          webhookSecretReference: webhookReference.trim().toUpperCase(),
          configuration: provider.configurations.find((config) => config.organization_id === null)?.configuration ?? {},
          isDefault: false,
          isActive: false,
          reason: 'Prepared for future provider onboarding; online payments remain release-locked.',
        }),
      });

      setSecretValue('');
      setWebhookValue('');
      setProvider(null);
      setMessage(`${provider.name} credentials/configuration prepared. Online payment remains unavailable.`);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to prepare payment provider configuration.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Card
        title="Payment Infrastructure — Future Online Rails"
        subtitle="Manual bank transfer is the active production giving method. Online provider adapters remain installed but release-locked until provider onboarding and production verification are approved."
        headerAction={<Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <div className="admin-stat-card"><div className="admin-stat-title">Release State</div><div className="admin-stat-value">Unavailable</div><div className="admin-stat-subtitle">Manual transfer only</div></div>
          <div className="admin-stat-card"><div className="admin-stat-title">Provider Adapters</div><div className="admin-stat-value">{data.providers.length}</div><div className="admin-stat-subtitle">Future infrastructure</div></div>
          <div className="admin-stat-card"><div className="admin-stat-title">Prepared Configs</div><div className="admin-stat-value">{preparedConfigs}</div><div className="admin-stat-subtitle">Stored inactive</div></div>
          <div className="admin-stat-card"><div className="admin-stat-title">Active Routes</div><div className="admin-stat-value">{data.summary.activeRoutes}</div><div className="admin-stat-subtitle">Must remain 0</div></div>
        </div>
      </Card>

      {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 18 }}>{error}</div> : null}
      {message ? <div style={{ marginBottom: 18, color: 'var(--success)', fontWeight: 700 }}>{message}</div> : null}

      <Card
        title="Provider Preparation"
        subtitle="You may safely store credentials now. They are encrypted in Supabase Vault and are never displayed back to the browser. Saving credentials does not enable online giving."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {data.providers.map((item) => {
            const globalConfig = item.configurations.find((config) => config.organization_id === null);
            return (
              <div key={item.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16 }}>{item.name}</h4>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{item.code} · adapter {item.adapter_version}</div>
                  </div>
                  <Badge label="FUTURE / OFF" variant="neutral" />
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                  {globalConfig ? `Credential reference prepared: ${globalConfig.secret_reference}` : 'No global provider configuration has been prepared yet.'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {(item.capabilities ?? []).map((capability) => <span key={capability} style={{ fontSize: 10, border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '3px 7px' }}>{capability}</span>)}
                </div>
                <Button variant="outline" size="sm" onClick={() => openConfiguration(item)}>Prepare credentials</Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Routing Registry"
        subtitle="Read-only while online giving is release-locked. No route may be active in the current production release."
      >
        <Table
          columns={[
            { header: 'CURRENCY', accessor: (item) => item.currency },
            { header: 'METHOD', accessor: (item) => item.payment_method },
            { header: 'PROVIDER', accessor: (item) => item.payment_providers?.name ?? '—' },
            { header: 'PRIORITY', accessor: (item) => item.priority },
            { header: 'STATE', accessor: (item) => <Badge label={item.is_active ? 'BLOCKED ACTIVE' : 'INACTIVE'} variant={item.is_active ? 'warning' : 'neutral'} /> },
          ]}
          data={data.routes}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No future online-payment routing rules are configured."
        />
      </Card>

      <Card title="Payment Attempt Ledger" subtitle="Historical/provider attempt telemetry remains available for audit and future rollout verification.">
        <Table
          columns={[
            { header: 'PROVIDER', accessor: (item) => item.provider },
            { header: 'CHURCH', accessor: (item) => item.organizations?.name ?? '—' },
            { header: 'AMOUNT', accessor: (item) => money(item.amount_minor, item.currency) },
            { header: 'STATUS', accessor: (item) => <Badge label={item.status.toUpperCase()} variant={item.status === 'succeeded' ? 'active' : item.status === 'failed' ? 'suspended' : 'neutral'} /> },
            { header: 'CREATED', accessor: (item) => new Date(item.created_at).toLocaleString() },
          ]}
          data={data.recentAttempts}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No online payment attempts exist."
        />
      </Card>

      <Modal
        isOpen={!!provider}
        onClose={() => { if (!busy) setProvider(null); }}
        title={provider ? `Prepare ${provider.name}` : 'Prepare payment provider'}
        subtitle="Credentials are written to Supabase Vault over the authenticated Platform Admin API. The provider remains inactive after saving."
        footer={<div style={{ display: 'flex', gap: 10 }}><Button variant="outline" disabled={busy} onClick={() => setProvider(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void savePreparation()}>Save preparation</Button></div>}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <label className="admin-form-group">
            <span className="admin-form-label">Environment</span>
            <select className="admin-form-select" value={environment} onChange={(event) => setEnvironment(event.target.value as 'production' | 'sandbox')}>
              <option value="production">Production</option>
              <option value="sandbox">Sandbox / test</option>
            </select>
          </label>
          <InputField label="Provider secret reference" value={secretReference} onChange={(event) => setSecretReference(event.target.value.toUpperCase())} helperText="Stable reference only; the raw key is stored in Vault." />
          <InputField label="Provider API secret / key" type={showSecrets ? 'text' : 'password'} value={secretValue} onChange={(event) => setSecretValue(event.target.value)} placeholder="Leave blank to keep the existing secret" autoComplete="new-password" />
          <InputField label="Webhook secret reference" value={webhookReference} onChange={(event) => setWebhookReference(event.target.value.toUpperCase())} />
          <InputField label="Webhook verification secret" type={showSecrets ? 'text' : 'password'} value={webhookValue} onChange={(event) => setWebhookValue(event.target.value)} placeholder="Leave blank to keep the existing secret" autoComplete="new-password" />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 12 }}><input type="checkbox" checked={showSecrets} onChange={(event) => setShowSecrets(event.target.checked)} />Show values while entering them on this device</label>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
            Saving here does <strong>not</strong> enable online payment. Manual transfer remains the production giving method until a future provider rollout is explicitly released.
          </div>
        </div>
      </Modal>
    </div>
  );
}

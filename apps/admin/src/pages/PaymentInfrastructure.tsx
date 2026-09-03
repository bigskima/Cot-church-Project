import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import {
  Badge,
  Button,
  Card,
  InputField,
  Modal,
  SelectField,
  StatWidget,
  Table,
  Toggle,
} from '../components/ui';

type ProviderStatus = 'active' | 'disabled' | 'degraded';

interface ProviderConfiguration {
  id: string;
  organization_id: string | null;
  provider_id: string;
  environment: 'production' | 'sandbox';
  secret_reference: string;
  webhook_secret_reference: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organizations?: { id: string; name: string; slug: string } | null;
}

interface PaymentProvider {
  id: string;
  code: string;
  name: string;
  adapter_version: string;
  status: ProviderStatus;
  capabilities: string[];
  supported_currencies: string[];
  configured: boolean;
  activeConfigurationCount: number;
  configurations: ProviderConfiguration[];
  created_at: string;
  updated_at: string;
}

interface PaymentRoute {
  id: string;
  organization_id: string | null;
  currency: string;
  payment_method: string;
  provider_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organizations?: { id: string; name: string; slug: string } | null;
  payment_providers?: { id: string; code: string; name: string; status: ProviderStatus } | null;
}

interface PaymentAttempt {
  id: string;
  organization_id: string;
  donation_id: string;
  provider: string;
  provider_payment_id?: string | null;
  amount_minor: number;
  currency: string;
  status: string;
  failure_code?: string | null;
  failure_message?: string | null;
  created_at: string;
  updated_at: string;
  organizations?: { id: string; name: string; slug: string } | null;
}

interface PaymentEvent {
  id: number;
  provider: string;
  provider_event_id: string;
  event_type: string;
  signature_verified: boolean;
  processing_error?: string | null;
  processed_at?: string | null;
  received_at: string;
}

interface ReconciliationEntry {
  id: number;
  organization_id: string;
  provider: string;
  settlement_reference: string;
  gross_amount_minor: number;
  fee_amount_minor: number;
  net_amount_minor: number;
  currency: string;
  settled_at: string;
  created_at: string;
  organizations?: { id: string; name: string; slug: string } | null;
}

interface PaymentInfrastructurePayload {
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
  recentEvents: PaymentEvent[];
  recentReconciliations: ReconciliationEntry[];
}

function providerBadgeVariant(status: ProviderStatus) {
  if (status === 'active') return 'active' as const;
  if (status === 'degraded') return 'warning' as const;
  return 'neutral' as const;
}

function attemptBadgeVariant(status: string) {
  if (status === 'succeeded') return 'healthy' as const;
  if (status === 'failed' || status === 'cancelled') return 'suspended' as const;
  if (status === 'processing' || status === 'requires_action') return 'warning' as const;
  return 'neutral' as const;
}

function minorUnits(value: number, currency: string) {
  return `${Number(value).toLocaleString()} ${currency} minor units`;
}

export function PaymentInfrastructure({ api }: { api: ApiClient }) {
  const [data, setData] = useState<PaymentInfrastructurePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [configProvider, setConfigProvider] = useState<PaymentProvider | null>(null);
  const [configEnvironment, setConfigEnvironment] = useState<'production' | 'sandbox'>('production');
  const [secretReference, setSecretReference] = useState('');
  const [webhookSecretReference, setWebhookSecretReference] = useState('');
  const [configActive, setConfigActive] = useState(false);
  const [configDefault, setConfigDefault] = useState(false);
  const [configReason, setConfigReason] = useState('');

  const [statusProvider, setStatusProvider] = useState<PaymentProvider | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeCurrency, setRouteCurrency] = useState('NGN');
  const [routeMethod, setRouteMethod] = useState('cards');
  const [routeProviderId, setRouteProviderId] = useState('');
  const [routePriority, setRoutePriority] = useState('100');
  const [routeReason, setRouteReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.request<PaymentInfrastructurePayload>('platform-payments'));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load payment infrastructure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [api]);

  const activeProviders = useMemo(
    () => data?.providers.filter((provider) => provider.status === 'active') ?? [],
    [data?.providers],
  );

  const openConfig = (provider: PaymentProvider) => {
    const existing =
      provider.configurations.find(
        (config) => config.organization_id === null && config.environment === 'production',
      ) ?? provider.configurations.find((config) => config.organization_id === null);
    setConfigProvider(provider);
    setConfigEnvironment(existing?.environment ?? 'production');
    setSecretReference(existing?.secret_reference ?? '');
    setWebhookSecretReference(existing?.webhook_secret_reference ?? '');
    setConfigActive(existing?.is_active ?? false);
    setConfigDefault(existing?.is_default ?? false);
    setConfigReason('');
    setError('');
  };

  const saveConfig = async () => {
    if (!configProvider) return;
    if (!secretReference.trim() || !webhookSecretReference.trim() || !configReason.trim()) {
      setError('Secret reference names and a governance reason are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.request('platform-payments', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'upsert_provider_config',
          providerId: configProvider.id,
          organizationId: null,
          environment: configEnvironment,
          secretReference: secretReference.trim(),
          webhookSecretReference: webhookSecretReference.trim(),
          configuration: {},
          isDefault: configDefault,
          isActive: configActive,
          reason: configReason.trim(),
        }),
      });
      setConfigProvider(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save provider configuration.');
    } finally {
      setBusy(false);
    }
  };

  const changeProviderStatus = async () => {
    if (!statusProvider || !statusReason.trim()) {
      setError('A governance reason is required for payment provider lifecycle changes.');
      return;
    }
    const targetStatus: ProviderStatus = statusProvider.status === 'active' ? 'disabled' : 'active';
    setBusy(true);
    setError('');
    try {
      await api.request('platform-payments', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'set_provider_status',
          providerId: statusProvider.id,
          status: targetStatus,
          reason: statusReason.trim(),
        }),
      });
      setStatusProvider(null);
      setStatusReason('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change provider status.');
    } finally {
      setBusy(false);
    }
  };

  const createRoute = async () => {
    if (!routeProviderId || !routeReason.trim()) {
      setError('Choose an active provider and provide a governance reason.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.request('platform-payments', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'upsert_route',
          organizationId: null,
          currency: routeCurrency.trim().toUpperCase(),
          paymentMethod: routeMethod.trim().toLowerCase(),
          providerId: routeProviderId,
          priority: Number(routePriority),
          isActive: true,
          reason: routeReason.trim(),
        }),
      });
      setShowRouteModal(false);
      setRouteReason('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save payment route.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-stats-grid">
        <StatWidget
          title="Payment Attempts · 24h"
          value={data?.summary.attempts24h ?? 0}
          subtitle={`${data?.summary.succeeded24h ?? 0} succeeded · ${data?.summary.failed24h ?? 0} failed`}
          icon="💳"
          variant="gold"
        />
        <StatWidget
          title="Webhook Queue"
          value={data?.summary.pendingEvents ?? 0}
          subtitle={`${data?.summary.invalidSignatureEvents ?? 0} stored events with invalid signature state`}
          icon="🛡"
          variant={data?.summary.invalidSignatureEvents ? 'live' : 'success'}
        />
        <StatWidget
          title="Active Provider Configs"
          value={data?.summary.activeConfigs ?? 0}
          subtitle={`${data?.summary.activeRoutes ?? 0} active routing rules`}
          icon="⚙️"
        />
        <StatWidget
          title="Reconciliations · 24h"
          value={data?.summary.reconciliation24h ?? 0}
          subtitle={`${data?.summary.refundPending ?? 0} refunds pending · ${data?.summary.refundFailed ?? 0} failed`}
          icon="⚖️"
        />
      </div>

      {error ? (
        <div className="admin-form-error" role="alert" style={{ marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      <Card
        title="Payment Provider Control Plane"
        subtitle="Real provider registry and server-side credential references. Provider status is never inferred from frontend configuration."
        headerAction={
          <Button variant="outline" size="sm" loading={loading} onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        {loading && !data ? (
          <div className="admin-table-loading">
            <span className="admin-spinner" />
            <p>Loading payment infrastructure…</p>
          </div>
        ) : data?.providers.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
              gap: 16,
            }}
          >
            {data.providers.map((provider) => (
              <div
                key={provider.id}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 900 }}>{provider.name}</h4>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {provider.code} · adapter {provider.adapter_version}
                    </div>
                  </div>
                  <Badge
                    label={provider.status.toUpperCase()}
                    variant={providerBadgeVariant(provider.status)}
                    pulse={provider.status === 'active'}
                  />
                </div>

                <div style={{ display: 'grid', gap: 7, fontSize: 12, marginBottom: 14 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Configuration: </span>
                    <strong>{provider.configured ? 'Reference stored' : 'Not configured'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Active configurations: </span>
                    <strong>{provider.activeConfigurationCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Registered currencies: </span>
                    <strong>
                      {provider.supported_currencies.length
                        ? provider.supported_currencies.join(', ')
                        : 'Not declared'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {provider.capabilities.length ? (
                    provider.capabilities.map((capability) => (
                      <span
                        key={capability}
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          backgroundColor: 'var(--bg-card)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {capability}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      No adapter capabilities declared.
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => openConfig(provider)}>
                    Configure References
                  </Button>
                  <Button
                    variant={provider.status === 'active' ? 'danger' : 'gold'}
                    size="sm"
                    onClick={() => {
                      setStatusProvider(provider);
                      setStatusReason('');
                      setError('');
                    }}
                  >
                    {provider.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-table-empty">
            <p>No payment provider adapters are registered.</p>
          </div>
        )}
      </Card>

      <Card
        title="Database-Driven Payment Routing"
        subtitle="Global routes shown here are authoritative backend configuration. Active routes can only target active providers."
        headerAction={
          <Button
            variant="gold"
            size="sm"
            disabled={activeProviders.length === 0}
            title={activeProviders.length === 0 ? 'Activate a configured payment provider first' : undefined}
            onClick={() => {
              setRouteProviderId(activeProviders[0]?.id ?? '');
              setRouteReason('');
              setShowRouteModal(true);
              setError('');
            }}
          >
            Add Global Route
          </Button>
        }
      >
        <Table<PaymentRoute>
          columns={[
            {
              header: 'SCOPE',
              accessor: (item) => item.organizations?.name ?? 'Platform default',
            },
            { header: 'CURRENCY', accessor: 'currency' },
            {
              header: 'PAYMENT METHOD',
              accessor: (item) => item.payment_method.replace(/_/g, ' '),
            },
            {
              header: 'PROVIDER',
              accessor: (item) => item.payment_providers?.name ?? item.provider_id,
            },
            { header: 'PRIORITY', accessor: 'priority' },
            {
              header: 'STATE',
              accessor: (item) => (
                <Badge
                  label={item.is_active ? 'ACTIVE' : 'DISABLED'}
                  variant={item.is_active ? 'active' : 'neutral'}
                />
              ),
            },
          ]}
          data={data?.routes ?? []}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No payment routing rules are configured yet."
        />
      </Card>

      <Card
        title="Recent Payment Attempts"
        subtitle="Server-side payment attempt state. Client checkout callbacks are not treated as proof of payment."
      >
        <Table<PaymentAttempt>
          columns={[
            {
              header: 'CHURCH',
              accessor: (item) => item.organizations?.name ?? item.organization_id,
            },
            {
              header: 'PROVIDER',
              accessor: (item) => <strong>{item.provider}</strong>,
            },
            {
              header: 'AMOUNT',
              accessor: (item) => minorUnits(item.amount_minor, item.currency),
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge label={item.status.toUpperCase()} variant={attemptBadgeVariant(item.status)} />
              ),
            },
            {
              header: 'CREATED',
              accessor: (item) => new Date(item.created_at).toLocaleString(),
            },
            {
              header: 'PROVIDER REFERENCE',
              accessor: (item) => item.provider_payment_id || 'Pending / unavailable',
            },
          ]}
          data={data?.recentAttempts ?? []}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No payment attempts have been recorded."
        />
      </Card>

      <Card
        title="Provider Webhook Ledger"
        subtitle="Recent provider events with stored signature-verification and processing state."
      >
        <Table<PaymentEvent>
          columns={[
            { header: 'PROVIDER', accessor: 'provider' },
            { header: 'EVENT', accessor: 'event_type' },
            {
              header: 'SIGNATURE',
              accessor: (item) => (
                <Badge
                  label={item.signature_verified ? 'VERIFIED' : 'UNVERIFIED'}
                  variant={item.signature_verified ? 'healthy' : 'suspended'}
                />
              ),
            },
            {
              header: 'PROCESSING',
              accessor: (item) => (
                <Badge
                  label={item.processing_error ? 'ERROR' : item.processed_at ? 'PROCESSED' : 'PENDING'}
                  variant={item.processing_error ? 'suspended' : item.processed_at ? 'healthy' : 'warning'}
                />
              ),
            },
            {
              header: 'RECEIVED',
              accessor: (item) => new Date(item.received_at).toLocaleString(),
            },
          ]}
          data={data?.recentEvents ?? []}
          keyExtractor={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No payment provider webhook events have been received."
        />
      </Card>

      <Card
        title="Recent Reconciliation Entries"
        subtitle="Settlement records stored by the finance reconciliation domain."
      >
        <Table<ReconciliationEntry>
          columns={[
            {
              header: 'CHURCH',
              accessor: (item) => item.organizations?.name ?? item.organization_id,
            },
            { header: 'PROVIDER', accessor: 'provider' },
            { header: 'SETTLEMENT', accessor: 'settlement_reference' },
            {
              header: 'GROSS',
              accessor: (item) => minorUnits(item.gross_amount_minor, item.currency),
            },
            {
              header: 'FEES',
              accessor: (item) => minorUnits(item.fee_amount_minor, item.currency),
            },
            {
              header: 'NET',
              accessor: (item) => minorUnits(item.net_amount_minor, item.currency),
            },
            {
              header: 'SETTLED',
              accessor: (item) => new Date(item.settled_at).toLocaleString(),
            },
          ]}
          data={data?.recentReconciliations ?? []}
          keyExtractor={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No settlement reconciliation entries have been recorded."
        />
      </Card>

      <Modal
        isOpen={!!configProvider}
        onClose={() => {
          if (!busy) setConfigProvider(null);
        }}
        title={configProvider ? `Configure ${configProvider.name}` : 'Configure payment provider'}
        subtitle="Only secret reference names are stored in PostgreSQL. Raw credentials stay in the trusted runtime secret store."
        maxWidth="lg"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setConfigProvider(null)}>
              Cancel
            </Button>
            <Button variant="gold" size="md" loading={busy} onClick={() => void saveConfig()}>
              Save Configuration
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <SelectField
            label="Environment"
            value={configEnvironment}
            onChange={(event) => setConfigEnvironment(event.target.value as 'production' | 'sandbox')}
            options={[
              { label: 'Production', value: 'production' },
              { label: 'Sandbox', value: 'sandbox' },
            ]}
          />
          <InputField
            label="API Secret Reference"
            value={secretReference}
            onChange={(event) => setSecretReference(event.target.value.toUpperCase())}
            placeholder="PAYMENT_PROVIDER_SECRET_KEY"
            helperText="Enter the environment/Vault variable name, never the API key itself."
          />
          <InputField
            label="Webhook Secret Reference"
            value={webhookSecretReference}
            onChange={(event) => setWebhookSecretReference(event.target.value.toUpperCase())}
            placeholder="PAYMENT_PROVIDER_WEBHOOK_SECRET"
            helperText="The corresponding secret must exist in the Supabase Edge Function runtime before the provider can be enabled."
          />
          <Toggle
            label="Configuration active"
            checked={configActive}
            onChange={setConfigActive}
            description="Marks this reference set as eligible for runtime provider activation."
          />
          <Toggle
            label="Default configuration"
            checked={configDefault}
            onChange={setConfigDefault}
            description="Use this platform-wide configuration as the default for this environment."
          />
          <InputField
            label="Governance reason"
            value={configReason}
            onChange={(event) => setConfigReason(event.target.value)}
            placeholder="Why is this payment infrastructure configuration being changed?"
            helperText="The change is recorded in the Level-1 platform audit trail."
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!statusProvider}
        onClose={() => {
          if (!busy) setStatusProvider(null);
        }}
        title={statusProvider?.status === 'active' ? 'Disable payment provider' : 'Enable payment provider'}
        subtitle={statusProvider ? `${statusProvider.name} · ${statusProvider.code}` : undefined}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setStatusProvider(null)}>
              Cancel
            </Button>
            <Button
              variant={statusProvider?.status === 'active' ? 'danger' : 'gold'}
              size="md"
              loading={busy}
              onClick={() => void changeProviderStatus()}
            >
              {statusProvider?.status === 'active' ? 'Disable Provider' : 'Enable Provider'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: 13 }}>
            Enabling is refused by the backend unless an active configuration exists and its referenced
            server secrets are present. Disabling does not delete financial records or historical provider events.
          </p>
          <InputField
            label="Governance reason"
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            placeholder="Explain this provider lifecycle change"
            helperText="Required and written to the immutable platform audit trail."
          />
        </div>
      </Modal>

      <Modal
        isOpen={showRouteModal}
        onClose={() => {
          if (!busy) setShowRouteModal(false);
        }}
        title="Add Global Payment Route"
        subtitle="Route payment method and currency to an active provider. Church-specific overrides can be layered later without hardcoding."
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setShowRouteModal(false)}>
              Cancel
            </Button>
            <Button variant="gold" size="md" loading={busy} onClick={() => void createRoute()}>
              Save Route
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <InputField
            label="Currency"
            value={routeCurrency}
            maxLength={3}
            onChange={(event) => setRouteCurrency(event.target.value.toUpperCase())}
            placeholder="NGN"
          />
          <InputField
            label="Payment Method"
            value={routeMethod}
            onChange={(event) => setRouteMethod(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            placeholder="cards"
            helperText="Examples: cards, bank_transfer, ussd, mobile_money."
          />
          <SelectField
            label="Active Provider"
            value={routeProviderId}
            onChange={(event) => setRouteProviderId(event.target.value)}
            options={activeProviders.map((provider) => ({ label: provider.name, value: provider.id }))}
          />
          <InputField
            label="Priority"
            type="number"
            min={1}
            max={10000}
            value={routePriority}
            onChange={(event) => setRoutePriority(event.target.value)}
            helperText="Lower numbers are evaluated first."
          />
          <InputField
            label="Governance reason"
            value={routeReason}
            onChange={(event) => setRouteReason(event.target.value)}
            placeholder="Why is this global payment route being created or changed?"
          />
        </div>
      </Modal>
    </div>
  );
}

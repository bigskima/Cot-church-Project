import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, StatWidget, Table } from '../components/ui';

interface AiProvider {
  id: string;
  code: string;
  name: string;
  adapter_version: string;
  status: 'active' | 'disabled' | 'degraded';
  secret_reference: string;
  configuration?: Record<string, unknown>;
}

interface AiModel {
  id: string;
  provider_id: string;
  model_key: string;
  display_name: string;
  input_cost_per_million: number | string;
  output_cost_per_million: number | string;
  context_window?: number | null;
  is_active: boolean;
  configuration?: Record<string, unknown>;
  ai_providers?: { id: string; code: string; name: string; status: string } | null;
}

interface AiCapability {
  code: string;
  name: string;
  risk_level: 'low' | 'medium' | 'high' | 'pastoral';
  requires_human_review: boolean;
  description: string;
}

interface AiRoute {
  id: string;
  capability_code: string;
  primary_model_id: string;
  fallback_model_ids: string[];
  timeout_ms: number;
  max_retries: number;
  is_active: boolean;
  ai_models?: { id: string; provider_id: string; model_key: string; display_name: string; is_active: boolean } | null;
}

interface AiLimit {
  id: string;
  capability_code?: string | null;
  period: 'day' | 'month';
  max_requests?: number | null;
  max_tokens?: number | null;
  max_cost_minor?: number | null;
  currency: string;
  is_active: boolean;
}

interface AiRun {
  id: string;
  capability_code: string;
  status: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost_minor?: number | null;
  latency_ms?: number | null;
  error_code?: string | null;
  fallback_count?: number;
  created_at: string;
}

interface AiPayload {
  providers: AiProvider[];
  models: AiModel[];
  capabilities: AiCapability[];
  globalRoutes: AiRoute[];
  globalLimits: AiLimit[];
  recentRuns: AiRun[];
}

export function AiInfrastructure({ api }: { api: ApiClient }) {
  const [data, setData] = useState<AiPayload>({ providers: [], models: [], capabilities: [], globalRoutes: [], globalLimits: [], recentRuns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [providerModal, setProviderModal] = useState<AiProvider | null>(null);
  const [providerStatus, setProviderStatus] = useState<AiProvider['status']>('active');
  const [providerSecretRef, setProviderSecretRef] = useState('');
  const [providerReason, setProviderReason] = useState('');

  const [routeCapability, setRouteCapability] = useState<AiCapability | null>(null);
  const [routePrimaryModel, setRoutePrimaryModel] = useState('');
  const [routeTimeout, setRouteTimeout] = useState('30000');
  const [routeRetries, setRouteRetries] = useState('1');

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelProviderId, setModelProviderId] = useState('');
  const [modelKey, setModelKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelInputCost, setModelInputCost] = useState('0');
  const [modelOutputCost, setModelOutputCost] = useState('0');
  const [modelContext, setModelContext] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.request<AiPayload>('platform-ai'));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load AI control plane.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [api]);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AiModel[]>();
    for (const model of data.models) map.set(model.provider_id, [...(map.get(model.provider_id) ?? []), model]);
    return map;
  }, [data.models]);

  const routeByCapability = useMemo(
    () => new Map(data.globalRoutes.map((route) => [route.capability_code, route])),
    [data.globalRoutes]
  );

  const activeModels = data.models.filter((model) => model.is_active);
  const recentFailures = data.recentRuns.filter((run) => run.status === 'failed').length;
  const awaitingReview = data.recentRuns.filter((run) => run.status === 'requires_review').length;

  const openProvider = (provider: AiProvider) => {
    setProviderModal(provider);
    setProviderStatus(provider.status);
    setProviderSecretRef(provider.secret_reference);
    setProviderReason('');
  };

  const saveProvider = async () => {
    if (!providerModal) return;
    if (!providerSecretRef.trim()) {
      setError('AI provider secret reference is required. Enter the secret name, not the API key.');
      return;
    }
    if (providerStatus !== 'active' && !providerReason.trim()) {
      setError('A governance reason is required when degrading or disabling a provider.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.request('platform-ai', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'configure_provider',
          providerId: providerModal.id,
          status: providerStatus,
          secretReference: providerSecretRef.trim(),
          configuration: providerModal.configuration ?? {},
          reason: providerStatus === 'active' ? undefined : providerReason.trim(),
        }),
      });
      setProviderModal(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to configure AI provider.');
    } finally {
      setBusy(false);
    }
  };

  const openRoute = (capability: AiCapability) => {
    const route = routeByCapability.get(capability.code);
    setRouteCapability(capability);
    setRoutePrimaryModel(route?.primary_model_id ?? activeModels[0]?.id ?? '');
    setRouteTimeout(String(route?.timeout_ms ?? 30000));
    setRouteRetries(String(route?.max_retries ?? 1));
  };

  const saveRoute = async () => {
    if (!routeCapability || !routePrimaryModel) {
      setError('Select an active primary model for this capability.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.request('platform-ai', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'set_route',
          capabilityCode: routeCapability.code,
          primaryModelId: routePrimaryModel,
          fallbackModelIds: routeByCapability.get(routeCapability.code)?.fallback_model_ids ?? [],
          timeoutMs: Number(routeTimeout),
          maxRetries: Number(routeRetries),
          isActive: true,
        }),
      });
      setRouteCapability(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save AI route.');
    } finally {
      setBusy(false);
    }
  };

  const saveModel = async () => {
    if (!modelProviderId || !modelKey.trim() || !modelName.trim()) {
      setError('Provider, model key, and display name are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.request('platform-ai', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'upsert_model',
          providerId: modelProviderId,
          modelKey: modelKey.trim(),
          displayName: modelName.trim(),
          inputCostPerMillion: Number(modelInputCost || 0),
          outputCostPerMillion: Number(modelOutputCost || 0),
          contextWindow: modelContext ? Number(modelContext) : null,
          isActive: true,
          configuration: {},
        }),
      });
      setModelModalOpen(false);
      setModelKey('');
      setModelName('');
      setModelInputCost('0');
      setModelOutputCost('0');
      setModelContext('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save AI model.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-stats-grid">
        <StatWidget
          title="AI Providers"
          value={`${data.providers.filter((provider) => provider.status === 'active').length} active`}
          subtitle={`${data.providers.length} registered adapters`}
          trend={{ value: data.providers.some((provider) => provider.status === 'degraded') ? 'DEGRADED PROVIDER' : 'ROUTING READY', isPositive: !data.providers.some((provider) => provider.status === 'degraded') }}
          icon="✦"
          variant="gold"
        />
        <StatWidget
          title="Active Models"
          value={activeModels.length}
          subtitle={`${data.globalRoutes.filter((route) => route.is_active).length} global capability routes`}
          trend={{ value: 'DATABASE DRIVEN', isPositive: true }}
          icon="🧠"
        />
        <StatWidget
          title="Recent AI Safety"
          value={`${awaitingReview} review`}
          subtitle={`${recentFailures} failures in the recent run window`}
          trend={{ value: recentFailures ? 'REVIEW FAILURES' : 'NO RECENT FAILURES', isPositive: recentFailures === 0 }}
          icon="🛡"
          variant="success"
        />
      </div>

      {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 20 }}>{error}</div> : null}

      <Card
        title="AI Provider Adapters"
        subtitle="Provider-neutral routing with secret references; actual API keys remain in server secrets."
        headerAction={<Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {data.providers.map((provider) => (
            <div key={provider.id} style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 900 }}>{provider.name}</h4>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{provider.code} · adapter {provider.adapter_version}</p>
                </div>
                <Badge
                  label={provider.status.toUpperCase()}
                  variant={provider.status === 'active' ? 'active' : provider.status === 'degraded' ? 'warning' : 'suspended'}
                  pulse={provider.status === 'active'}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Secret ref: <code>{provider.secret_reference}</code></p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {(modelsByProvider.get(provider.id) ?? []).map((model) => (
                  <span key={model.id} style={{ fontSize: 10, border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 7px', color: model.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {model.model_key}
                  </span>
                ))}
              </div>
              <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={() => openProvider(provider)}>Configure provider</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Model Registry"
        subtitle="Models, context windows and cost metadata used by the routing engine"
        headerAction={<Button variant="gold" size="sm" onClick={() => {
          setModelProviderId(data.providers[0]?.id ?? '');
          setModelModalOpen(true);
        }}>Add model</Button>}
      >
        <Table
          columns={[
            { header: 'MODEL', accessor: (model) => <div><strong>{model.display_name}</strong><div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{model.model_key}</div></div> },
            { header: 'PROVIDER', accessor: (model) => model.ai_providers?.name ?? model.provider_id },
            { header: 'CONTEXT', accessor: (model) => model.context_window ? Number(model.context_window).toLocaleString() : '—' },
            { header: 'INPUT / 1M', accessor: (model) => String(model.input_cost_per_million) },
            { header: 'OUTPUT / 1M', accessor: (model) => String(model.output_cost_per_million) },
            { header: 'STATUS', accessor: (model) => <Badge label={model.is_active ? 'ACTIVE' : 'DISABLED'} variant={model.is_active ? 'active' : 'neutral'} /> },
          ]}
          data={data.models}
          keyExtractor={(model) => model.id}
          loading={loading}
          emptyMessage="No AI models are registered yet."
        />
      </Card>

      <Card
        title="Intelligence Capabilities & Human-Review Matrix"
        subtitle="Capabilities and pastoral-risk policy are stored in the backend; routes are configured globally here."
      >
        <Table
          columns={[
            {
              header: 'CAPABILITY',
              accessor: (item) => <div><div style={{ fontWeight: 800 }}>{item.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.code}</div></div>,
            },
            {
              header: 'RISK',
              accessor: (item) => <Badge label={item.risk_level.toUpperCase()} variant={item.risk_level === 'pastoral' ? 'gold' : item.risk_level === 'high' ? 'warning' : 'neutral'} />,
            },
            {
              header: 'HUMAN REVIEW',
              accessor: (item) => item.requires_human_review ? <Badge label="MANDATORY" variant="gold" /> : <Badge label="NOT REQUIRED" variant="healthy" />,
            },
            {
              header: 'GLOBAL ROUTE',
              accessor: (item) => {
                const route = routeByCapability.get(item.code);
                const model = data.models.find((entry) => entry.id === route?.primary_model_id);
                return route?.is_active ? model?.display_name ?? route.primary_model_id : 'Not configured';
              },
            },
            { header: 'PURPOSE', accessor: 'description' },
            { header: 'ACTION', accessor: (item) => <Button variant="outline" size="sm" onClick={() => openRoute(item)}>Configure route</Button> },
          ]}
          data={data.capabilities}
          keyExtractor={(item) => item.code}
          loading={loading}
        />
      </Card>

      <Modal
        isOpen={!!providerModal}
        onClose={() => { if (!busy) setProviderModal(null); }}
        title={providerModal ? `Configure ${providerModal.name}` : 'Configure AI provider'}
        subtitle="Store the server secret reference name only. Never paste an API key into this form."
        footer={<div style={{ display: 'flex', gap: 12 }}><Button variant="outline" disabled={busy} onClick={() => setProviderModal(null)}>Cancel</Button><Button variant="gold" loading={busy} onClick={() => void saveProvider()}>Save provider</Button></div>}
      >
        <InputField label="Secret reference" value={providerSecretRef} onChange={(event) => setProviderSecretRef(event.target.value.toUpperCase())} placeholder="OPENAI_API_KEY" />
        <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <strong style={{ fontSize: 12 }}>Provider status</strong>
          <select className="search" value={providerStatus} onChange={(event) => setProviderStatus(event.target.value as AiProvider['status'])}>
            <option value="active">Active</option>
            <option value="degraded">Degraded</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        {providerStatus !== 'active' ? <InputField label="Governance reason" value={providerReason} onChange={(event) => setProviderReason(event.target.value)} placeholder="Provider incident, quota exhaustion, policy restriction..." /> : null}
      </Modal>

      <Modal
        isOpen={!!routeCapability}
        onClose={() => { if (!busy) setRouteCapability(null); }}
        title={routeCapability ? `Route ${routeCapability.name}` : 'Configure AI route'}
        subtitle="Select an active primary model. Fallback IDs already stored for this route are preserved."
        footer={<div style={{ display: 'flex', gap: 12 }}><Button variant="outline" disabled={busy} onClick={() => setRouteCapability(null)}>Cancel</Button><Button variant="gold" loading={busy} onClick={() => void saveRoute()}>Save route</Button></div>}
      >
        <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <strong style={{ fontSize: 12 }}>Primary model</strong>
          <select className="search" value={routePrimaryModel} onChange={(event) => setRoutePrimaryModel(event.target.value)}>
            <option value="">Select a model</option>
            {activeModels.map((model) => <option key={model.id} value={model.id}>{model.display_name} · {model.ai_providers?.code}</option>)}
          </select>
        </label>
        <InputField label="Timeout (milliseconds)" type="number" value={routeTimeout} onChange={(event) => setRouteTimeout(event.target.value)} />
        <InputField label="Max retries (0–3)" type="number" value={routeRetries} onChange={(event) => setRouteRetries(event.target.value)} />
      </Modal>

      <Modal
        isOpen={modelModalOpen}
        onClose={() => { if (!busy) setModelModalOpen(false); }}
        title="Register AI model"
        subtitle="Model identifiers and pricing are configuration, not hardcoded application logic."
        footer={<div style={{ display: 'flex', gap: 12 }}><Button variant="outline" disabled={busy} onClick={() => setModelModalOpen(false)}>Cancel</Button><Button variant="gold" loading={busy} onClick={() => void saveModel()}>Save model</Button></div>}
      >
        <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <strong style={{ fontSize: 12 }}>Provider</strong>
          <select className="search" value={modelProviderId} onChange={(event) => setModelProviderId(event.target.value)}>
            <option value="">Select provider</option>
            {data.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </label>
        <InputField label="Model key" value={modelKey} onChange={(event) => setModelKey(event.target.value)} placeholder="gpt-5-mini" />
        <InputField label="Display name" value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="GPT-5 mini" />
        <InputField label="Input cost per million tokens" type="number" value={modelInputCost} onChange={(event) => setModelInputCost(event.target.value)} />
        <InputField label="Output cost per million tokens" type="number" value={modelOutputCost} onChange={(event) => setModelOutputCost(event.target.value)} />
        <InputField label="Context window" type="number" value={modelContext} onChange={(event) => setModelContext(event.target.value)} placeholder="Optional" />
      </Modal>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, SelectField, StatWidget, Table } from '../components/ui';

type SecretCategory = 'ai' | 'streaming' | 'payments' | 'communications' | 'integration' | 'other';

type SecretMetadata = {
  secret_reference: string;
  category: SecretCategory;
  provider_code?: string | null;
  description: string;
  created_at?: string;
  updated_at?: string;
  rotated_at: string;
};

type SecretCheck = {
  reference: string;
  configured: boolean;
  source: 'deployment_environment' | 'platform_vault' | null;
};

type Preset = {
  label: string;
  reference: string;
  category: SecretCategory;
  providerCode: string;
  description: string;
  helper: string;
};

const presets: Preset[] = [
  { label: 'OpenAI API key', reference: 'AI_OPENAI_PRIMARY', category: 'ai', providerCode: 'openai', description: 'Primary OpenAI API credential', helper: 'Paste the OpenAI API key exactly as issued.' },
  { label: 'Gemini API key', reference: 'AI_GEMINI_PRIMARY', category: 'ai', providerCode: 'gemini', description: 'Primary Google Gemini API credential', helper: 'Paste the Gemini API key exactly as issued.' },
  { label: 'Claude / Anthropic key', reference: 'AI_ANTHROPIC_PRIMARY', category: 'ai', providerCode: 'anthropic', description: 'Primary Anthropic API credential', helper: 'Paste the Anthropic API key exactly as issued.' },
  { label: 'Mux API credentials', reference: 'STREAMING_MUX_PRIMARY', category: 'streaming', providerCode: 'mux', description: 'Mux access token used to create and operate broadcasts', helper: 'Use JSON: {"tokenId":"...","tokenSecret":"..."}' },
  { label: 'Mux webhook secret', reference: 'STREAMING_MUX_WEBHOOK_PRIMARY', category: 'streaming', providerCode: 'mux', description: 'Mux webhook signing secret', helper: 'Paste the webhook signing secret from Mux.' },
  { label: 'Mux playback signing key', reference: 'STREAMING_MUX_SIGNING_PRIMARY', category: 'streaming', providerCode: 'mux', description: 'Mux signed-playback key pair', helper: 'Use JSON: {"keyId":"...","privateKeyPem":"-----BEGIN PRIVATE KEY-----..."}' },
  { label: 'Paystack secret key', reference: 'PAYSTACK_SECRET_KEY', category: 'payments', providerCode: 'paystack', description: 'Paystack server-side secret key', helper: 'Paste the Paystack live or test secret key for the selected environment.' },
  { label: 'Paystack webhook secret', reference: 'PAYSTACK_WEBHOOK_SECRET', category: 'payments', providerCode: 'paystack', description: 'Paystack webhook verification secret', helper: 'Paste the webhook secret used by the payment webhook verifier.' },
  { label: 'Stripe secret key', reference: 'STRIPE_SECRET_KEY', category: 'payments', providerCode: 'stripe', description: 'Stripe server-side secret key', helper: 'Paste the Stripe live or test secret key for the selected environment.' },
  { label: 'Stripe webhook secret', reference: 'STRIPE_WEBHOOK_SECRET', category: 'payments', providerCode: 'stripe', description: 'Stripe endpoint signing secret', helper: 'Paste the Stripe whsec_... endpoint secret.' },
];

const categoryOptions = [
  { label: 'AI', value: 'ai' },
  { label: 'Livestream / Media', value: 'streaming' },
  { label: 'Payments', value: 'payments' },
  { label: 'Communications', value: 'communications' },
  { label: 'Integrations / Webhooks', value: 'integration' },
  { label: 'Other Provider', value: 'other' },
];

export function ProviderCredentials({ api }: { api: ApiClient }) {
  const [items, setItems] = useState<SecretMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState<SecretCategory>('ai');
  const [providerCode, setProviderCode] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [helper, setHelper] = useState('The credential is encrypted in Supabase Vault and cannot be read back from this UI.');
  const [checks, setChecks] = useState<Record<string, SecretCheck>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await api.request<SecretMetadata[]>('platform-secrets'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load provider credential metadata.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [api]);

  const applyPreset = (preset: Preset) => {
    setReference(preset.reference);
    setCategory(preset.category);
    setProviderCode(preset.providerCode);
    setDescription(preset.description);
    setValue('');
    setHelper(preset.helper);
    setSuccess('');
    setError('');
  };

  const clearForm = () => {
    setReference('');
    setProviderCode('');
    setDescription('');
    setValue('');
    setShowValue(false);
    setHelper('The credential is encrypted in Supabase Vault and cannot be read back from this UI.');
  };

  const store = async () => {
    const normalized = reference.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(normalized)) {
      setError('Reference must use 3–128 uppercase letters, numbers, or underscores and begin with a letter.');
      return;
    }
    if (!value) {
      setError('Paste the provider credential before saving.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.request('platform-secrets', {
        method: 'POST',
        body: JSON.stringify({
          action: 'store',
          reference: normalized,
          value,
          category,
          providerCode: providerCode.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      // Never retain the raw secret in component state after the request succeeds.
      setValue('');
      setShowValue(false);
      setSuccess(`${normalized} was encrypted and stored. The value cannot be read back from the Admin UI.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to store provider credential.');
    } finally {
      setBusy(false);
    }
  };

  const check = async (secretReference: string) => {
    setError('');
    try {
      const result = await api.request<SecretCheck>('platform-secrets', {
        method: 'POST',
        body: JSON.stringify({ action: 'check', reference: secretReference }),
      });
      setChecks((current) => ({ ...current, [secretReference]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify provider credential.');
    }
  };

  const remove = async (secretReference: string) => {
    if (!window.confirm(`Remove ${secretReference} from Platform Vault? Provider features using this reference will stop working unless the same reference exists as a deployment environment secret.`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.request('platform-secrets', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', reference: secretReference }),
      });
      setSuccess(`${secretReference} was removed from Platform Vault.`);
      setChecks((current) => {
        const next = { ...current };
        delete next[secretReference];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove provider credential.');
    } finally {
      setBusy(false);
    }
  };

  const categoryCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of items) result[item.category] = (result[item.category] ?? 0) + 1;
    return result;
  }, [items]);

  return (
    <div>
      <div className="admin-stats-grid">
        <StatWidget title="Encrypted Credentials" value={items.length} subtitle="Stored in Supabase Vault" trend={{ value: 'NO READBACK', isPositive: true }} icon="🔐" variant="success" />
        <StatWidget title="AI Credentials" value={categoryCounts.ai ?? 0} subtitle="OpenAI, Gemini, Claude and future adapters" trend={{ value: 'PROVIDER NEUTRAL', isPositive: true }} icon="✦" />
        <StatWidget title="Media & Payment" value={(categoryCounts.streaming ?? 0) + (categoryCounts.payments ?? 0)} subtitle="Streaming and gateway infrastructure" trend={{ value: 'SERVER ONLY', isPositive: true }} icon="🛡" variant="gold" />
      </div>

      {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}
      {success ? <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, border: '1px solid var(--success)', color: 'var(--success)' }}>{success}</div> : null}

      <Card title="Quick Provider Presets" subtitle="Choose a common credential to prefill its safe server reference. You still paste the real value yourself.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {presets.map((preset) => <Button key={preset.reference} variant="outline" size="sm" onClick={() => applyPreset(preset)}>{preset.label}</Button>)}
        </div>
      </Card>

      <Card title={items.some((item) => item.secret_reference === reference.trim().toUpperCase()) ? 'Rotate Provider Credential' : 'Add Provider Credential'} subtitle="The raw value travels only to the authenticated Edge Function and encrypted Vault write. It is never stored in the browser after a successful save.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <InputField label="Secret reference" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="AI_OPENAI_PRIMARY" autoComplete="off" helperText="Stable server-side name used by provider configuration." />
          <SelectField label="Category" value={category} onChange={(event) => setCategory(event.target.value as SecretCategory)} options={categoryOptions} />
          <InputField label="Provider code" value={providerCode} onChange={(event) => setProviderCode(event.target.value.toLowerCase())} placeholder="openai, mux, paystack..." autoComplete="off" />
          <InputField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this credential is used for" autoComplete="off" />
        </div>
        <div style={{ marginTop: 14 }}>
          <InputField
            label="API key / credential value"
            type={showValue ? 'text' : 'password'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Paste the secret value here"
            autoComplete="new-password"
            spellCheck={false}
            helperText={helper}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            <Button variant="outline" size="sm" onClick={() => setShowValue((current) => !current)}>{showValue ? 'Hide value' : 'Show while entering'}</Button>
            <Button variant="gold" size="sm" onClick={() => void store()} loading={busy}>Encrypt & Save Credential</Button>
            <Button variant="ghost" size="sm" onClick={clearForm} disabled={busy}>Clear form</Button>
          </div>
        </div>
      </Card>

      <Card title="Stored Credential References" subtitle="Only metadata is displayed. Raw values cannot be retrieved through this screen." headerAction={<Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>}>
        <Table
          columns={[
            { header: 'REFERENCE', accessor: (item) => <div><strong style={{ fontFamily: 'var(--font-mono)' }}>{item.secret_reference}</strong><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description || 'No description'}</div></div> },
            { header: 'CATEGORY', accessor: (item) => <Badge label={item.category.toUpperCase()} variant="neutral" /> },
            { header: 'PROVIDER', accessor: (item) => item.provider_code || '—' },
            { header: 'ROTATED', accessor: (item) => item.rotated_at ? new Date(item.rotated_at).toLocaleString() : '—' },
            { header: 'RUNTIME CHECK', accessor: (item) => {
              const state = checks[item.secret_reference];
              if (!state) return <Button variant="outline" size="sm" onClick={() => void check(item.secret_reference)}>Check</Button>;
              return <Badge label={state.configured ? (state.source === 'platform_vault' ? 'VAULT READY' : 'ENV READY') : 'MISSING'} variant={state.configured ? 'active' : 'warning'} />;
            } },
            { header: 'ACTIONS', accessor: (item) => <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Button variant="outline" size="sm" onClick={() => { setReference(item.secret_reference); setCategory(item.category); setProviderCode(item.provider_code ?? ''); setDescription(item.description ?? ''); setValue(''); setHelper('Paste a new value to rotate this credential. The previous value will be replaced atomically in Vault.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Rotate</Button><Button variant="danger" size="sm" disabled={busy} onClick={() => void remove(item.secret_reference)}>Remove</Button></div> },
          ]}
          data={items}
          keyExtractor={(item) => item.secret_reference}
          loading={loading}
          emptyMessage="No Platform Vault credentials have been stored yet. Deployment environment secrets can still work until you migrate them here."
        />
      </Card>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SelectField, StatWidget, Table } from '../components/ui';

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null);
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

  const clearForm = () => {
    setReference('');
    setCategory('ai');
    setProviderCode('');
    setDescription('');
    setValue('');
    setShowValue(false);
    setHelper('The credential is encrypted in Supabase Vault and cannot be read back from this UI.');
    setError('');
  };

  const openNew = () => {
    clearForm();
    setSuccess('');
    setEditorOpen(true);
  };

  const applyPreset = (preset: Preset) => {
    setReference(preset.reference);
    setCategory(preset.category);
    setProviderCode(preset.providerCode);
    setDescription(preset.description);
    setValue('');
    setShowValue(false);
    setHelper(preset.helper);
    setSuccess('');
    setError('');
    setEditorOpen(true);
  };

  const openRotate = (item: SecretMetadata) => {
    setReference(item.secret_reference);
    setCategory(item.category);
    setProviderCode(item.provider_code ?? '');
    setDescription(item.description ?? '');
    setValue('');
    setShowValue(false);
    setHelper('Paste a new value to rotate this credential. The previous value is replaced atomically in Vault.');
    setSuccess('');
    setError('');
    setEditorOpen(true);
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
      setValue('');
      setShowValue(false);
      setEditorOpen(false);
      setSuccess(`${normalized} was encrypted and stored. The value cannot be read back from Platform Administration.`);
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

  const remove = async () => {
    if (!deleteTarget) return;
    const secretReference = deleteTarget.secret_reference;
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
      setDeleteTarget(null);
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

  const rotatingExisting = items.some((item) => item.secret_reference === reference.trim().toUpperCase());

  return (
    <div className="admin-page-stack">
      <div className="admin-stats-grid">
        <StatWidget title="Encrypted credentials" value={items.length} subtitle="Stored in Supabase Vault" trend={{ value: 'NO READBACK', isPositive: true }} icon="VAULT" variant="success" />
        <StatWidget title="AI credentials" value={categoryCounts.ai ?? 0} subtitle="OpenAI, Gemini, Claude and future adapters" trend={{ value: 'PROVIDER NEUTRAL', isPositive: true }} icon="AI" />
        <StatWidget title="Media & payment" value={(categoryCounts.streaming ?? 0) + (categoryCounts.payments ?? 0)} subtitle="Streaming and gateway infrastructure" trend={{ value: 'SERVER ONLY', isPositive: true }} icon="SEC" variant="gold" />
      </div>

      {error && !editorOpen && !deleteTarget ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {success ? <div className="admin-status-message admin-status-success">{success}</div> : null}

      <Card
        title="Provider credentials"
        subtitle="Only metadata is displayed. Raw credential values are write-only and cannot be retrieved from this screen."
        headerAction={<div className="admin-header-actions"><Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button><Button variant="gold" size="sm" onClick={openNew}>Add credential</Button></div>}
      >
        <div className="admin-preset-strip">
          {presets.map((preset) => <Button key={preset.reference} variant="outline" size="sm" onClick={() => applyPreset(preset)}>{preset.label}</Button>)}
        </div>

        <Table
          columns={[
            { header: 'REFERENCE', accessor: (item) => <div><strong className="admin-secret-reference">{item.secret_reference}</strong><div className="admin-row-meta">{item.description || 'No description'}</div></div> },
            { header: 'CATEGORY', accessor: (item) => <Badge label={item.category.toUpperCase()} variant="neutral" /> },
            { header: 'PROVIDER', accessor: (item) => item.provider_code || '—' },
            { header: 'ROTATED', accessor: (item) => item.rotated_at ? new Date(item.rotated_at).toLocaleString() : '—' },
            { header: 'RUNTIME', accessor: (item) => {
              const state = checks[item.secret_reference];
              if (!state) return <Button variant="outline" size="sm" onClick={() => void check(item.secret_reference)}>Check</Button>;
              return <Badge label={state.configured ? (state.source === 'platform_vault' ? 'VAULT READY' : 'ENV READY') : 'MISSING'} variant={state.configured ? 'active' : 'warning'} />;
            } },
            { header: 'ACTIONS', accessor: (item) => <div className="admin-table-actions"><Button variant="outline" size="sm" onClick={() => openRotate(item)}>Rotate</Button><Button variant="danger" size="sm" disabled={busy} onClick={() => { setError(''); setDeleteTarget(item); }}>Remove</Button></div> },
          ]}
          data={items}
          keyExtractor={(item) => item.secret_reference}
          loading={loading}
          emptyMessage="No Platform Vault credentials have been stored yet. Deployment environment secrets can still operate until migrated here."
        />
      </Card>

      <Modal
        isOpen={editorOpen}
        onClose={() => { if (!busy) setEditorOpen(false); }}
        title={rotatingExisting ? 'Rotate provider credential' : 'Add provider credential'}
        subtitle="The raw value is sent only to the authenticated server function and encrypted Vault write."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button variant="gold" size="md" loading={busy} onClick={() => void store()}>{rotatingExisting ? 'Rotate credential' : 'Encrypt & save'}</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <div className="admin-form-grid-two">
            <InputField label="Secret reference" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="AI_OPENAI_PRIMARY" autoComplete="off" helperText="Stable server-side reference." />
            <SelectField label="Category" value={category} onChange={(event) => setCategory(event.target.value as SecretCategory)} options={categoryOptions} />
            <InputField label="Provider code" value={providerCode} onChange={(event) => setProviderCode(event.target.value.toLowerCase())} placeholder="openai, mux, paystack…" autoComplete="off" />
            <InputField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this credential is used for" autoComplete="off" />
          </div>
          <InputField
            label="Credential value"
            type={showValue ? 'text' : 'password'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Paste the secret value"
            autoComplete="new-password"
            spellCheck={false}
            helperText={helper}
          />
          <Button variant="ghost" size="sm" onClick={() => setShowValue((current) => !current)}>{showValue ? 'Hide value' : 'Show while entering'}</Button>
          <div className="admin-info-callout">Secret values are never displayed again after a successful save.</div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => { if (!busy) setDeleteTarget(null); }}
        title="Remove provider credential"
        subtitle={deleteTarget?.secret_reference}
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="md" loading={busy} onClick={() => void remove()}>Remove credential</Button>
          </>
        }
      >
        {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
        <div className="admin-warning-callout">
          Removing this Vault reference can stop provider features unless the same reference is supplied by the deployment environment.
        </div>
      </Modal>
    </div>
  );
}

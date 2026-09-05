import { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import type { PlatformBrandingConfig } from '@church/types';
import { Badge, Button, Card, InputField, Modal } from '../components/ui';

const emptyBranding: PlatformBrandingConfig = {
  platform_name: 'City of Transformation',
  primary_logo_url: '',
  compact_logo_url: '',
  dark_logo_url: '',
  public_header_logo_url: '',
  launch_logo_url: '',
  launch_background_url: '',
  default_placeholder_logo_url: '',
  default_leader_placeholder_url: '',
};

export function BrandingAppearance({ api }: { api: ApiClient }) {
  const [branding, setBranding] = useState<PlatformBrandingConfig>(emptyBranding);
  const [draft, setDraft] = useState<PlatformBrandingConfig>(emptyBranding);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void loadBranding(); }, [api]);

  async function loadBranding() {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<PlatformBrandingConfig>('branding');
      const next = data ?? emptyBranding;
      setBranding(next);
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load branding.');
    } finally {
      setLoading(false);
    }
  }

  const openEdit = () => {
    setDraft(branding);
    setError('');
    setMsg('');
    setEditOpen(true);
  };

  async function handleSave() {
    if (!draft.platform_name?.trim()) {
      setError('Platform name is required.');
      return;
    }

    setSaving(true);
    setMsg('');
    setError('');
    try {
      await api.request('branding', {
        method: 'PATCH',
        body: JSON.stringify({
          platformName: draft.platform_name.trim(),
          primaryLogoUrl: draft.primary_logo_url || null,
          compactLogoUrl: draft.compact_logo_url || null,
          darkLogoUrl: draft.dark_logo_url || null,
          publicHeaderLogoUrl: draft.public_header_logo_url || null,
          launchLogoUrl: draft.launch_logo_url || null,
          launchBackgroundUrl: draft.launch_background_url || null,
          defaultPlaceholderLogoUrl: draft.default_placeholder_logo_url || null,
          defaultLeaderPlaceholderUrl: draft.default_leader_placeholder_url || null,
        }),
      });
      setBranding(draft);
      setEditOpen(false);
      setMsg('Branding changes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save branding.');
    } finally {
      setSaving(false);
    }
  }

  const assets = [
    ['Primary logo', branding.primary_logo_url],
    ['Compact logo', branding.compact_logo_url],
    ['Dark-surface logo', branding.dark_logo_url],
    ['Public header logo', branding.public_header_logo_url],
    ['Launch logo', branding.launch_logo_url],
    ['Launch background', branding.launch_background_url],
    ['Default church image', branding.default_placeholder_logo_url],
    ['Default leader image', branding.default_leader_placeholder_url],
  ] as const;

  const configuredAssets = assets.filter(([, url]) => Boolean(url));

  return (
    <div className="admin-page-stack">
      {error && !editOpen ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {msg ? <div className="admin-status-message admin-status-success">{msg}</div> : null}

      <Card
        title="Branding & identity"
        subtitle="Platform name, logos, launch artwork and default imagery used across the public and member experience."
        headerAction={<div className="admin-header-actions"><Button variant="outline" size="sm" loading={loading} onClick={() => void loadBranding()}>Refresh</Button><Button variant="gold" size="sm" disabled={loading} onClick={openEdit}>Edit branding</Button></div>}
      >
        <div className="admin-branding-summary">
          <div className="admin-branding-hero">
            <div className="admin-branding-preview">
              {branding.primary_logo_url ? <img src={branding.primary_logo_url} alt="" /> : <span>COT</span>}
            </div>
            <div>
              <div className="admin-row-meta">PLATFORM NAME</div>
              <div className="admin-branding-name">{branding.platform_name || 'City of Transformation'}</div>
              <div className="admin-branding-meta">
                <Badge label={`${configuredAssets.length}/${assets.length} ASSETS`} variant={configuredAssets.length === assets.length ? 'active' : 'neutral'} />
                <span>Installed startup artwork remains bundled for reliable launch; runtime artwork can be changed here.</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Brand assets" subtitle="Current runtime image references. Missing assets fall back to the installed app defaults.">
        <div className="admin-brand-asset-grid">
          {assets.map(([label, url]) => (
            <div key={label} className="admin-brand-asset-card">
              <div className="admin-brand-asset-thumb">
                {url ? <img src={url} alt="" /> : <span>—</span>}
              </div>
              <div className="admin-brand-asset-copy">
                <strong>{label}</strong>
                <span>{url ? 'Configured' : 'Using fallback'}</span>
              </div>
              <Badge label={url ? 'SET' : 'FALLBACK'} variant={url ? 'active' : 'neutral'} />
            </div>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={editOpen}
        onClose={() => { if (!saving) setEditOpen(false); }}
        title="Edit platform branding"
        subtitle="Update runtime branding without changing the installed app bundle."
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" size="md" disabled={saving} onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="gold" size="md" loading={saving} onClick={() => void handleSave()}>Save branding</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <InputField
            label="Platform name"
            value={draft.platform_name}
            onChange={(e) => setDraft({ ...draft, platform_name: e.target.value })}
            placeholder="City of Transformation"
            required
          />

          <div className="admin-form-section-title">Core logos</div>
          <div className="admin-form-grid-two">
            <InputField label="Primary logo URL" type="url" value={draft.primary_logo_url ?? ''} onChange={(e) => setDraft({ ...draft, primary_logo_url: e.target.value })} placeholder="https://…/primary-logo.png" />
            <InputField label="Compact / monogram logo URL" type="url" value={draft.compact_logo_url ?? ''} onChange={(e) => setDraft({ ...draft, compact_logo_url: e.target.value })} placeholder="https://…/compact-logo.png" />
            <InputField label="Dark-surface logo URL" type="url" value={draft.dark_logo_url ?? ''} onChange={(e) => setDraft({ ...draft, dark_logo_url: e.target.value })} placeholder="https://…/dark-logo.png" />
            <InputField label="Public header logo URL" type="url" value={draft.public_header_logo_url ?? ''} onChange={(e) => setDraft({ ...draft, public_header_logo_url: e.target.value })} placeholder="https://…/header-logo.png" />
          </div>

          <div className="admin-form-section-title">Launch experience</div>
          <div className="admin-form-grid-two">
            <InputField label="Launch logo URL" type="url" value={draft.launch_logo_url ?? ''} onChange={(e) => setDraft({ ...draft, launch_logo_url: e.target.value })} placeholder="https://…/launch-logo.png" />
            <InputField label="Launch background URL" type="url" value={draft.launch_background_url ?? ''} onChange={(e) => setDraft({ ...draft, launch_background_url: e.target.value })} placeholder="https://…/launch-background.jpg" />
          </div>

          <div className="admin-form-section-title">Fallback imagery</div>
          <div className="admin-form-grid-two">
            <InputField label="Default church image URL" type="url" value={draft.default_placeholder_logo_url ?? ''} onChange={(e) => setDraft({ ...draft, default_placeholder_logo_url: e.target.value })} placeholder="https://…/default-church.png" />
            <InputField label="Default leader image URL" type="url" value={draft.default_leader_placeholder_url ?? ''} onChange={(e) => setDraft({ ...draft, default_leader_placeholder_url: e.target.value })} placeholder="https://…/default-leader.png" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

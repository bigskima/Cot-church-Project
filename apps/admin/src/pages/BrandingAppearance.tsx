import { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import type { PlatformBrandingConfig } from '@church/types';

export function BrandingAppearance({ api }: { api: ApiClient }) {
  const [branding, setBranding] = useState<PlatformBrandingConfig>({
    platform_name: 'Church Digital Platform',
    primary_logo_url: '',
    compact_logo_url: '',
    dark_logo_url: '',
    public_header_logo_url: '',
    launch_logo_url: '',
    launch_background_url: '',
    default_placeholder_logo_url: '',
    default_leader_placeholder_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadBranding();
  }, []);

  function loadBranding() {
    setLoading(true);
    setError('');
    api
      .request<PlatformBrandingConfig>('branding')
      .then((data) => {
        if (data) setBranding(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load branding'))
      .finally(() => setLoading(false));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await api.request('branding', {
        method: 'PATCH',
        body: JSON.stringify({
          platformName: branding.platform_name,
          primaryLogoUrl: branding.primary_logo_url || null,
          compactLogoUrl: branding.compact_logo_url || null,
          darkLogoUrl: branding.dark_logo_url || null,
          publicHeaderLogoUrl: branding.public_header_logo_url || null,
          launchLogoUrl: branding.launch_logo_url || null,
          launchBackgroundUrl: branding.launch_background_url || null,
          defaultPlaceholderLogoUrl: branding.default_placeholder_logo_url || null,
          defaultLeaderPlaceholderUrl: branding.default_leader_placeholder_url || null,
        }),
      });
      setMsg('Platform branding configuration saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="branding-appearance">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">CONTROL PLANE APPEARANCE</span>
            <h2>Platform Branding & Visual Identity</h2>
            <p>
              Centrally configure platform name, logos, splash/launch graphics, and default asset placeholders.
            </p>
          </div>
          <button onClick={loadBranding} disabled={loading}>
            {loading ? 'Refreshing…' : 'Reload'}
          </button>
        </div>

        <div className="alert-notice">
          <strong>Two-Layer Architecture:</strong> Native Splash (Layer A) is compiled in the binary for zero-latency startup. Dynamic Launch Branding (Layer B) and In-App logos update automatically from these database settings without requiring a binary release.
        </div>

        {error && <div className="error">{error}</div>}
        {msg && <div className="pill green" style={{ padding: '8px 16px', margin: '14px 0' }}>{msg}</div>}

        {loading ? (
          <div className="loading">Loading branding configuration…</div>
        ) : (
          <form onSubmit={handleSave} style={{ marginTop: '20px', display: 'grid', gap: '16px' }}>
            <label>
              <strong>Platform Name</strong>
              <input
                type="text"
                className="search"
                style={{ width: '100%', marginTop: '6px' }}
                value={branding.platform_name}
                onChange={(e) => setBranding({ ...branding, platform_name: e.target.value })}
                required
              />
            </label>

            <div className="grid">
              <label>
                <strong>Primary Logo URL</strong>
                <input
                  type="url"
                  className="search"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="https://.../primary_logo.png"
                  value={branding.primary_logo_url ?? ''}
                  onChange={(e) => setBranding({ ...branding, primary_logo_url: e.target.value })}
                />
              </label>

              <label>
                <strong>Compact / Monogram Logo URL</strong>
                <input
                  type="url"
                  className="search"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="https://.../compact_logo.png"
                  value={branding.compact_logo_url ?? ''}
                  onChange={(e) => setBranding({ ...branding, compact_logo_url: e.target.value })}
                />
              </label>
            </div>

            <div className="grid">
              <label>
                <strong>In-App Dynamic Launch Logo URL</strong>
                <input
                  type="url"
                  className="search"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="https://.../launch_logo.png"
                  value={branding.launch_logo_url ?? ''}
                  onChange={(e) => setBranding({ ...branding, launch_logo_url: e.target.value })}
                />
              </label>

              <label>
                <strong>Public Header Logo URL</strong>
                <input
                  type="url"
                  className="search"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="https://.../header_logo.png"
                  value={branding.public_header_logo_url ?? ''}
                  onChange={(e) => setBranding({ ...branding, public_header_logo_url: e.target.value })}
                />
              </label>
            </div>

            <div className="grid">
              <label>
                <strong>Default Organization Placeholder URL</strong>
                <input
                  type="url"
                  className="search"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="https://.../default_church.png"
                  value={branding.default_placeholder_logo_url ?? ''}
                  onChange={(e) => setBranding({ ...branding, default_placeholder_logo_url: e.target.value })}
                />
              </label>

              <label>
                <strong>Default Leader Portrait Placeholder URL</strong>
                <input
                  type="url"
                  className="search"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="https://.../default_leader.png"
                  value={branding.default_leader_placeholder_url ?? ''}
                  onChange={(e) => setBranding({ ...branding, default_leader_placeholder_url: e.target.value })}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: '16px',
                backgroundColor: '#10264b',
                color: 'white',
                height: '48px',
                borderRadius: '12px',
                border: 0,
                fontWeight: 700,
                cursor: 'pointer',
                width: '240px',
              }}
            >
              {saving ? 'Saving changes…' : 'Save Branding Config'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, Modal, StatWidget, Table } from '../components/ui';

interface ProviderConfig {
  id: string;
  provider_code: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  adapter_version: string;
  secret_reference: string;
  webhook_status: 'healthy' | 'degraded' | 'error';
  capabilities: string[];
}

interface ActiveStream {
  id: string;
  organization_id: string;
  branch_id?: string;
  title: string;
  status: string;
  latency_mode: string;
  started_at?: string;
  scheduled_start?: string;
}

export function StreamingInfrastructure({ api }: { api: ApiClient }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    {
      id: 'mux-adapter-01',
      provider_code: 'mux',
      name: 'Mux Video Streaming Ingest Adapter',
      is_active: true,
      is_default: true,
      adapter_version: '2026-08-01',
      secret_reference: 'MUX_API_CREDENTIALS',
      webhook_status: 'healthy',
      capabilities: [
        'rtmp_ingest',
        'srt_ingest',
        'adaptive_hls',
        'low_latency',
        'signed_playback',
        'recording',
        'clips',
      ],
    },
    {
      id: 'cloudflare-stream-01',
      provider_code: 'cloudflare',
      name: 'Cloudflare Stream Video Ingest (Standby)',
      is_active: false,
      is_default: false,
      adapter_version: '2026-08-01',
      secret_reference: 'CLOUDFLARE_STREAM_API_TOKEN',
      webhook_status: 'healthy',
      capabilities: ['rtmp_ingest', 'adaptive_hls', 'low_latency', 'recording'],
    },
  ]);
  const [activeStreams, setActiveStreams] = useState<ActiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedStreamToKill, setSelectedStreamToKill] = useState<ActiveStream | null>(null);

  useEffect(() => {
    loadStreams();
  }, []);

  const loadStreams = () => {
    setLoading(true);
    setError('');
    api
      .request<ActiveStream[]>('live-streams')
      .then((data) => setActiveStreams(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load streaming telemetry'))
      .finally(() => setLoading(false));
  };

  const handleEmergencyTerminate = async (stream: ActiveStream) => {
    setActionBusy(true);
    try {
      await api.request(`streaming-broadcasts?id=${stream.id}`, {
        method: 'DELETE',
      });
      setSelectedStreamToKill(null);
      loadStreams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Emergency termination failed');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div>
      {/* Streaming Infrastructure KPI Bar */}
      <div className="admin-stats-grid">
        <StatWidget
          title="Active Live Broadcasts"
          value={activeStreams.filter((s) => s.status === 'live').length}
          subtitle="Real-time transcoding feeds"
          trend={{ value: 'LIVE NOW', isPositive: true }}
          icon="📡"
          variant="live"
        />
        <StatWidget
          title="Primary Video Provider"
          value="Mux Adapter"
          subtitle="Secret: MUX_API_CREDENTIALS"
          trend={{ value: 'ACTIVE', isPositive: true }}
          icon="⚡"
          variant="gold"
        />
        <StatWidget
          title="Webhook Delivery Health"
          value="100% SLA"
          subtitle="HMAC Signature Verification"
          trend={{ value: 'HEALTHY', isPositive: true }}
          icon="🛡"
          variant="success"
        />
      </div>

      {/* Streaming Provider Registry Card */}
      <Card
        title="Live Stream Provider Registry"
        subtitle="Pluggable third-party video transport adapters configured at the Platform Authority level"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {providers.map((p) => (
            <div
              key={p.id}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900 }}>{p.name}</h4>
                <Badge
                  label={p.is_active ? 'ACTIVE PROVIDER' : 'STANDBY'}
                  variant={p.is_active ? 'active' : 'neutral'}
                  pulse={p.is_active}
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Secret Vault Ref: <strong style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{p.secret_reference}</strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {p.capabilities.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: 'var(--bg-card)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <Badge label="WEBHOOK: HEALTHY" variant="healthy" />
                <Button variant="outline" size="sm">
                  Configure Adapter
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Platform Active Streams & Emergency Killswitch */}
      <Card
        title="Live Broadcast Monitor & Emergency Controls"
        subtitle="Platform-wide active and scheduled stream telemetry across all organisations and expressions"
        headerAction={
          <Button variant="outline" size="md" onClick={loadStreams} loading={loading}>
            Refresh Streams
          </Button>
        }
      >
        {error ? (
          <div className="admin-form-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        <Table
          columns={[
            {
              header: 'STREAM TITLE',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {item.id}</div>
                </div>
              ),
            },
            {
              header: 'STATUS',
              accessor: (item) => {
                const isLive = item.status === 'live';
                return (
                  <Badge
                    label={item.status.toUpperCase()}
                    variant={isLive ? 'live' : item.status === 'scheduled' ? 'gold' : 'neutral'}
                    pulse={isLive}
                  />
                );
              },
            },
            {
              header: 'LATENCY PROFILE',
              accessor: (item) => item.latency_mode || 'Reduced Latency (~4s)',
            },
            {
              header: 'EMERGENCY ACTIONS',
              accessor: (item) => (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStreamToKill(item);
                  }}
                >
                  Emergency Killswitch
                </Button>
              ),
            },
          ]}
          data={activeStreams}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No streams currently broadcasting or scheduled across the ecosystem."
        />
      </Card>

      {/* Emergency Termination Modal */}
      <Modal
        isOpen={!!selectedStreamToKill}
        onClose={() => setSelectedStreamToKill(null)}
        title="Emergency Broadcast Termination"
        subtitle="Immediate safety killswitch for policy violation or compromised stream credentials."
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" onClick={() => setSelectedStreamToKill(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={actionBusy}
              onClick={() => selectedStreamToKill && handleEmergencyTerminate(selectedStreamToKill)}
            >
              Terminate Feed Immediately
            </Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
          Terminating <strong style={{ color: 'var(--text-primary)' }}>"{selectedStreamToKill?.title}"</strong> will immediately disconnect the hardware encoder, revoke RTMP credentials, close active viewer sessions, and record an immutable audit alert.
        </p>
      </Modal>
    </div>
  );
}

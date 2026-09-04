import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, StatWidget, Table } from '../components/ui';

interface PlatformOverviewPayload {
  generatedAt: string;
  state: 'operational' | 'attention';
  organizations: { total: number; active: number; suspended: number; archived: number };
  expressions: { total: number; active: number; inactive: number };
  identities: { total: number; activeMemberships: number };
  streaming: {
    live: number;
    scheduled: number;
    processing: number;
    failed: number;
    activeProviders: number;
    activeConfigurations: number;
    configured: boolean;
  };
  ai: {
    runs24h: number;
    failed24h: number;
    requiresReview: number;
    activeProviders: number;
    activeModels: number;
    configured: boolean;
  };
  jobs: {
    workflows: { queued: number; running: number; failed: number; deadLetter: number };
    integrations: { queued: number; running: number; failed: number; deadLetter: number };
  };
  recentAudit: Array<{
    id: number | string;
    actor_profile_id?: string | null;
    action: string;
    target_type: string;
    target_id?: string | null;
    metadata?: Record<string, unknown> | null;
    occurred_at: string;
  }>;
}

function statusLabel(ok: boolean, attention = false) {
  if (attention) return 'attention';
  return ok ? 'healthy' : 'not configured';
}

export function PlatformOverview({
  api,
  onNavigate,
}: {
  api: ApiClient;
  onNavigate: (page: string) => void;
}) {
  const [metrics, setMetrics] = useState<PlatformOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api
      .request<PlatformOverviewPayload>('platform-overview')
      .then(setMetrics)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load the platform overview.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const queueAttention = useMemo(() => {
    if (!metrics) return false;
    const workflow = metrics.jobs.workflows;
    const integrations = metrics.jobs.integrations;
    return workflow.failed + workflow.deadLetter + integrations.failed + integrations.deadLetter > 0;
  }, [metrics]);

  if (error && !metrics) {
    return (
      <Card title="Platform overview unavailable" subtitle="The page is still available, but the latest platform information could not be loaded.">
        <div className="admin-inline-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>
        <Button variant="primary" onClick={load}>Try again</Button>
      </Card>
    );
  }

  return (
    <div>
      <div className="admin-stats-grid">
        <StatWidget
          title="Church Organisations"
          value={metrics?.organizations.total ?? 0}
          subtitle={`${metrics?.organizations.active ?? 0} active · ${metrics?.organizations.suspended ?? 0} suspended`}
          trend={{ value: metrics?.organizations.archived ? `${metrics.organizations.archived} archived` : 'Lifecycle controlled', isPositive: (metrics?.organizations.suspended ?? 0) === 0 }}
          icon="🏛"
          variant="gold"
        />
        <StatWidget
          title="Expressions"
          value={metrics?.expressions.total ?? 0}
          subtitle={`${metrics?.expressions.active ?? 0} active local expressions`}
          trend={{ value: `${metrics?.expressions.inactive ?? 0} inactive`, isPositive: (metrics?.expressions.inactive ?? 0) === 0 }}
          icon="🌐"
        />
        <StatWidget
          title="Accounts"
          value={metrics?.identities.total ?? 0}
          subtitle={`${metrics?.identities.activeMemberships ?? 0} active memberships`}
          trend={{ value: 'Live account data', isPositive: true }}
          icon="👥"
          variant="success"
        />
        <StatWidget
          title="Live Broadcasts"
          value={metrics?.streaming.live ?? 0}
          subtitle={`${metrics?.streaming.scheduled ?? 0} scheduled · ${metrics?.streaming.processing ?? 0} processing`}
          trend={{ value: (metrics?.streaming.failed ?? 0) > 0 ? `${metrics?.streaming.failed} failed` : 'No stream failures', isPositive: (metrics?.streaming.failed ?? 0) === 0 }}
          icon="📡"
          variant="live"
        />
      </div>

      {metrics?.state === 'attention' ? (
        <div className="admin-inline-error" role="status" style={{ marginBottom: 24 }}>
          One or more platform services need attention. Review the affected services below.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 24, marginBottom: 24 }}>
        <Card
          title="Platform Service Health"
          subtitle={metrics?.generatedAt ? `Last updated ${new Date(metrics.generatedAt).toLocaleString()}` : 'Loading current status'}
          headerAction={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              ['Platform services', statusLabel(Boolean(metrics)), 'Administration service availability'],
              ['Streaming service', statusLabel(Boolean(metrics?.streaming.configured), (metrics?.streaming.failed ?? 0) > 0), `${metrics?.streaming.activeProviders ?? 0} provider(s) · ${metrics?.streaming.activeConfigurations ?? 0} active config(s)`],
              ['AI service', statusLabel(Boolean(metrics?.ai.configured), (metrics?.ai.failed24h ?? 0) > 0), `${metrics?.ai.activeProviders ?? 0} provider(s) · ${metrics?.ai.activeModels ?? 0} model(s)`],
              ['Background tasks', statusLabel(true, queueAttention), `${metrics?.jobs.workflows.queued ?? 0} queued · ${metrics?.jobs.workflows.running ?? 0} running`],
              ['Connected services', statusLabel(true, queueAttention), `${metrics?.jobs.integrations.queued ?? 0} queued · ${metrics?.jobs.integrations.running ?? 0} running`],
              ['AI review', (metrics?.ai.requiresReview ?? 0) > 0 ? 'attention' : 'healthy', `${metrics?.ai.requiresReview ?? 0} item(s) require ministry review`],
            ].map(([service, status, desc]) => (
              <div
                key={service}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{service}</span>
                  <Badge
                    label={status.toUpperCase()}
                    variant={status === 'healthy' ? 'success' : status === 'attention' ? 'warning' : 'neutral'}
                    pulse={status === 'healthy'}
                  />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick Actions" subtitle="Common Platform Administration tasks">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button variant="primary" size="md" onClick={() => onNavigate('organizations')} icon="🏛">
              Manage Organisations
            </Button>
            <Button variant="gold" size="md" onClick={() => onNavigate('streaming')} icon="📡">
              Streaming Services
            </Button>
            <Button variant="secondary" size="md" onClick={() => onNavigate('ai')} icon="✦">
              AI Services
            </Button>
            <Button variant="outline" size="md" onClick={() => onNavigate('integrations')} icon="⚡">
              System Activity
            </Button>
            <Button variant="outline" size="md" onClick={() => onNavigate('audit')} icon="🛡">
              View Audit Log
            </Button>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card title="AI activity (24h)">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><strong style={{ fontSize: 24 }}>{metrics?.ai.runs24h ?? 0}</strong><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>runs</p></div>
            <div><strong style={{ fontSize: 24 }}>{metrics?.ai.failed24h ?? 0}</strong><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>failed</p></div>
            <div><strong style={{ fontSize: 24 }}>{metrics?.ai.requiresReview ?? 0}</strong><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>awaiting review</p></div>
          </div>
        </Card>
        <Card title="Background tasks">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><strong style={{ fontSize: 24 }}>{metrics?.jobs.workflows.queued ?? 0}</strong><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>queued</p></div>
            <div><strong style={{ fontSize: 24 }}>{metrics?.jobs.workflows.running ?? 0}</strong><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>running</p></div>
            <div><strong style={{ fontSize: 24 }}>{(metrics?.jobs.workflows.failed ?? 0) + (metrics?.jobs.workflows.deadLetter ?? 0)}</strong><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>failed/dead</p></div>
          </div>
        </Card>
      </div>

      <Card
        title="Recent Administrative Activity"
        subtitle="Recent security-sensitive administrative actions"
        headerAction={<Button variant="ghost" size="sm" onClick={() => onNavigate('audit')}>View Audit Log</Button>}
      >
        <Table
          columns={[
            { header: 'EVENT ACTION', accessor: (item) => <Badge label={item.action} variant="gold" /> },
            { header: 'TARGET DOMAIN', accessor: 'target_type' },
            { header: 'ACTOR PROFILE', accessor: (item) => item.actor_profile_id ?? 'system' },
            { header: 'TIMESTAMP', accessor: (item) => new Date(item.occurred_at).toLocaleString() },
          ]}
          data={metrics?.recentAudit ?? []}
          keyExtractor={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No administrative activity has been recorded yet."
        />
      </Card>
    </div>
  );
}

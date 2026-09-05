import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, StatWidget, Table, Tabs } from '../components/ui';

type OrganizationRef = { id: string; name: string; slug?: string } | null;
type JobStatus = 'pending' | 'processing' | 'queued' | 'running' | 'failed' | 'dead_letter' | 'delivered' | 'completed' | string;

interface NotificationJob {
  id: number;
  organizations?: OrganizationRef;
  channel: string;
  status: JobStatus;
  attempts: number;
  available_at?: string | null;
  delivered_at?: string | null;
  last_error?: string | null;
  created_at: string;
}

interface WorkflowRun {
  id: string;
  organizations?: OrganizationRef;
  workflow_definitions?: { name?: string; code?: string; trigger_event_type?: string } | null;
  status: JobStatus;
  attempts: number;
  available_at?: string | null;
  completed_at?: string | null;
  last_error?: string | null;
  created_at: string;
}

interface IntegrationDelivery {
  id: number;
  organizations?: OrganizationRef;
  integration_connections?: { provider?: string; name?: string; status?: string } | null;
  status: JobStatus;
  attempts: number;
  response_code?: number | null;
  last_error?: string | null;
  completed_at?: string | null;
  created_at: string;
}

interface IntegrationConnection {
  id: string;
  organizations?: OrganizationRef;
  provider: string;
  name: string;
  status: 'active' | 'disabled' | 'error';
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error?: string | null;
  updated_at: string;
}

interface LiveWebhook {
  id: number | string;
  event_type: string;
  signature_valid: boolean;
  received_at: string;
  processed_at?: string | null;
  processing_error?: string | null;
}

interface PaymentWebhook {
  id: number | string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  signature_verified: boolean;
  received_at: string;
  processed_at?: string | null;
  processing_error?: string | null;
}

interface IntegrationStats {
  notificationPending: number;
  notificationFailed: number;
  workflowQueued: number;
  workflowFailed: number;
  integrationQueued: number;
  integrationFailed: number;
}

interface IntegrationTelemetry {
  stats: IntegrationStats;
  notifications: NotificationJob[];
  workflows: WorkflowRun[];
  deliveries: IntegrationDelivery[];
  connections: IntegrationConnection[];
  liveWebhooks: LiveWebhook[];
  paymentWebhooks: PaymentWebhook[];
}

interface QueueSummary {
  name: string;
  description: string;
  pending: number;
  failed: number;
}

const EMPTY_STATS: IntegrationStats = {
  notificationPending: 0,
  notificationFailed: 0,
  workflowQueued: 0,
  workflowFailed: 0,
  integrationQueued: 0,
  integrationFailed: 0,
};

const retryable = (status: string) => status === 'failed' || status === 'dead_letter';
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const organizationName = (organization?: OrganizationRef) => organization?.name || 'Unknown organisation';
const errorSummary = (value?: string | null) => value?.trim() || '—';

function statusVariant(status: string): 'active' | 'success' | 'warning' | 'degraded' | 'neutral' {
  if (status === 'active' || status === 'running' || status === 'processing') return 'active';
  if (status === 'completed' || status === 'delivered' || status === 'processed') return 'success';
  if (status === 'failed' || status === 'dead_letter' || status === 'error') return 'degraded';
  if (status === 'pending' || status === 'queued') return 'warning';
  return 'neutral';
}

export function IntegrationsJobs({ api }: { api: ApiClient }) {
  const [telemetry, setTelemetry] = useState<IntegrationTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeTab, setActiveTab] = useState('queues');
  const [actionTarget, setActionTarget] = useState<
    | { kind: 'retry'; queue: 'notification' | 'workflow' | 'integration'; id: number | string }
    | { kind: 'connection'; connection: IntegrationConnection; nextStatus: 'active' | 'disabled' }
    | null
  >(null);
  const [actionReason, setActionReason] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError('');
    try {
      setTelemetry(await api.request<IntegrationTelemetry>('platform-integrations'));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load system activity.');
    } finally {
      if (!background) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(async (key: string, payload: Record<string, unknown>) => {
    setBusyKey(key);
    setActionError('');
    try {
      await api.request('platform-integrations', { method: 'PATCH', body: JSON.stringify(payload) });
      await load(true);
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to complete this action.');
    } finally {
      setBusyKey('');
    }
  }, [api, load]);

  const retryJob = useCallback((queue: 'notification' | 'workflow' | 'integration', id: number | string) => {
    setActionReason('');
    setActionError('');
    setActionTarget({ kind: 'retry', queue, id });
  }, []);

  const setConnectionStatus = useCallback((connection: IntegrationConnection) => {
    setActionReason('');
    setActionError('');
    setActionTarget({
      kind: 'connection',
      connection,
      nextStatus: connection.status === 'active' ? 'disabled' : 'active',
    });
  }, []);

  const applyGovernanceAction = async () => {
    if (!actionTarget) return;
    if (actionTarget.kind === 'retry') {
      if (!actionReason.trim()) {
        setActionError('Enter an audit reason before retrying a failed job.');
        return;
      }
      await runAction(
        `retry:${actionTarget.queue}:${actionTarget.id}`,
        { action: 'retry_job', queue: actionTarget.queue, id: actionTarget.id, reason: actionReason.trim() },
      );
      setActionTarget(null);
      setActionReason('');
      return;
    }

    const disabling = actionTarget.nextStatus === 'disabled';
    if (disabling && !actionReason.trim()) {
      setActionError('Enter a governance reason before disabling this connection.');
      return;
    }
    await runAction(
      `connection:${actionTarget.connection.id}`,
      {
        action: 'set_connection_status',
        connectionId: actionTarget.connection.id,
        status: actionTarget.nextStatus,
        ...(disabling ? { reason: actionReason.trim() } : {}),
      },
    );
    setActionTarget(null);
    setActionReason('');
  };

  const stats = telemetry?.stats ?? EMPTY_STATS;
  const pendingTotal = stats.notificationPending + stats.workflowQueued + stats.integrationQueued;
  const failedTotal = stats.notificationFailed + stats.workflowFailed + stats.integrationFailed;
  const webhookTotal = (telemetry?.liveWebhooks.length ?? 0) + (telemetry?.paymentWebhooks.length ?? 0);

  const queues = useMemo<QueueSummary[]>(() => [
    { name: 'Notification delivery', description: 'Email, push, SMS, and in-app delivery work', pending: stats.notificationPending, failed: stats.notificationFailed },
    { name: 'Workflow execution', description: 'Domain automation runs', pending: stats.workflowQueued, failed: stats.workflowFailed },
    { name: 'Integration delivery', description: 'Outbound integration attempts', pending: stats.integrationQueued, failed: stats.integrationFailed },
  ], [stats]);

  if (error && !telemetry) {
    return (
      <Card title="System activity unavailable" subtitle="No runtime status is shown because current telemetry could not be loaded.">
        <div className="admin-inline-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>
        <Button variant="primary" onClick={() => void load()}>Try again</Button>
      </Card>
    );
  }

  const actionButton = (queue: 'notification' | 'workflow' | 'integration', id: number | string, status: string) => retryable(status) ? (
    <Button
      variant="outline"
      size="sm"
      loading={busyKey === `retry:${queue}:${id}`}
      onClick={() => retryJob(queue, id)}
    >
      Retry
    </Button>
  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;

  return (
    <div className="admin-page-stack">
      <div className="admin-stats-grid" aria-busy={loading}>
        <StatWidget title="Queued / running" value={loading && !telemetry ? '—' : pendingTotal} subtitle="Current work across monitored queues" trend={{ value: pendingTotal > 0 ? 'WORK PENDING' : 'CLEAR', isPositive: pendingTotal === 0 }} />
        <StatWidget title="Failed / dead letter" value={loading && !telemetry ? '—' : failedTotal} subtitle="Jobs requiring operator attention" trend={{ value: failedTotal > 0 ? 'ATTENTION' : 'CLEAR', isPositive: failedTotal === 0 }} variant={failedTotal > 0 ? 'live' : 'success'} />
        <StatWidget title="Connections" value={loading && !telemetry ? '—' : telemetry?.connections.length ?? 0} subtitle="Configured integration connections" trend={{ value: `${telemetry?.connections.filter((item) => item.status === 'active').length ?? 0} ACTIVE`, isPositive: true }} />
        <StatWidget title="Recent webhook events" value={loading && !telemetry ? '—' : webhookTotal} subtitle="Latest streaming and payment events" trend={{ value: 'LATEST 30 PER SOURCE', isPositive: true }} />
      </div>

      {error ? <div className="admin-inline-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}
      {actionError ? <div className="admin-inline-error" role="alert" style={{ marginBottom: 16 }}>{actionError}</div> : null}

      <Card
        title="Background queues & integrations"
        subtitle="Live platform telemetry; no health status is inferred by the client"
        headerAction={<Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>}
      >
        <Tabs
          tabs={[
            { key: 'queues', label: 'Queues' },
            { key: 'notifications', label: 'Notifications', count: telemetry?.notifications.length ?? 0 },
            { key: 'workflows', label: 'Workflows', count: telemetry?.workflows.length ?? 0 },
            { key: 'deliveries', label: 'Deliveries', count: telemetry?.deliveries.length ?? 0 },
            { key: 'connections', label: 'Connections', count: telemetry?.connections.length ?? 0 },
            { key: 'webhooks', label: 'Webhooks', count: webhookTotal },
          ]}
          activeKey={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'queues' ? <Table columns={[
          { header: 'QUEUE', accessor: (item) => <span><strong>{item.name}</strong><small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>{item.description}</small></span> },
          { header: 'QUEUED / RUNNING', accessor: (item) => item.pending },
          { header: 'FAILED / DEAD LETTER', accessor: (item) => item.failed },
          { header: 'STATE', accessor: (item) => <Badge label={item.failed > 0 ? 'ATTENTION' : item.pending > 0 ? 'PROCESSING' : 'CLEAR'} variant={item.failed > 0 ? 'warning' : item.pending > 0 ? 'active' : 'success'} pulse={item.pending > 0 && item.failed === 0} /> },
        ]} data={queues} keyExtractor={(item) => item.name} /> : null}

        {activeTab === 'notifications' ? <Table columns={[
          { header: 'ORGANISATION', accessor: (item) => organizationName(item.organizations) },
          { header: 'CHANNEL', accessor: (item) => item.channel },
          { header: 'STATUS', accessor: (item) => <Badge label={item.status.toUpperCase()} variant={statusVariant(item.status)} /> },
          { header: 'ATTEMPTS', accessor: (item) => item.attempts },
          { header: 'CREATED', accessor: (item) => formatDate(item.created_at) },
          { header: 'LAST ERROR', accessor: (item) => errorSummary(item.last_error) },
          { header: 'ACTION', accessor: (item) => actionButton('notification', item.id, item.status) },
        ]} data={telemetry?.notifications ?? []} keyExtractor={(item) => String(item.id)} emptyMessage="No recent notification jobs." /> : null}

        {activeTab === 'workflows' ? <Table columns={[
          { header: 'ORGANISATION', accessor: (item) => organizationName(item.organizations) },
          { header: 'WORKFLOW', accessor: (item) => item.workflow_definitions?.name || item.workflow_definitions?.code || 'Unknown workflow' },
          { header: 'STATUS', accessor: (item) => <Badge label={item.status.toUpperCase()} variant={statusVariant(item.status)} /> },
          { header: 'ATTEMPTS', accessor: (item) => item.attempts },
          { header: 'CREATED', accessor: (item) => formatDate(item.created_at) },
          { header: 'LAST ERROR', accessor: (item) => errorSummary(item.last_error) },
          { header: 'ACTION', accessor: (item) => actionButton('workflow', item.id, item.status) },
        ]} data={telemetry?.workflows ?? []} keyExtractor={(item) => item.id} emptyMessage="No recent workflow runs." /> : null}

        {activeTab === 'deliveries' ? <Table columns={[
          { header: 'ORGANISATION', accessor: (item) => organizationName(item.organizations) },
          { header: 'CONNECTION', accessor: (item) => item.integration_connections?.name || item.integration_connections?.provider || 'Unknown connection' },
          { header: 'STATUS', accessor: (item) => <Badge label={item.status.toUpperCase()} variant={statusVariant(item.status)} /> },
          { header: 'ATTEMPTS', accessor: (item) => item.attempts },
          { header: 'RESPONSE', accessor: (item) => item.response_code ?? '—' },
          { header: 'LAST ERROR', accessor: (item) => errorSummary(item.last_error) },
          { header: 'ACTION', accessor: (item) => actionButton('integration', item.id, item.status) },
        ]} data={telemetry?.deliveries ?? []} keyExtractor={(item) => String(item.id)} emptyMessage="No recent integration deliveries." /> : null}

        {activeTab === 'connections' ? <Table columns={[
          { header: 'ORGANISATION', accessor: (item) => organizationName(item.organizations) },
          { header: 'CONNECTION', accessor: (item) => <span><strong>{item.name}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{item.provider}</small></span> },
          { header: 'STATUS', accessor: (item) => <Badge label={item.status.toUpperCase()} variant={statusVariant(item.status)} /> },
          { header: 'LAST SUCCESS', accessor: (item) => formatDate(item.last_success_at) },
          { header: 'LAST ERROR', accessor: (item) => errorSummary(item.last_error) },
          { header: 'ACTION', accessor: (item) => <Button variant={item.status === 'active' ? 'danger' : 'outline'} size="sm" loading={busyKey === `connection:${item.id}`} onClick={() => setConnectionStatus(item)}>{item.status === 'active' ? 'Disable' : 'Enable'}</Button> },
        ]} data={telemetry?.connections ?? []} keyExtractor={(item) => item.id} emptyMessage="No integration connections are configured." /> : null}

        {activeTab === 'webhooks' ? (
          <div style={{ display: 'grid', gap: 24 }}>
            <Table columns={[
              { header: 'STREAMING EVENT', accessor: (item) => item.event_type },
              { header: 'SIGNATURE', accessor: (item) => <Badge label={item.signature_valid ? 'VERIFIED' : 'INVALID'} variant={item.signature_valid ? 'success' : 'degraded'} /> },
              { header: 'RECEIVED', accessor: (item) => formatDate(item.received_at) },
              { header: 'PROCESSED', accessor: (item) => formatDate(item.processed_at) },
              { header: 'ERROR', accessor: (item) => errorSummary(item.processing_error) },
            ]} data={telemetry?.liveWebhooks ?? []} keyExtractor={(item) => String(item.id)} emptyMessage="No recent streaming webhook events." />
            <Table columns={[
              { header: 'PAYMENT EVENT', accessor: (item) => <span><strong>{item.event_type}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{item.provider}</small></span> },
              { header: 'PROVIDER ID', accessor: (item) => item.provider_event_id },
              { header: 'SIGNATURE', accessor: (item) => <Badge label={item.signature_verified ? 'VERIFIED' : 'INVALID'} variant={item.signature_verified ? 'success' : 'degraded'} /> },
              { header: 'RECEIVED', accessor: (item) => formatDate(item.received_at) },
              { header: 'PROCESSED', accessor: (item) => formatDate(item.processed_at) },
              { header: 'ERROR', accessor: (item) => errorSummary(item.processing_error) },
            ]} data={telemetry?.paymentWebhooks ?? []} keyExtractor={(item) => String(item.id)} emptyMessage="No recent payment webhook events." />
          </div>
        ) : null}
      </Card>

      <Modal
        isOpen={!!actionTarget}
        onClose={() => {
          if (!busyKey) {
            setActionTarget(null);
            setActionReason('');
            setActionError('');
          }
        }}
        title={
          actionTarget?.kind === 'retry'
            ? 'Retry failed job'
            : actionTarget?.nextStatus === 'disabled'
              ? 'Disable integration connection'
              : 'Enable integration connection'
        }
        subtitle={
          actionTarget?.kind === 'connection'
            ? actionTarget.connection.name
            : actionTarget?.kind === 'retry'
              ? `${actionTarget.queue} queue · ${String(actionTarget.id)}`
              : undefined
        }
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" disabled={!!busyKey} onClick={() => setActionTarget(null)}>Cancel</Button>
            <Button
              variant={actionTarget?.kind === 'connection' && actionTarget.nextStatus === 'disabled' ? 'danger' : 'gold'}
              loading={!!busyKey}
              onClick={() => void applyGovernanceAction()}
            >
              {actionTarget?.kind === 'retry'
                ? 'Retry job'
                : actionTarget?.nextStatus === 'disabled'
                  ? 'Disable connection'
                  : 'Enable connection'}
            </Button>
          </>
        }
      >
        {actionError ? <div className="admin-inline-error" role="alert">{actionError}</div> : null}
        {actionTarget?.kind === 'retry' || actionTarget?.nextStatus === 'disabled' ? (
          <InputField
            label={actionTarget?.kind === 'retry' ? 'Audit reason' : 'Governance reason'}
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder={actionTarget?.kind === 'retry' ? 'Why should this failed job be retried?' : 'Why should this connection be disabled?'}
            helperText="This reason is recorded with the operator action."
          />
        ) : (
          <div className="admin-info-callout">Enabling the connection allows delivery attempts to resume. Existing credentials and routing remain unchanged.</div>
        )}
      </Modal>
    </div>
  );
}

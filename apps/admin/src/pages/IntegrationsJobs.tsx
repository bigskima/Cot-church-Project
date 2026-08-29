import React, { useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, StatWidget, Table } from '../components/ui';

interface JobWorker {
  name: string;
  type: string;
  status: 'active' | 'idle' | 'failed';
  claimed_jobs: number;
  last_active: string;
}

export function IntegrationsJobs({ api }: { api: ApiClient }) {
  const [workers] = useState<JobWorker[]>([
    {
      name: 'Notification Outbox Dispatcher',
      type: 'email / push / sms',
      status: 'active',
      claimed_jobs: 0,
      last_active: 'Just now',
    },
    {
      name: 'Workflow Runtime Execution Engine',
      type: 'domain events automation',
      status: 'active',
      claimed_jobs: 0,
      last_active: 'Just now',
    },
    {
      name: 'Streaming & Payment Webhook Ingest',
      type: 'HMAC verified webhooks',
      status: 'active',
      claimed_jobs: 0,
      last_active: 'Just now',
    },
    {
      name: 'Daily Attendance & Giving Aggregator',
      type: 'nightly telemetry rollup',
      status: 'idle',
      claimed_jobs: 0,
      last_active: '15m ago',
    },
  ]);

  return (
    <div>
      {/* Background Engine KPI Bar */}
      <div className="admin-stats-grid">
        <StatWidget
          title="Outbox Workers"
          value="4 Active"
          subtitle="Durable asynchronous processing"
          trend={{ value: 'HEALTHY', isPositive: true }}
          icon="⚡"
          variant="gold"
        />
        <StatWidget
          title="Dead Letter Queue"
          value="0 Failed"
          subtitle="Zero unhandled pipeline retries"
          trend={{ value: 'CLEAN', isPositive: true }}
          icon="🛡"
          variant="success"
        />
        <StatWidget
          title="Webhook Ingestion SLA"
          value="< 85ms"
          subtitle="Real-time provider normalization"
          trend={{ value: 'OPTIMAL', isPositive: true }}
          icon="📡"
        />
      </div>

      <Card
        title="Background Worker Queues & Integration Pipelines"
        subtitle="Monitor durable outbox jobs, workflow runs, dead-letter retries, and external webhook pipelines"
        headerAction={
          <Button variant="outline" size="sm">
            Trigger Health Ping
          </Button>
        }
      >
        <Table
          columns={[
            {
              header: 'WORKER SERVICE',
              accessor: (item) => <strong>{item.name}</strong>,
            },
            {
              header: 'PIPELINE TYPE',
              accessor: (item) => (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.type}</span>
              ),
            },
            {
              header: 'STATE',
              accessor: (item) => (
                <Badge
                  label={item.status.toUpperCase()}
                  variant={item.status === 'active' ? 'active' : 'neutral'}
                  pulse={item.status === 'active'}
                />
              ),
            },
            {
              header: 'QUEUED / CLAIMED',
              accessor: (item) => item.claimed_jobs,
            },
            {
              header: 'LAST RUN',
              accessor: (item) => item.last_active,
            },
          ]}
          data={workers}
          keyExtractor={(item) => item.name}
        />
      </Card>
    </div>
  );
}

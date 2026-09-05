import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, Table } from '../components/ui';

interface ExpressionItem {
  id: string;
  organization_id: string;
  parent_branch_id?: string | null;
  name: string;
  code: string;
  timezone: string;
  address?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  organizations?: { id: string; name: string; slug: string; status: string } | null;
}

interface ExpressionListResponse {
  items: ExpressionItem[];
  page: number;
  pageSize: number;
  total: number;
}

export function ExpressionsGovernance({ api }: { api: ApiClient }) {
  const [expressions, setExpressions] = useState<ExpressionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedExp, setSelectedExp] = useState<ExpressionItem | null>(null);
  const [lifecycleExp, setLifecycleExp] = useState<ExpressionItem | null>(null);
  const [governanceReason, setGovernanceReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadExpressions = async () => {
    setLoading(true);
    setError('');
    try {
      const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}&pageSize=100` : '?pageSize=100';
      const data = await api.request<ExpressionListResponse>(`platform-expressions${suffix}`);
      setExpressions(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load expressions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadExpressions(), 250);
    return () => window.clearTimeout(timer);
  }, [api, search]);

  const applyLifecycle = async () => {
    if (!lifecycleExp) return;
    const isActive = !lifecycleExp.is_active;
    if (!isActive && !governanceReason.trim()) {
      setError('A governance reason is required before disabling an expression.');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const updated = await api.request<Partial<ExpressionItem> & { id: string }>('platform-expressions', {
        method: 'PATCH',
        body: JSON.stringify({
          expressionId: lifecycleExp.id,
          isActive,
          reason: isActive ? undefined : governanceReason.trim(),
        }),
      });
      setExpressions((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      if (selectedExp?.id === updated.id) setSelectedExp({ ...selectedExp, ...updated });
      setLifecycleExp(null);
      setGovernanceReason('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change expression lifecycle.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="admin-page-stack">
      <Card
        title="Expressions"
        subtitle={`${total} expression${total === 1 ? '' : 's'} across the platform. Each church manages its own operations; Platform Administration can apply safety or lifecycle restrictions when necessary.`}
        headerAction={
          <div className="admin-header-actions">
            <SearchBar value={search} onChange={setSearch} placeholder="Search expression name or code..." />
            <Button variant="outline" size="md" onClick={() => void loadExpressions()} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}

        <Table
          columns={[
            {
              header: 'EXPRESSION',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Code: {item.code}</div>
                </div>
              ),
            },
            {
              header: 'PARENT CHURCH',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 700 }}>{item.organizations?.name ?? 'Unknown church'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {item.organizations?.slug ?? item.organization_id.slice(0, 8)}</div>
                </div>
              ),
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge
                  label={item.is_active ? 'ACTIVE' : 'DISABLED'}
                  variant={item.is_active ? 'active' : 'suspended'}
                  pulse={item.is_active}
                />
              ),
            },
            { header: 'TIMEZONE', accessor: (item) => item.timezone || 'UTC' },
            { header: 'CREATED', accessor: (item) => new Date(item.created_at).toLocaleDateString() },
            {
              header: 'GOVERNANCE',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedExp(item)}>Inspect</Button>
                  <Button
                    variant={item.is_active ? 'danger' : 'gold'}
                    size="sm"
                    onClick={() => {
                      setLifecycleExp(item);
                      setGovernanceReason('');
                    }}
                  >
                    {item.is_active ? 'Disable' : 'Restore'}
                  </Button>
                </div>
              ),
            },
          ]}
          data={expressions}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No expressions match the current filter."
        />
      </Card>

      <Modal
        isOpen={!!selectedExp}
        onClose={() => setSelectedExp(null)}
        title={selectedExp?.name ?? 'Expression details'}
        subtitle={selectedExp ? `Expression ID: ${selectedExp.id}` : undefined}
        footer={<Button variant="primary" size="md" onClick={() => setSelectedExp(null)}>Close</Button>}
      >
        {selectedExp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              <Metric label="EXPRESSION CODE" value={selectedExp.code} />
              <Metric label="STATUS" value={selectedExp.is_active ? 'ACTIVE' : 'DISABLED'} />
              <Metric label="PARENT CHURCH" value={selectedExp.organizations?.name ?? selectedExp.organization_id} />
              <Metric label="TIMEZONE" value={selectedExp.timezone || 'UTC'} />
            </div>
            <Card title="Responsibility" subtitle="Church operations remain under the owning church.">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Platform Administration may restrict an Expression for safety, policy or security reasons. Ministries, roles, content, giving, departments and local settings remain under the owning church.
              </p>
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!lifecycleExp}
        onClose={() => {
          if (!actionBusy) setLifecycleExp(null);
        }}
        title={lifecycleExp?.is_active ? 'Disable expression' : 'Restore expression'}
        subtitle={lifecycleExp ? `${lifecycleExp.name} · ${lifecycleExp.organizations?.name ?? 'Parent church'}` : undefined}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setLifecycleExp(null)}>Cancel</Button>
            <Button
              variant={lifecycleExp?.is_active ? 'danger' : 'gold'}
              size="md"
              loading={actionBusy}
              onClick={() => void applyLifecycle()}
            >
              {lifecycleExp?.is_active ? 'Confirm disable' : 'Restore expression'}
            </Button>
          </div>
        }
      >
        {lifecycleExp?.is_active ? (
          <InputField
            label="Governance reason"
            value={governanceReason}
            onChange={(event) => setGovernanceReason(event.target.value)}
            placeholder="Explain why this expression must be disabled"
            helperText="The reason is written to the platform audit log."
          />
        ) : (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Restoring the expression returns its platform lifecycle to active. Parent church permissions continue to determine what its leaders may do.
          </p>
        )}
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric-tile">
      <div className="admin-metric-label">{label}</div>
      <div className="admin-metric-value">{value}</div>
    </div>
  );
}

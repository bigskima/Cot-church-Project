import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, Table } from '../components/ui';

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  timezone: string;
  created_at: string;
  updated_at?: string;
  branches?: Array<{ count: number }>;
  memberships?: Array<{ count: number }>;
}

interface OrganizationListResponse {
  items: OrganizationItem[];
  page: number;
  pageSize: number;
  total: number;
}

export function OrganizationsGovernance({ api, canManage = false }: { api: ApiClient; canManage?: boolean }) {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);
  const [lifecycleOrg, setLifecycleOrg] = useState<OrganizationItem | null>(null);
  const [governanceReason, setGovernanceReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadOrganizations = async () => {
    setLoading(true);
    setError('');
    try {
      const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}&pageSize=100` : '?pageSize=100';
      const data = await api.request<OrganizationListResponse>(`platform-organizations${suffix}`);
      setOrganizations(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load church organisations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrganizations(), 250);
    return () => window.clearTimeout(timer);
  }, [api, search]);

  const lifecycleTarget = lifecycleOrg?.status === 'active' ? 'suspended' : 'active';

  const applyLifecycleChange = async () => {
    if (!canManage || !lifecycleOrg) return;
    if (lifecycleTarget === 'suspended' && !governanceReason.trim()) {
      setError('A governance reason is required before suspending an organisation.');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const updated = await api.request<OrganizationItem>('platform-organizations', {
        method: 'PATCH',
        body: JSON.stringify({
          organizationId: lifecycleOrg.id,
          status: lifecycleTarget,
          reason: lifecycleTarget === 'active' ? undefined : governanceReason.trim(),
        }),
      });
      setOrganizations((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      if (selectedOrg?.id === updated.id) setSelectedOrg({ ...selectedOrg, ...updated });
      setLifecycleOrg(null);
      setGovernanceReason('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change organisation lifecycle.');
    } finally {
      setActionBusy(false);
    }
  };

  const activeCount = useMemo(() => organizations.filter((item) => item.status === 'active').length, [organizations]);

  return (
    <div className="admin-page-stack">
      <Card
        title="Church organisations"
        subtitle={`${total} peer church organisation${total === 1 ? '' : 's'} · ${activeCount} active in the current result set`}
        headerAction={
          <div className="admin-header-actions">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search organisations..."
            />
            <Button variant="outline" size="md" onClick={() => void loadOrganizations()}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        <Table
          columns={[
            {
              header: 'ORGANISATION',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{item.slug}</div>
                </div>
              ),
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge
                  label={item.status.toUpperCase()}
                  variant={item.status === 'active' ? 'active' : item.status === 'suspended' ? 'suspended' : 'neutral'}
                  pulse={item.status === 'active'}
                />
              ),
            },
            { header: 'EXPRESSIONS', accessor: (item) => item.branches?.[0]?.count ?? 0 },
            { header: 'MEMBERSHIPS', accessor: (item) => item.memberships?.[0]?.count ?? 0 },
            { header: 'TIMEZONE', accessor: (item) => item.timezone || 'UTC' },
            { header: 'CREATED', accessor: (item) => new Date(item.created_at).toLocaleDateString() },
            {
              header: 'ACTIONS',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrg(item)}>
                    Inspect
                  </Button>
                  {item.status !== 'archived' ? (
                    <Button
                      variant={item.status === 'active' ? 'danger' : 'gold'}
                      size="sm"
                      onClick={() => {
                        setLifecycleOrg(item);
                        setGovernanceReason('');
                      }}
                    >
                      {item.status === 'active' ? 'Suspend' : 'Restore'}
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          data={organizations}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No church organisations match the current filter."
        />
      </Card>

      <Modal
        isOpen={!!selectedOrg}
        onClose={() => setSelectedOrg(null)}
        title={selectedOrg?.name ?? 'Organisation details'}
        subtitle={selectedOrg ? `Platform organisation ID: ${selectedOrg.id}` : undefined}
        maxWidth="lg"
        footer={<Button variant="primary" size="md" onClick={() => setSelectedOrg(null)}>Close</Button>}
      >
        {selectedOrg ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <Metric label="STATUS" value={selectedOrg.status.toUpperCase()} />
              <Metric label="EXPRESSIONS" value={String(selectedOrg.branches?.[0]?.count ?? 0)} />
              <Metric label="MEMBERSHIPS" value={String(selectedOrg.memberships?.[0]?.count ?? 0)} />
              <Metric label="TIMEZONE" value={selectedOrg.timezone || 'UTC'} />
            </div>
            <Card title="Organisation status" subtitle="Status changes are protected and recorded.">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>
                Suspending an organisation temporarily blocks its platform access while preserving its records so access can be restored later.
              </p>
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={canManage && !!lifecycleOrg}
        onClose={() => {
          if (!actionBusy) setLifecycleOrg(null);
        }}
        title={lifecycleTarget === 'suspended' ? 'Suspend church organisation' : 'Restore church organisation'}
        subtitle={lifecycleOrg ? `${lifecycleOrg.name} · /${lifecycleOrg.slug}` : undefined}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setLifecycleOrg(null)}>
              Cancel
            </Button>
            <Button
              variant={lifecycleTarget === 'suspended' ? 'danger' : 'gold'}
              size="md"
              loading={actionBusy}
              onClick={() => void applyLifecycleChange()}
            >
              {lifecycleTarget === 'suspended' ? 'Confirm suspension' : 'Restore organisation'}
            </Button>
          </div>
        }
      >
        {lifecycleTarget === 'suspended' ? (
          <InputField
            label="Governance reason"
            value={governanceReason}
            onChange={(event) => setGovernanceReason(event.target.value)}
            placeholder="Explain why this organisation is being restricted"
            helperText="This reason is written to the immutable platform audit trail."
          />
        ) : (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Restoring this organisation returns its lifecycle to active. The action is permission checked and audited.
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

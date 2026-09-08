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
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
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

export function ExpressionsGovernance({ api, canManage = false }: { api: ApiClient; canManage?: boolean }) {
  const [expressions, setExpressions] = useState<ExpressionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedExp, setSelectedExp] = useState<ExpressionItem | null>(null);
  const [lifecycleExp, setLifecycleExp] = useState<ExpressionItem | null>(null);
  const [deleteExp, setDeleteExp] = useState<ExpressionItem | null>(null);
  const [governanceReason, setGovernanceReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
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
    if (!canManage || !lifecycleExp || lifecycleExp.deleted_at) return;
    const isActive = !lifecycleExp.is_active;
    if (!isActive && !governanceReason.trim()) {
      setError('Add a reason before making this Expression unavailable.');
      return;
    }

    setActionBusy(true);
    setError('');
    setNotice('');
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
      setNotice(isActive ? 'Expression restored.' : 'Expression disabled.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to change expression lifecycle.');
    } finally {
      setActionBusy(false);
    }
  };

  const permanentlyDeleteExpression = async () => {
    if (!canManage || !deleteExp) return;
    if (deleteReason.trim().length < 3) {
      setError('Add a reason before deleting this Expression.');
      return;
    }
    if (deleteConfirmation.trim().toUpperCase() !== deleteExp.code.toUpperCase()) {
      setError('Enter the exact Expression code to confirm deletion.');
      return;
    }

    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      await api.request('platform-expressions', {
        method: 'DELETE',
        body: JSON.stringify({
          expressionId: deleteExp.id,
          reason: deleteReason.trim(),
          confirmation: deleteConfirmation.trim(),
        }),
      });
      const deletedName = deleteExp.name;
      setDeleteExp(null);
      setDeleteReason('');
      setDeleteConfirmation('');
      setSelectedExp(null);
      await loadExpressions();
      setNotice(`${deletedName} has been deleted from member-facing COT. Historical financial and audit records were preserved.`);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to delete this Expression.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="admin-page-stack">
      {notice ? (
        <div className="admin-card" style={{ padding: 14, borderColor: 'var(--admin-success, #2db783)' }}>
          <strong>{notice}</strong>
        </div>
      ) : null}

      <Card
        title="Expressions"
        subtitle={`${total} expression${total === 1 ? '' : 's'} across COT. Disable is reversible; Delete is an irreversible member-facing removal that preserves financial and audit history.`}
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
              accessor: (item) => item.deleted_at ? (
                <Badge label="DELETED" variant="suspended" />
              ) : (
                <Badge
                  label={item.is_active ? 'ACTIVE' : 'DISABLED'}
                  variant={item.is_active ? 'active' : 'warning'}
                  pulse={item.is_active}
                />
              ),
            },
            { header: 'TIMEZONE', accessor: (item) => item.timezone || 'UTC' },
            { header: 'CREATED', accessor: (item) => new Date(item.created_at).toLocaleDateString() },
            {
              header: 'ADMIN ACTIONS',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedExp(item)}>Inspect</Button>
                  {canManage && !item.deleted_at ? (
                    <>
                      <Button
                        variant={item.is_active ? 'outline' : 'gold'}
                        size="sm"
                        onClick={() => {
                          setLifecycleExp(item);
                          setGovernanceReason('');
                        }}
                      >
                        {item.is_active ? 'Disable' : 'Restore'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteExp(item);
                          setDeleteReason('');
                          setDeleteConfirmation('');
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  ) : null}
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
        subtitle={selectedExp ? `Expression reference: ${selectedExp.id}` : undefined}
        footer={<Button variant="primary" size="md" onClick={() => setSelectedExp(null)}>Close</Button>}
      >
        {selectedExp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              <Metric label="EXPRESSION CODE" value={selectedExp.code} />
              <Metric label="STATUS" value={selectedExp.deleted_at ? 'DELETED' : selectedExp.is_active ? 'ACTIVE' : 'DISABLED'} />
              <Metric label="PARENT CHURCH" value={selectedExp.organizations?.name ?? selectedExp.organization_id} />
              <Metric label="TIMEZONE" value={selectedExp.timezone || 'UTC'} />
            </div>
            {selectedExp.deleted_at ? (
              <Card title="Deleted Expression" subtitle={new Date(selectedExp.deleted_at).toLocaleString()}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {selectedExp.deletion_reason || 'This Expression was permanently removed from member-facing COT.'}
                  {' '}Historical finance and protected administration evidence remain retained.
                </p>
              </Card>
            ) : (
              <Card title="Responsibility" subtitle="Church operations remain under the owning church.">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  Platform Administration may restrict or delete an Expression for safety, policy or security reasons. Delete removes member-facing access and invalidates active invite codes while preserving protected records.
                </p>
              </Card>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={canManage && !!lifecycleExp}
        onClose={() => {
          if (!actionBusy) setLifecycleExp(null);
        }}
        title={lifecycleExp?.is_active ? 'Disable Expression' : 'Restore Expression'}
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
              {lifecycleExp?.is_active ? 'Confirm disable' : 'Restore Expression'}
            </Button>
          </div>
        }
      >
        {lifecycleExp?.is_active ? (
          <InputField
            label="Reason for this change"
            value={governanceReason}
            onChange={(event) => setGovernanceReason(event.target.value)}
            placeholder="Explain why this Expression must be disabled"
            helperText="Disable is reversible. The reason is recorded in protected administration history."
          />
        ) : (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Restoring the Expression makes it available again. This action is unavailable after permanent deletion.
          </p>
        )}
      </Modal>

      <Modal
        isOpen={canManage && !!deleteExp}
        onClose={() => {
          if (!actionBusy) {
            setDeleteExp(null);
            setDeleteReason('');
            setDeleteConfirmation('');
          }
        }}
        title="Delete Expression"
        subtitle={deleteExp ? `${deleteExp.name} · This cannot be restored through lifecycle controls.` : undefined}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setDeleteExp(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="md"
              loading={actionBusy}
              disabled={!deleteExp || deleteConfirmation.trim().toUpperCase() !== deleteExp.code.toUpperCase() || deleteReason.trim().length < 3}
              onClick={() => void permanentlyDeleteExpression()}
            >
              Delete Expression
            </Button>
          </div>
        }
      >
        {deleteExp ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="admin-card" style={{ padding: 14 }}>
              <strong>What deletion does</strong>
              <p className="admin-muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
                Members can no longer enter this Expression, active invite codes are revoked, and normal Restore is blocked.
                Financial records, audit history and other protected evidence are retained.
              </p>
            </div>
            <InputField
              label="Deletion reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Explain why this Expression must be deleted"
            />
            <InputField
              label={`Type ${deleteExp.code} to confirm`}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={deleteExp.code}
              helperText="The exact Expression code is required to prevent accidental deletion."
            />
          </div>
        ) : null}
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

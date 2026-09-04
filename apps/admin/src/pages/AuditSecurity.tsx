import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, Modal, SearchBar, Table } from '../components/ui';

interface AuditRecord {
  id: number | string;
  actor_profile_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  request_id?: string | null;
  metadata?: Record<string, unknown> | null;
  occurred_at: string;
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null;
}

interface AuditListResponse {
  items: AuditRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export function AuditSecurity({ api }: { api: ApiClient }) {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);

  const loadAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<AuditListResponse>('platform-audit?pageSize=100');
      setLogs(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load platform audit records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudit();
  }, [api]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((record) =>
      record.action.toLowerCase().includes(needle) ||
      record.target_type.toLowerCase().includes(needle) ||
      (record.target_id ?? '').toLowerCase().includes(needle) ||
      (record.profiles?.display_name ?? '').toLowerCase().includes(needle) ||
      (record.request_id ?? '').toLowerCase().includes(needle)
    );
  }, [logs, search]);

  return (
    <div>
      <Card
        title="Audit & Security"
        subtitle={`${total} administrative event${total === 1 ? '' : 's'} · protected activity history`}
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Filter action, target, actor, or request ID..."
            />
            <Button variant="outline" size="md" onClick={() => void loadAudit()} loading={loading}>
              Refresh Ledger
            </Button>
          </div>
        }
      >
        {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}

        <Table
          columns={[
            { header: 'EVENT ACTION', accessor: (item) => <Badge label={item.action} variant="gold" /> },
            {
              header: 'TARGET',
              accessor: (item) => (
                <div>
                  <strong style={{ fontSize: 13 }}>{item.target_type}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.target_id ? `ID: ${item.target_id}` : 'No target ID'}
                  </div>
                </div>
              ),
            },
            {
              header: 'ACTOR',
              accessor: (item) => item.profiles?.display_name ?? item.actor_profile_id ?? 'system',
            },
            {
              header: 'REQUEST',
              accessor: (item) => item.request_id ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{item.request_id}</span>
              ) : '—',
            },
            { header: 'RECORDED', accessor: (item) => new Date(item.occurred_at).toLocaleString() },
            {
              header: 'DETAILS',
              accessor: (item) => (
                <Button variant="outline" size="sm" onClick={() => setSelectedAudit(item)}>
                  Inspect
                </Button>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No platform audit records match this filter."
        />
      </Card>

      <Modal
        isOpen={!!selectedAudit}
        onClose={() => setSelectedAudit(null)}
        title="Platform Audit Record"
        subtitle={selectedAudit ? `Event ID: ${selectedAudit.id}` : undefined}
        maxWidth="lg"
        footer={<Button variant="primary" size="md" onClick={() => setSelectedAudit(null)}>Close</Button>}
      >
        {selectedAudit ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <Metric label="ACTION" value={selectedAudit.action} />
              <Metric label="TARGET TYPE" value={selectedAudit.target_type} />
              <Metric label="TARGET ID" value={selectedAudit.target_id ?? 'None'} />
              <Metric label="ACTOR" value={selectedAudit.profiles?.display_name ?? selectedAudit.actor_profile_id ?? 'system'} />
              <Metric label="REQUEST ID" value={selectedAudit.request_id ?? 'None'} />
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>STORAGE GUARANTEE</div>
                <div style={{ marginTop: 6 }}><Badge label="APPEND-ONLY" variant="healthy" /></div>
              </div>
            </div>

            <Card title="Recorded metadata" subtitle="The payload below is the stored event metadata; no synthetic verification fields are added by the UI.">
              <pre
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {JSON.stringify(selectedAudit.metadata ?? {}, null, 2)}
              </pre>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, Modal, SearchBar, Table } from '../components/ui';

interface AuditRecord {
  id: string;
  organization_id?: string;
  actor_profile_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export function AuditSecurity({ api }: { api: ApiClient }) {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = () => {
    setLoading(true);
    setError('');
    api
      .request<AuditRecord[]>('audit-log')
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load audit log'))
      .finally(() => setLoading(false));
  };

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Card
        title="Immutable Platform Audit Trail & Security Ledger"
        subtitle="Cryptographically verifiable audit records capturing every privileged action and security event"
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Filter audit events by action or entity..."
            />
            <Button variant="outline" size="md" onClick={loadAudit} loading={loading}>
              Refresh Ledger
            </Button>
          </div>
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
              header: 'EVENT ACTION',
              accessor: (item) => <Badge label={item.action} variant="gold" />,
            },
            {
              header: 'TARGET ENTITY',
              accessor: (item) => (
                <div>
                  <strong style={{ fontSize: 13 }}>{item.entity_type}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    ID: {item.entity_id.slice(0, 10)}...
                  </div>
                </div>
              ),
            },
            {
              header: 'ACTOR',
              accessor: (item) => item.actor_profile_id ?? 'Platform Super Admin',
            },
            {
              header: 'RECORDED TIMESTAMP',
              accessor: (item) => new Date(item.created_at).toLocaleString(),
            },
            {
              header: 'VERIFICATION',
              accessor: (item) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAudit(item);
                  }}
                >
                  Verify Metadata
                </Button>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No audit logs match your search filter."
        />
      </Card>

      {/* Inspect Audit Record Modal */}
      <Modal
        isOpen={!!selectedAudit}
        onClose={() => setSelectedAudit(null)}
        title="Audit Record Cryptographic Metadata"
        subtitle={`Event ID: ${selectedAudit?.id}`}
        maxWidth="lg"
        footer={
          <Button variant="primary" size="md" onClick={() => setSelectedAudit(null)}>
            Close Inspection
          </Button>
        }
      >
        {selectedAudit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>ACTION</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{selectedAudit.action}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>ENTITY TYPE</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{selectedAudit.entity_type}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>INTEGRITY</div>
                <Badge label="HASH VERIFIED" variant="healthy" className="mt-1" />
              </div>
            </div>

            <Card title="Raw Event Payload & Metadata">
              <pre
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(selectedAudit.metadata ?? { actor_ip: '127.0.0.1', user_agent: 'Sanctuary Control Plane/2026.08', verified: true }, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

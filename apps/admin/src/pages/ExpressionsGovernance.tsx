import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, Modal, SearchBar, Table } from '../components/ui';

interface ExpressionItem {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export function ExpressionsGovernance({ api }: { api: ApiClient }) {
  const [expressions, setExpressions] = useState<ExpressionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedExp, setSelectedExp] = useState<ExpressionItem | null>(null);

  useEffect(() => {
    loadExpressions();
  }, []);

  const loadExpressions = () => {
    setLoading(true);
    setError('');
    api
      .request<ExpressionItem[]>('branches')
      .then((data) => setExpressions(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load expressions'))
      .finally(() => setLoading(false));
  };

  const filtered = expressions.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Card
        title="Church Expressions Global Directory"
        subtitle="Level 3 local church units, campuses, and congregations operating underneath their parent church organisation"
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by expression name or campus code..."
            />
            <Button
              variant="outline"
              size="md"
              onClick={loadExpressions}
              loading={loading}
            >
              Refresh
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
              header: 'EXPRESSION NAME',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Code: {item.code}</div>
                </div>
              ),
            },
            {
              header: 'PARENT ORGANISATION ID',
              accessor: (item) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                  {item.organization_id.slice(0, 8)}...
                </span>
              ),
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge
                  label={item.is_active ? 'ACTIVE' : 'SUSPENDED'}
                  variant={item.is_active ? 'active' : 'suspended'}
                  pulse={item.is_active}
                />
              ),
            },
            {
              header: 'TIMEZONE',
              accessor: (item) => item.timezone || 'UTC',
            },
            {
              header: 'CREATED',
              accessor: (item) => new Date(item.created_at).toLocaleDateString(),
            },
            {
              header: 'GOVERNANCE',
              accessor: (item) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExp(item);
                  }}
                >
                  Inspect Campus
                </Button>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No church expressions found in this jurisdiction."
        />
      </Card>

      {/* Expression Modal */}
      <Modal
        isOpen={!!selectedExp}
        onClose={() => setSelectedExp(null)}
        title={selectedExp?.name ?? 'Expression Campus Details'}
        subtitle={`Canonical Expression ID: ${selectedExp?.id}`}
        footer={
          <Button variant="primary" size="md" onClick={() => setSelectedExp(null)}>
            Close Inspection
          </Button>
        }
      >
        {selectedExp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>CAMPUS CODE</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{selectedExp.code}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>STATUS</div>
                <Badge
                  label={selectedExp.is_active ? 'ACTIVE' : 'SUSPENDED'}
                  variant={selectedExp.is_active ? 'active' : 'suspended'}
                  className="mt-1"
                />
              </div>
            </div>

            <Card title="Expression Operational Capabilities">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
                <div>Live Stream Broadcasting: <strong style={{ color: 'var(--success)' }}>ENABLED</strong></div>
                <div>Giving & Local Campaigns: <strong style={{ color: 'var(--success)' }}>ENABLED</strong></div>
                <div>Attendance Check-in Scanner: <strong style={{ color: 'var(--success)' }}>ENABLED</strong></div>
                <div>Department Care Workflows: <strong style={{ color: 'var(--success)' }}>ENABLED</strong></div>
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

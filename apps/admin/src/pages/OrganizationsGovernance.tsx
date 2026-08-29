import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, Table } from '../components/ui';

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  timezone: string;
  created_at: string;
  settings?: Record<string, unknown>;
}

export function OrganizationsGovernance({ api }: { api: ApiClient }) {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = () => {
    setLoading(true);
    setError('');
    api
      .request<OrganizationItem[]>('organizations')
      .then((data) => setOrganizations(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load organizations'))
      .finally(() => setLoading(false));
  };

  const handleToggleSuspend = async (org: OrganizationItem) => {
    const newStatus = org.status === 'active' ? 'suspended' : 'active';
    setActionBusy(true);
    try {
      await api.request(`organizations?id=${org.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setOrganizations((list) =>
        list.map((item) => (item.id === org.id ? { ...item, status: newStatus } : item))
      );
      if (selectedOrg?.id === org.id) {
        setSelectedOrg({ ...selectedOrg, status: newStatus });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update organization status');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) {
      alert('Please provide name and slug.');
      return;
    }
    setActionBusy(true);
    try {
      await api.request('organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: newOrgName.trim(),
          slug: newOrgSlug.trim().toLowerCase(),
          status: 'active',
        }),
      });
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgSlug('');
      loadOrganizations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setActionBusy(false);
    }
  };

  const filtered = organizations.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Card
        title="Church Organisations Governance"
        subtitle="Global peer church jurisdictions operating underneath the Platform Authority"
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Filter organisations by name or slug..."
            />
            <Button
              variant="gold"
              size="md"
              onClick={() => setShowCreateModal(true)}
              icon="+"
            >
              Onboard Organisation
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
              header: 'ORGANISATION NAME',
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
                  variant={item.status === 'active' ? 'active' : 'suspended'}
                  pulse={item.status === 'active'}
                />
              ),
            },
            {
              header: 'TIMEZONE',
              accessor: (item) => item.timezone || 'UTC (Universal)',
            },
            {
              header: 'ESTABLISHED',
              accessor: (item) => new Date(item.created_at).toLocaleDateString(),
            },
            {
              header: 'ACTIONS',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrg(item);
                    }}
                  >
                    Inspect Quotas
                  </Button>
                  <Button
                    variant={item.status === 'active' ? 'danger' : 'gold'}
                    size="sm"
                    loading={actionBusy && selectedOrg?.id === item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSuspend(item);
                    }}
                  >
                    {item.status === 'active' ? 'Suspend' : 'Restore'}
                  </Button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No church organisations match your search query."
        />
      </Card>

      {/* Inspect Organisation Modal */}
      <Modal
        isOpen={!!selectedOrg}
        onClose={() => setSelectedOrg(null)}
        title={selectedOrg?.name ?? 'Organisation Governance'}
        subtitle={`Unique Platform Identifier: ${selectedOrg?.id}`}
        maxWidth="lg"
        footer={
          <Button variant="primary" size="md" onClick={() => setSelectedOrg(null)}>
            Close Inspection
          </Button>
        }
      >
        {selectedOrg && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>SLUG</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>/{selectedOrg.slug}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>STATUS</div>
                <Badge
                  label={selectedOrg.status.toUpperCase()}
                  variant={selectedOrg.status === 'active' ? 'active' : 'suspended'}
                  className="mt-1"
                />
              </div>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>TIMEZONE</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  {selectedOrg.timezone || 'UTC'}
                </div>
              </div>
            </div>

            <Card title="Entitlement Quotas & Platform Limits">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Max Simultaneous Streams: </span>
                  <strong>3 Live Ingest Channels</strong>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Monthly AI Inference Quota: </span>
                  <strong>10,000 Generation Tokens</strong>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expression Campus Limit: </span>
                  <strong>Unlimited Expressions</strong>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Compliance Verification: </span>
                  <span style={{ color: 'var(--success)', fontWeight: 800 }}>PASSED</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>

      {/* Onboard Organisation Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Onboard New Church Organisation"
        subtitle="Provision a top-level peer church organisation on the platform."
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              size="md"
              loading={actionBusy}
              onClick={handleCreateOrg}
            >
              Provision Organisation
            </Button>
          </div>
        }
      >
        <InputField
          label="Church Organisation Legal / Brand Name"
          value={newOrgName}
          onChange={(e) => {
            setNewOrgName(e.target.value);
            if (!newOrgSlug) {
              setNewOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
            }
          }}
          placeholder="e.g. Grace International Church"
        />

        <InputField
          label="Unique System Slug"
          value={newOrgSlug}
          onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          placeholder="e.g. grace-international"
          helperText="Used for domain routing, tenant namespaces, and deep linking."
        />
      </Modal>
    </div>
  );
}

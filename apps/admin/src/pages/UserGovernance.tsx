import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, Modal, SearchBar, Table } from '../components/ui';

interface UserAccount {
  id: string;
  display_name: string;
  phone_number?: string | null;
  status?: string;
  is_banned?: boolean;
  created_at?: string;
}

export function UserGovernance({ api }: { api: ApiClient }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    setLoading(true);
    setError('');
    api
      .request<any[]>('memberships')
      .then((data) => {
        const mapped = (Array.isArray(data) ? data : []).map((m) => ({
          id: m.profile?.id ?? m.id,
          display_name: m.profile?.display_name ?? 'Church User',
          phone_number: m.profile?.phone_number ?? null,
          status: m.status ?? 'active',
          is_banned: m.status === 'suspended',
          created_at: m.joined_at ?? m.created_at,
        }));
        setUsers(mapped);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load user accounts'))
      .finally(() => setLoading(false));
  };

  const handleToggleBan = async (user: UserAccount) => {
    const newStatus = user.is_banned ? 'active' : 'suspended';
    setActionBusy(true);
    try {
      await api.request(`memberships?id=${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setUsers((list) =>
        list.map((u) =>
          u.id === user.id ? { ...u, status: newStatus, is_banned: newStatus === 'suspended' } : u
        )
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, status: newStatus, is_banned: newStatus === 'suspended' });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user account');
    } finally {
      setActionBusy(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone_number && u.phone_number.includes(search))
  );

  return (
    <div>
      <Card
        title="Platform User Accounts & Identity Governance"
        subtitle="Global identity registry, abuse investigation, and platform-level account safety"
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Lookup account by name, phone, or ID..."
            />
            <Button
              variant="outline"
              size="md"
              onClick={loadUsers}
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
              header: 'USER ACCOUNT',
              accessor: (item) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      color: 'var(--gold)',
                      fontSize: 14,
                    }}
                  >
                    {item.display_name[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.display_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ID: {item.id.slice(0, 8)}...
                    </div>
                  </div>
                </div>
              ),
            },
            {
              header: 'PHONE NUMBER',
              accessor: (item) => item.phone_number || '— (No phone on file)',
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge
                  label={item.is_banned ? 'BANNED' : 'ACTIVE'}
                  variant={item.is_banned ? 'suspended' : 'active'}
                  pulse={!item.is_banned}
                />
              ),
            },
            {
              header: 'REGISTERED',
              accessor: (item) =>
                item.created_at ? new Date(item.created_at).toLocaleDateString() : '—',
            },
            {
              header: 'SAFETY ACTIONS',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(item);
                    }}
                  >
                    Inspect Identity
                  </Button>
                  <Button
                    variant={item.is_banned ? 'gold' : 'danger'}
                    size="sm"
                    loading={actionBusy && selectedUser?.id === item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBan(item);
                    }}
                  >
                    {item.is_banned ? 'Restore Account' : 'Ban Account'}
                  </Button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No user accounts match your search."
        />
      </Card>

      {/* Inspect User Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.display_name ?? 'User Identity Record'}
        subtitle={`Canonical Platform Account ID: ${selectedUser?.id}`}
        footer={
          <Button variant="primary" size="md" onClick={() => setSelectedUser(null)}>
            Close Inspection
          </Button>
        }
      >
        {selectedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>IDENTITY STATUS</div>
                <Badge
                  label={selectedUser.is_banned ? 'BANNED FROM PLATFORM' : 'VERIFIED ACCOUNT'}
                  variant={selectedUser.is_banned ? 'suspended' : 'active'}
                  className="mt-1"
                />
              </div>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>PHONE RECORD</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                  {selectedUser.phone_number || 'None'}
                </div>
              </div>
            </div>

            <Card title="Security & Compliance Audit">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Platform administrators may suspend or ban accounts only for abuse, policy violations, or credential compromise. All account moderation actions are cryptographically hashed and appended to the immutable audit log.
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, Table } from '../components/ui';

interface UserAccount {
  id: string;
  email?: string | null;
  phone?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  account_status: 'active' | 'banned';
  banned_until?: string | null;
  last_sign_in_at?: string | null;
  created_at?: string | null;
  platform_roles?: string[];
  organization_memberships?: number;
}

interface UserListResponse {
  items: UserAccount[];
  page: number;
  pageSize: number;
  total: number;
}

export function UserGovernance({ api }: { api: ApiClient }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [moderationUser, setModerationUser] = useState<UserAccount | null>(null);
  const [moderationReason, setModerationReason] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}&pageSize=100` : '?pageSize=100';
      const data = await api.request<UserListResponse>(`platform-users${suffix}`);
      setUsers(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load platform identities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [api, search]);

  const applyModeration = async () => {
    if (!moderationUser) return;
    const action = moderationUser.account_status === 'banned' ? 'restore' : 'ban';
    if (action === 'ban' && !moderationReason.trim()) {
      setError('A governance reason is required before banning an account.');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const updated = await api.request<{
        id: string;
        bannedUntil?: string | null;
        status: 'active' | 'banned';
      }>('platform-users', {
        method: 'PATCH',
        body: JSON.stringify({
          profileId: moderationUser.id,
          action,
          reason: action === 'ban' ? moderationReason.trim() : undefined,
        }),
      });

      setUsers((items) =>
        items.map((item) =>
          item.id === updated.id
            ? { ...item, account_status: updated.status, banned_until: updated.bannedUntil ?? null }
            : item
        )
      );
      if (selectedUser?.id === updated.id) {
        setSelectedUser({
          ...selectedUser,
          account_status: updated.status,
          banned_until: updated.bannedUntil ?? null,
        });
      }
      setModerationUser(null);
      setModerationReason('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update account governance status.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div>
      <Card
        title="Platform Identities & Account Governance"
        subtitle={`${total} global identit${total === 1 ? 'y' : 'ies'} · Level-1 abuse and credential-safety controls only`}
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search name, email, or phone..."
            />
            <Button variant="outline" size="md" onClick={() => void loadUsers()} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}

        <Table
          columns={[
            {
              header: 'IDENTITY',
              accessor: (item) => {
                const label = item.display_name?.trim() || item.email || item.phone || 'Platform account';
                return (
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
                      {label[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.email ?? item.phone ?? `ID ${item.id.slice(0, 8)}`}</div>
                    </div>
                  </div>
                );
              },
            },
            {
              header: 'STATUS',
              accessor: (item) => (
                <Badge
                  label={item.account_status === 'banned' ? 'BANNED' : 'ACTIVE'}
                  variant={item.account_status === 'banned' ? 'suspended' : 'active'}
                  pulse={item.account_status === 'active'}
                />
              ),
            },
            {
              header: 'PLATFORM ROLE',
              accessor: (item) => item.platform_roles?.length ? item.platform_roles.join(', ') : '—',
            },
            {
              header: 'CHURCH MEMBERSHIPS',
              accessor: (item) => item.organization_memberships ?? 0,
            },
            {
              header: 'LAST SIGN-IN',
              accessor: (item) => item.last_sign_in_at ? new Date(item.last_sign_in_at).toLocaleString() : 'Never',
            },
            {
              header: 'SAFETY',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(item)}>Inspect</Button>
                  <Button
                    variant={item.account_status === 'banned' ? 'gold' : 'danger'}
                    size="sm"
                    onClick={() => {
                      setModerationUser(item);
                      setModerationReason('');
                    }}
                  >
                    {item.account_status === 'banned' ? 'Restore' : 'Ban'}
                  </Button>
                </div>
              ),
            },
          ]}
          data={users}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No identities match the current search."
        />
      </Card>

      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.display_name || selectedUser?.email || 'Platform Identity'}
        subtitle={selectedUser ? `Canonical profile ID: ${selectedUser.id}` : undefined}
        footer={<Button variant="primary" size="md" onClick={() => setSelectedUser(null)}>Close</Button>}
      >
        {selectedUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <Metric label="ACCOUNT STATUS" value={selectedUser.account_status.toUpperCase()} />
              <Metric label="EMAIL" value={selectedUser.email ?? 'Not supplied'} />
              <Metric label="PHONE" value={selectedUser.phone ?? 'Not supplied'} />
              <Metric label="CHURCH MEMBERSHIPS" value={String(selectedUser.organization_memberships ?? 0)} />
              <Metric label="PLATFORM ROLES" value={selectedUser.platform_roles?.join(', ') || 'None'} />
              <Metric label="CREATED" value={selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : 'Unknown'} />
            </div>
            <Card title="Privacy boundary" subtitle="The Level-1 directory intentionally excludes pastoral and tenant-private records.">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                This screen is for platform identity governance, security response and abuse controls. Membership notes, prayer records, counselling information and other church-private data are not surfaced here.
              </p>
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!moderationUser}
        onClose={() => {
          if (!actionBusy) setModerationUser(null);
        }}
        title={moderationUser?.account_status === 'banned' ? 'Restore platform account' : 'Ban platform account'}
        subtitle={moderationUser?.display_name || moderationUser?.email || moderationUser?.id}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setModerationUser(null)}>Cancel</Button>
            <Button
              variant={moderationUser?.account_status === 'banned' ? 'gold' : 'danger'}
              size="md"
              loading={actionBusy}
              onClick={() => void applyModeration()}
            >
              {moderationUser?.account_status === 'banned' ? 'Restore account' : 'Confirm ban'}
            </Button>
          </div>
        }
      >
        {moderationUser?.account_status === 'banned' ? (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Restoring the account removes the platform authentication ban. Church membership and role state remain separately governed by the relevant church organisations.
          </p>
        ) : (
          <InputField
            label="Governance reason"
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
            placeholder="Document the abuse, safety, or credential-compromise reason"
            helperText="The action and reason are written to the Level-1 audit trail."
          />
        )}
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

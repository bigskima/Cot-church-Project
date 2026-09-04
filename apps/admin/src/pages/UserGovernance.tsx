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
  posting_allowed?: boolean;
  posting_restriction_reason?: string | null;
  posting_restricted_until?: string | null;
}

type GovernanceAction = 'account' | 'posting';

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
  const [moderationType, setModerationType] = useState<GovernanceAction>('account');
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
      setError(value instanceof Error ? value.message : 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [api, search]);

  const openGovernance = (user: UserAccount, type: GovernanceAction) => {
    setModerationUser(user);
    setModerationType(type);
    setModerationReason('');
  };

  const applyGovernance = async () => {
    if (!moderationUser) return;
    const isPosting = moderationType === 'posting';
    const action = isPosting
      ? moderationUser.posting_allowed === false ? 'restore_posting' : 'restrict_posting'
      : moderationUser.account_status === 'banned' ? 'restore' : 'ban';
    const restricting = action === 'ban' || action === 'restrict_posting';
    if (restricting && !moderationReason.trim()) {
      setError('Please enter a reason before applying this restriction.');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const updated = await api.request<{
        id: string;
        bannedUntil?: string | null;
        status?: 'active' | 'banned';
        postingAllowed?: boolean;
        postingRestrictionReason?: string | null;
        postingRestrictedUntil?: string | null;
      }>('platform-users', {
        method: 'PATCH',
        body: JSON.stringify({
          profileId: moderationUser.id,
          action,
          reason: restricting ? moderationReason.trim() : undefined,
        }),
      });

      setUsers((items) => items.map((item) => {
        if (item.id !== updated.id) return item;
        return {
          ...item,
          ...(updated.status ? { account_status: updated.status, banned_until: updated.bannedUntil ?? null } : {}),
          ...(updated.postingAllowed !== undefined ? {
            posting_allowed: updated.postingAllowed,
            posting_restriction_reason: updated.postingRestrictionReason ?? null,
            posting_restricted_until: updated.postingRestrictedUntil ?? null,
          } : {}),
        };
      }));
      setSelectedUser((current) => {
        if (!current || current.id !== updated.id) return current;
        return {
          ...current,
          ...(updated.status ? { account_status: updated.status, banned_until: updated.bannedUntil ?? null } : {}),
          ...(updated.postingAllowed !== undefined ? {
            posting_allowed: updated.postingAllowed,
            posting_restriction_reason: updated.postingRestrictionReason ?? null,
            posting_restricted_until: updated.postingRestrictedUntil ?? null,
          } : {}),
        };
      });
      setModerationUser(null);
      setModerationReason('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update this account.');
    } finally {
      setActionBusy(false);
    }
  };

  const actionIsRestore = moderationUser
    ? moderationType === 'posting'
      ? moderationUser.posting_allowed === false
      : moderationUser.account_status === 'banned'
    : false;

  return (
    <div>
      <Card
        title="Accounts & Access"
        subtitle={`${total} account${total === 1 ? 'y' : 'ies'} · platform-level safety and access controls`}
        headerAction={
          <div style={{ display: 'flex', gap: 12 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, or phone..." />
            <Button variant="outline" size="md" onClick={() => void loadUsers()} loading={loading}>Refresh</Button>
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
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 }}>
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
              header: 'ACCOUNT',
              accessor: (item) => <Badge label={item.account_status === 'banned' ? 'BANNED' : 'ACTIVE'} variant={item.account_status === 'banned' ? 'suspended' : 'active'} />,
            },
            {
              header: 'POSTING',
              accessor: (item) => <Badge label={item.posting_allowed === false ? 'RESTRICTED' : 'ALLOWED'} variant={item.posting_allowed === false ? 'suspended' : 'active'} />,
            },
            { header: 'PLATFORM ROLE', accessor: (item) => item.platform_roles?.length ? item.platform_roles.join(', ') : '—' },
            { header: 'CHURCH MEMBERSHIPS', accessor: (item) => item.organization_memberships ?? 0 },
            {
              header: 'SAFETY',
              accessor: (item) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(item)}>Inspect</Button>
                  <Button variant="outline" size="sm" onClick={() => openGovernance(item, 'posting')}>
                    {item.posting_allowed === false ? 'Restore posting' : 'Restrict posting'}
                  </Button>
                  <Button variant={item.account_status === 'banned' ? 'gold' : 'danger'} size="sm" onClick={() => openGovernance(item, 'account')}>
                    {item.account_status === 'banned' ? 'Restore' : 'Ban'}
                  </Button>
                </div>
              ),
            },
          ]}
          data={users}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="No accounts match the current search."
        />
      </Card>

      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.display_name || selectedUser?.email || 'Platform Account'}
        subtitle={selectedUser ? `Account ID: ${selectedUser.id}` : undefined}
        footer={<Button variant="primary" size="md" onClick={() => setSelectedUser(null)}>Close</Button>}
      >
        {selectedUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <Metric label="ACCOUNT STATUS" value={selectedUser.account_status.toUpperCase()} />
              <Metric label="POSTING" value={selectedUser.posting_allowed === false ? 'RESTRICTED' : 'ALLOWED'} />
              <Metric label="EMAIL" value={selectedUser.email ?? 'Not supplied'} />
              <Metric label="PHONE" value={selectedUser.phone ?? 'Not supplied'} />
              <Metric label="CHURCH MEMBERSHIPS" value={String(selectedUser.organization_memberships ?? 0)} />
              <Metric label="PLATFORM ROLES" value={selectedUser.platform_roles?.join(', ') || 'None'} />
            </div>
            {selectedUser.posting_allowed === false ? (
              <Card title="Posting restriction" subtitle="This is separate from an account ban.">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {selectedUser.posting_restriction_reason || 'No reason supplied.'}
                  {selectedUser.posting_restricted_until ? ` Restriction expires ${new Date(selectedUser.posting_restricted_until).toLocaleString()}.` : ''}
                </p>
              </Card>
            ) : null}
            <Card title="Privacy" subtitle="Private church and pastoral records are not shown here.">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Use this page for account safety, access and abuse controls. Membership notes, prayer records, counselling information and other private church data remain protected.
              </p>
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!moderationUser}
        onClose={() => { if (!actionBusy) setModerationUser(null); }}
        title={moderationType === 'posting'
          ? actionIsRestore ? 'Restore posting access' : 'Restrict posting access'
          : actionIsRestore ? 'Restore platform account' : 'Ban platform account'}
        subtitle={moderationUser?.display_name || moderationUser?.email || moderationUser?.id}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" size="md" disabled={actionBusy} onClick={() => setModerationUser(null)}>Cancel</Button>
            <Button variant={actionIsRestore ? 'gold' : moderationType === 'account' ? 'danger' : 'primary'} size="md" loading={actionBusy} onClick={() => void applyGovernance()}>
              {actionIsRestore ? 'Restore access' : moderationType === 'posting' ? 'Restrict posting' : 'Confirm ban'}
            </Button>
          </div>
        }
      >
        {actionIsRestore ? (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {moderationType === 'posting'
              ? 'Restoring posting allows this identity to publish again when normal church membership rules permit it.'
              : 'Restoring the account removes the platform authentication ban. Church membership and role state remain separately governed.'}
          </p>
        ) : (
          <InputField
            label="Governance reason"
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
            placeholder={moderationType === 'posting' ? 'Document the content or community guideline violation' : 'Document the abuse, safety, or credential-compromise reason'}
            helperText="The action and reason are written to the immutable Level-1 audit trail."
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

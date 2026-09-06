import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, SearchBar, Table, Toggle } from '../components/ui';

type UserAccount = {
  id: string;
  email?: string | null;
  phone?: string | null;
  display_name?: string | null;
  account_status?: 'active' | 'banned';
  platform_roles?: string[];
  organization_memberships?: number;
};

type UserListResponse = {
  items: UserAccount[];
  page: number;
  pageSize: number;
  total: number;
};

type PublicCapability = {
  code: string;
  name: string;
  description: string;
  category: string;
};

type PublicAssignment = {
  id: string;
  profile_id: string;
  permission_code: string;
  is_active: boolean;
  reason?: string | null;
  granted_at?: string | null;
  revoked_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
};

type PlatformRoleAssignment = {
  id: string;
  role_code: string;
  expires_at?: string | null;
  created_at?: string | null;
  platform_roles?: { code?: string; name?: string; description?: string } | null;
};

type AccessPayload = {
  capabilities: PublicCapability[];
  assignments: PublicAssignment[];
  platformRoles: PlatformRoleAssignment[];
};

export function RolesAccess({ api, canManage = false }: { api: ApiClient; canManage?: boolean }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected] = useState<UserAccount | null>(null);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [busyPermission, setBusyPermission] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}&pageSize=100` : '?pageSize=100';
      const data = await api.request<UserListResponse>(`platform-users${suffix}`);
      setUsers(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load COT accounts.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAccess = async (profileId: string) => {
    setLoadingAccess(true);
    setError('');
    try {
      const data = await api.request<AccessPayload>(`platform-roles-access?profileId=${encodeURIComponent(profileId)}`);
      setAccess(data);
    } catch (value) {
      setAccess(null);
      setError(value instanceof Error ? value.message : 'Unable to load roles and access for this account.');
    } finally {
      setLoadingAccess(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [api, search]);

  useEffect(() => {
    if (!selected) {
      setAccess(null);
      return;
    }
    void loadAccess(selected.id);
  }, [selected?.id, api]);

  const activeAssignments = useMemo(() => {
    const map = new Map<string, PublicAssignment>();
    for (const assignment of access?.assignments ?? []) {
      const active = assignment.is_active && (!assignment.expires_at || Date.parse(assignment.expires_at) > Date.now());
      if (active) map.set(assignment.permission_code, assignment);
    }
    return map;
  }, [access]);

  const toggleCapability = async (capability: PublicCapability, enabled: boolean) => {
    if (!selected || !canManage) return;
    setBusyPermission(capability.code);
    setError('');
    setSuccess('');
    try {
      await api.request('platform-roles-access', {
        method: 'PATCH',
        body: JSON.stringify({
          profileId: selected.id,
          permissionCode: capability.code,
          enabled,
          reason: `Updated from Platform Roles & Access: ${capability.name}`,
        }),
      });
      await loadAccess(selected.id);
      setSuccess(enabled
        ? `${capability.name} granted to ${selected.display_name || selected.email || 'this account'}.`
        : `${capability.name} revoked from ${selected.display_name || selected.email || 'this account'}.`);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update this permission.');
    } finally {
      setBusyPermission('');
    }
  };

  const selectedLabel = selected?.display_name?.trim() || selected?.email || selected?.phone || 'COT account';
  const platformRoles = access?.platformRoles ?? [];

  return (
    <div className="admin-page-stack">
      <Card
        title="Roles & Access"
        subtitle="Assign top-level public COT capabilities without mixing them with Expression roles."
        headerAction={
          <div className="admin-header-actions">
            <SearchBar value={search} onChange={setSearch} placeholder="Search account name, email, or phone..." />
            <Button variant="outline" size="md" onClick={() => void loadUsers()} loading={loadingUsers}>Refresh</Button>
          </div>
        }
      >
        {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}
        {success ? <div className="admin-form-success" role="status" style={{ marginBottom: 16 }}>{success}</div> : null}

        <Table
          columns={[
            {
              header: 'ACCOUNT',
              accessor: (item) => {
                const label = item.display_name?.trim() || item.email || item.phone || 'COT account';
                return (
                  <div className="admin-identity-cell">
                    <div className="admin-identity-avatar">{label[0]?.toUpperCase() ?? 'U'}</div>
                    <div>
                      <div className="admin-row-title">{label}</div>
                      <div className="admin-row-meta">{item.email ?? item.phone ?? `ID ${item.id.slice(0, 8)}`}</div>
                    </div>
                  </div>
                );
              },
            },
            {
              header: 'PLATFORM ADMIN',
              accessor: (item) => item.platform_roles?.length
                ? <Badge label={item.platform_roles.join(', ').toUpperCase()} variant="gold" />
                : <Badge label="NONE" variant="neutral" />,
            },
            {
              header: 'CHURCH MEMBERSHIPS',
              accessor: (item) => String(item.organization_memberships ?? 0),
            },
            {
              header: 'ACCESS',
              accessor: (item) => (
                <Button
                  variant={selected?.id === item.id ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelected(item)}
                >
                  {selected?.id === item.id ? 'Selected' : 'Manage roles'}
                </Button>
              ),
            },
          ]}
          data={users}
          keyExtractor={(item) => item.id}
          loading={loadingUsers}
          emptyMessage="No accounts match the current search."
        />
      </Card>

      {selected ? (
        <Card
          title={selectedLabel}
          subtitle="Public COT roles are global capabilities. Expression and church roles remain managed inside their own scope."
          headerAction={<Badge label={selected.account_status === 'banned' ? 'BANNED' : 'ACTIVE ACCOUNT'} variant={selected.account_status === 'banned' ? 'suspended' : 'active'} />}
        >
          {loadingAccess ? (
            <div className="admin-table-loading"><span className="admin-spinner" /><p>Loading assigned access...</p></div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                <Card title="Platform Administration" subtitle="Separate Level-1 software administration authority.">
                  {platformRoles.length ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {platformRoles.map((assignment) => (
                        <Badge
                          key={assignment.id}
                          label={assignment.platform_roles?.name || assignment.role_code}
                          variant="gold"
                        />
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No Platform Administration role assigned.</p>
                  )}
                </Card>

                <Card title="Expression roles" subtitle="Managed inside each Expression, not from this public-role control.">
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>
                    Expression leadership, publishing, groups and internal livestream permissions remain scoped to that Expression. Granting a public capability here does not unlock private Expression content.
                  </p>
                </Card>
              </div>

              <Card title="General Community capabilities" subtitle="Explicit top-level permissions for signed-in COT users.">
                <div style={{ display: 'grid', gap: 12 }}>
                  {(access?.capabilities ?? []).map((capability) => {
                    const enabled = activeAssignments.has(capability.code);
                    const busy = busyPermission === capability.code;
                    return (
                      <div
                        key={capability.code}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 16,
                          alignItems: 'center',
                          padding: 16,
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 16,
                          background: 'var(--surface-secondary)',
                          opacity: busy ? 0.7 : 1,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{capability.name}</strong>
                            <Badge label={enabled ? 'GRANTED' : 'NOT GRANTED'} variant={enabled ? 'active' : 'neutral'} />
                          </div>
                          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{capability.description}</p>
                          <div className="admin-row-meta" style={{ marginTop: 6 }}>{capability.code}</div>
                        </div>
                        <Toggle
                          label={enabled ? 'Allowed' : 'Not allowed'}
                          description={canManage ? 'Change access' : 'Read-only'}
                          checked={enabled}
                          disabled={!canManage || busy}
                          onChange={(next) => void toggleCapability(capability, next)}
                        />
                      </div>
                    );
                  })}
                  {!access?.capabilities?.length ? (
                    <div className="admin-table-empty"><p>No public COT capabilities are configured.</p></div>
                  ) : null}
                </div>
              </Card>
            </div>
          )}
        </Card>
      ) : (
        <Card title="Choose an account" subtitle="Select a person above to inspect and manage their access.">
          <div className="admin-table-empty"><p>Public and Platform roles will appear here without exposing private Expression data.</p></div>
        </Card>
      )}
    </div>
  );
}

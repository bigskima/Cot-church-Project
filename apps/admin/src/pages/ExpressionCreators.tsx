import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SelectField, Table } from '../components/ui';

type Organization = { id: string; name: string; slug: string; status: string };
type UserAccount = { id: string; email?: string | null; display_name?: string | null; account_status?: string };
type Authorization = {
  organization_id: string;
  profile_id: string;
  is_active: boolean;
  granted_at: string;
  revoked_at?: string | null;
  updated_at: string;
  email?: string | null;
  profile?: { id: string; display_name?: string | null; avatar_url?: string | null } | null;
};

type OrgResponse = { items: Organization[]; total: number };
type UserResponse = { items: UserAccount[]; total: number };

export function ExpressionCreators({ api }: { api: ApiClient }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [matches, setMatches] = useState<UserAccount[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrganizations = async () => {
    const data = await api.request<OrgResponse>('platform-organizations?pageSize=100');
    setOrganizations(data.items ?? []);
    setOrganizationId((current) => current || data.items?.find((item) => item.status === 'active')?.id || data.items?.[0]?.id || '');
  };

  const loadAuthorizations = async (orgId = organizationId) => {
    if (!orgId) {
      setAuthorizations([]);
      return;
    }
    const data = await api.request<Authorization[]>(`expression-creators?organizationId=${encodeURIComponent(orgId)}`);
    setAuthorizations(data ?? []);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadOrganizations()
      .catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Unable to load Expression creator controls.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!organizationId) return;
    void loadAuthorizations(organizationId).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load creator authorizations.'));
  }, [organizationId]);

  useEffect(() => {
    const query = email.trim();
    if (!authorizeOpen || query.length < 3) {
      setMatches([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.request<UserResponse>(`platform-users?q=${encodeURIComponent(query)}&pageSize=10`);
        setMatches(data.items ?? []);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [api, email, authorizeOpen]);

  const exactMatch = useMemo(() => {
    const normalized = email.trim().toLowerCase();
    return matches.find((item) => item.email?.toLowerCase() === normalized) ?? null;
  }, [matches, email]);

  const selectedOrg = organizations.find((item) => item.id === organizationId);

  const openAuthorize = () => {
    setEmail('');
    setMatches([]);
    setError('');
    setSuccess('');
    setAuthorizeOpen(true);
  };

  const setAuthorization = async (targetEmail: string, enabled: boolean) => {
    if (!organizationId) {
      setError('Select the church organization first.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.request('expression-creators', {
        method: 'POST',
        body: JSON.stringify({ organizationId, email: targetEmail, enabled }),
      });
      setSuccess(enabled
        ? `${targetEmail} can now create an Expression for ${selectedOrg?.name ?? 'this church'}.`
        : `Expression creation access revoked for ${targetEmail}.`);
      if (enabled) {
        setAuthorizeOpen(false);
        setEmail('');
      }
      await loadAuthorizations(organizationId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update Expression creation access.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page-stack">
      {success ? <div className="admin-status-message admin-status-success">{success}</div> : null}
      {error && !authorizeOpen ? <div className="admin-inline-error" role="alert">{error}</div> : null}

      <Card
        title="Expression creation access"
        subtitle="Choose a church, then review who Platform Authority has explicitly allowed to create new Expressions for it."
        headerAction={<div className="admin-header-actions"><Button variant="outline" size="sm" loading={loading} onClick={() => void loadAuthorizations()}>Refresh</Button><Button variant="gold" size="sm" onClick={openAuthorize} disabled={!organizationId}>Authorize user</Button></div>}
      >
        <div className="admin-filter-bar">
          <SelectField
            label="Church organization"
            value={organizationId}
            onChange={(event) => { setOrganizationId(event.target.value); setSuccess(''); setError(''); }}
            options={organizations.map((item) => ({ label: `${item.name}${item.status !== 'active' ? ` (${item.status})` : ''}`, value: item.id }))}
          />
          <div className="admin-filter-summary">
            <span className="admin-filter-summary-label">Selected church</span>
            <strong>{selectedOrg?.name ?? 'No church selected'}</strong>
            <span>{authorizations.filter((item) => item.is_active).length} active creator authorization(s)</span>
          </div>
        </div>

        <Table
          columns={[
            {
              header: 'ACCOUNT',
              accessor: (item) => (
                <div>
                  <div className="admin-row-title">{item.profile?.display_name || 'COT user'}</div>
                  <div className="admin-row-meta">{item.email || item.profile_id}</div>
                </div>
              ),
            },
            {
              header: 'ACCESS',
              accessor: (item) => <Badge label={item.is_active ? 'AUTHORIZED' : 'REVOKED'} variant={item.is_active ? 'active' : 'neutral'} />,
            },
            {
              header: 'UPDATED',
              accessor: (item) => item.is_active
                ? `Granted ${new Date(item.granted_at).toLocaleString()}`
                : item.revoked_at
                  ? `Revoked ${new Date(item.revoked_at).toLocaleString()}`
                  : 'Revoked',
            },
            {
              header: 'ACTION',
              accessor: (item) => item.is_active && item.email
                ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void setAuthorization(item.email!, false)}>Revoke</Button>
                : <span className="admin-row-meta">No action</span>,
            },
          ]}
          data={authorizations}
          keyExtractor={(item) => `${item.organization_id}:${item.profile_id}`}
          loading={loading}
          emptyMessage="No Expression creation authorizations are configured for this church."
        />
      </Card>

      <Modal
        isOpen={authorizeOpen}
        onClose={() => { if (!busy) setAuthorizeOpen(false); }}
        title="Authorize Expression creator"
        subtitle={selectedOrg ? `For ${selectedOrg.name}` : 'Select a church first'}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setAuthorizeOpen(false)}>Cancel</Button>
            <Button
              variant="gold"
              size="md"
              loading={busy}
              disabled={loading || !exactMatch || exactMatch.account_status === 'banned'}
              onClick={() => exactMatch?.email && void setAuthorization(exactMatch.email, true)}
            >
              Authorize creator
            </Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <InputField
            label="Find registered user by email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            helperText="This searches registered COT accounts. It does not send an email."
          />

          {email.trim().length >= 3 ? (
            <div className="admin-search-results">
              {searching ? (
                <div className="admin-search-result-empty">Searching registered users…</div>
              ) : matches.length ? (
                matches.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setEmail(user.email ?? '')}
                    className={`admin-search-result ${exactMatch?.id === user.id ? 'selected' : ''}`}
                  >
                    <div>
                      <div className="admin-row-title">{user.display_name || 'COT user'}</div>
                      <div className="admin-row-meta">{user.email || 'No email available'}</div>
                    </div>
                    <Badge label={(user.account_status || 'active').toUpperCase()} variant={user.account_status === 'banned' ? 'suspended' : 'active'} />
                  </button>
                ))
              ) : (
                <div className="admin-search-result-empty">No registered account matches this search.</div>
              )}
            </div>
          ) : null}

          <div className="admin-info-callout">
            {exactMatch
              ? `Ready to authorize ${exactMatch.display_name || exactMatch.email} to create an Expression for ${selectedOrg?.name ?? 'this church'}.`
              : 'Select an exact registered email result before granting access.'}
          </div>
        </div>
      </Modal>
    </div>
  );
}

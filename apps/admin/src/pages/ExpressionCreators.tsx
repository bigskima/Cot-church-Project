import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, SelectField } from '../components/ui';

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
    if (!orgId) { setAuthorizations([]); return; }
    const data = await api.request<Authorization[]>(`expression-creators?organizationId=${encodeURIComponent(orgId)}`);
    setAuthorizations(data ?? []);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([loadOrganizations()]).catch((value) => {
      if (active) setError(value instanceof Error ? value.message : 'Unable to load Expression creator controls.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!organizationId) return;
    void loadAuthorizations(organizationId).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load creator authorizations.'));
  }, [organizationId]);

  useEffect(() => {
    const query = email.trim();
    if (query.length < 3) { setMatches([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.request<UserResponse>(`platform-users?q=${encodeURIComponent(query)}&pageSize=10`);
        setMatches(data.items ?? []);
      } catch {
        setMatches([]);
      } finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [api, email]);

  const exactMatch = useMemo(() => {
    const normalized = email.trim().toLowerCase();
    return matches.find((item) => item.email?.toLowerCase() === normalized) ?? null;
  }, [matches, email]);

  const setAuthorization = async (targetEmail: string, enabled: boolean) => {
    if (!organizationId) { setError('Select the church organization first.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.request('expression-creators', {
        method: 'POST',
        body: JSON.stringify({ organizationId, email: targetEmail, enabled }),
      });
      setSuccess(enabled
        ? `${targetEmail} is now authorized to create an Expression. No invitation email was sent.`
        : `Expression-creator authorization revoked for ${targetEmail}.`);
      if (enabled) setEmail('');
      await loadAuthorizations(organizationId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update Expression creator authorization.');
    } finally { setBusy(false); }
  };

  const selectedOrg = organizations.find((item) => item.id === organizationId);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card title="Authorize Expression Creators" subtitle="Grant a registered user permission to create a new Expression. Email is used only to find the user; this action does not send an invitation or email.">
        {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 14 }}>{error}</div> : null}
        {success ? <div className="admin-status-message admin-status-success" style={{ marginBottom: 14 }}>{success}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(280px, 1.4fr)', gap: 16 }}>
          <SelectField
            label="Church Organization"
            value={organizationId}
            onChange={(event) => { setOrganizationId(event.target.value); setSuccess(''); setError(''); }}
            options={organizations.map((item) => ({ label: `${item.name}${item.status !== 'active' ? ` (${item.status})` : ''}`, value: item.id }))}
          />
          <InputField
            label="Find Registered User by Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            helperText="Searches the platform identity directory. It does not send email."
          />
        </div>

        {email.trim().length >= 3 ? (
          <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {searching ? <div style={{ padding: 14, color: 'var(--text-muted)' }}>Searching registered users…</div> : matches.length ? matches.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setEmail(user.email ?? '')}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, border: 0, borderBottom: '1px solid var(--border)', background: 'transparent', color: 'inherit', padding: 14, textAlign: 'left', cursor: 'pointer' }}
              >
                <div><div style={{ fontWeight: 800 }}>{user.display_name || 'COT User'}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email || 'No email available'}</div></div>
                <Badge label={(user.account_status || 'active').toUpperCase()} variant={user.account_status === 'banned' ? 'suspended' : 'active'} />
              </button>
            )) : <div style={{ padding: 14, color: 'var(--text-muted)' }}>No registered user matches this email search.</div>}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {exactMatch ? `Ready to authorize ${exactMatch.display_name || exactMatch.email} for ${selectedOrg?.name ?? 'this church'}.` : 'Select an exact registered email result before granting authorization.'}
          </div>
          <Button variant="gold" size="md" loading={busy} disabled={loading || !exactMatch || exactMatch.account_status === 'banned'} onClick={() => exactMatch?.email && void setAuthorization(exactMatch.email, true)}>
            Authorize Creator
          </Button>
        </div>
      </Card>

      <Card title="Current Creator Authorizations" subtitle={`Users Platform Authority has allowed to create Expressions for ${selectedOrg?.name ?? 'the selected church'}.`} headerAction={<Button variant="outline" size="sm" loading={loading} onClick={() => void loadAuthorizations()}>Refresh</Button>}>
        {authorizations.length ? <div style={{ display: 'grid', gap: 10 }}>
          {authorizations.map((item) => (
            <div key={`${item.organization_id}:${item.profile_id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.4fr) 120px minmax(180px,1fr) auto', gap: 14, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <div><div style={{ fontWeight: 800 }}>{item.profile?.display_name || 'COT User'}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.email || item.profile_id}</div></div>
              <Badge label={item.is_active ? 'AUTHORIZED' : 'REVOKED'} variant={item.is_active ? 'active' : 'neutral'} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.is_active ? `Granted ${new Date(item.granted_at).toLocaleString()}` : item.revoked_at ? `Revoked ${new Date(item.revoked_at).toLocaleString()}` : 'Revoked'}</div>
              {item.is_active && item.email ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void setAuthorization(item.email!, false)}>Revoke</Button> : <span />}
            </div>
          ))}
        </div> : <div className="admin-empty-state">No Expression creator authorizations are configured for this church.</div>}
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, SelectField, Toggle } from '../components/ui';

type Organization = { id: string; name: string; slug?: string; status: string };
type Branch = { id: string; organization_id: string; name: string; code?: string | null; is_active: boolean };
type Broadcast = {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  title: string;
  body: string;
  route?: string | null;
  is_urgent: boolean;
  expires_at?: string | null;
  created_at: string;
};
type Payload = { organizations: Organization[]; branches: Branch[]; broadcasts: Broadcast[] };

export function NotificationBroadcasts({ api }: { api: ApiClient }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState('/general/notifications');
  const [urgent, setUrgent] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === organizationId) ?? null,
    [organizations, organizationId],
  );
  const selectedBranch = useMemo(
    () => branches.find((item) => item.id === branchId) ?? null,
    [branches, branchId],
  );

  const load = async (requestedOrganizationId?: string) => {
    setLoading(true);
    setError('');
    try {
      const suffix = requestedOrganizationId ? `?organizationId=${encodeURIComponent(requestedOrganizationId)}` : '';
      const data = await api.request<Payload>(`platform-notifications${suffix}`);
      setOrganizations(data.organizations ?? []);
      setBranches(data.branches ?? []);
      setBroadcasts(data.broadcasts ?? []);
      const resolved = requestedOrganizationId
        || organizationId
        || data.organizations?.[0]?.id
        || '';
      if (resolved && resolved !== organizationId) setOrganizationId(resolved);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load notification controls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [api]);

  useEffect(() => {
    if (!organizationId) return;
    setBranchId('');
    setRoute('/general/notifications');
    void load(organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (branchId) setRoute(`/expressions/${branchId}/notifications`);
    else setRoute('/general/notifications');
  }, [branchId]);

  const send = async () => {
    if (!organizationId || !title.trim() || !body.trim()) {
      setError('Choose a church and enter both a title and message.');
      return;
    }
    setSending(true);
    setError('');
    setMessage('');
    try {
      const result = await api.request<{ broadcastId: string; recipientCount: number; scope: string; urgent: boolean }>('platform-notifications', {
        method: 'POST',
        body: JSON.stringify({
          organizationId,
          branchId: branchId || null,
          title: title.trim(),
          body: body.trim(),
          route: route.trim() || null,
          urgent,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      setMessage(`${urgent ? 'Urgent alert' : 'Notification'} published to ${result.recipientCount} account${result.recipientCount === 1 ? '' : 's'}.`);
      setTitle('');
      setBody('');
      setUrgent(false);
      setExpiresAt('');
      await load(organizationId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to publish this notification.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-page-stack">
      {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-status-message admin-status-success">{message}</div> : null}

      <Card
        title="Notification Broadcast Center"
        subtitle="Publish audited COT notices to a church or one Expression. Use Urgent only for time-sensitive service, safety or ministry-critical information."
        headerAction={<Button variant="outline" size="sm" loading={loading} onClick={() => void load(organizationId)}>Refresh</Button>}
      >
        <div className="admin-form-grid-two">
          <SelectField
            label="Church"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            options={[
              { value: '', label: 'Choose church' },
              ...organizations.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <SelectField
            label="Audience"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            options={[
              { value: '', label: 'General COT · all active church members' },
              ...branches.map((item) => ({ value: item.id, label: `Expression · ${item.name}` })),
            ]}
          />
        </div>

        <div className="admin-form-grid-two" style={{ marginTop: 16 }}>
          <InputField label="Notification title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Important service update" />
          <InputField label="Open destination" value={route} onChange={(event) => setRoute(event.target.value)} maxLength={500} helperText="Must be an internal COT route, for example /general/live." />
        </div>

        <div className="admin-form-group" style={{ marginTop: 16 }}>
          <label className="admin-form-label">Message</label>
          <textarea
            className="admin-form-input"
            value={body}
            maxLength={1200}
            rows={6}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write the exact message members should receive."
            style={{ resize: 'vertical', minHeight: 132 }}
          />
          <span className="admin-form-helper">{body.length}/1200 characters</span>
        </div>

        <div className="admin-form-grid-two" style={{ marginTop: 16 }}>
          <InputField label="Expires at (optional)" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          <Toggle
            label="Urgent delivery"
            checked={urgent}
            onChange={setUrgent}
            description="Urgent pushes may bypass quiet hours. They still respect a member turning Push Alerts or Urgent Platform Alerts off."
          />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
          <Button variant={urgent ? 'danger' : 'gold'} loading={sending} disabled={!organizationId || !title.trim() || !body.trim()} onClick={() => void send()}>
            {urgent ? 'Publish urgent alert' : 'Publish notification'}
          </Button>
          <span className="admin-row-meta">
            {selectedBranch ? `Expression: ${selectedBranch.name}` : selectedOrganization ? `General COT: ${selectedOrganization.name}` : 'Choose an audience'}
          </span>
        </div>
      </Card>

      <Card
        title="Recent broadcasts"
        subtitle="Every platform-originated broadcast remains auditable. Routine church announcements should still be published through church ministry tools."
      >
        {broadcasts.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>NOTICE</th><th>SCOPE</th><th>TYPE</th><th>PUBLISHED</th></tr></thead>
              <tbody>
                {broadcasts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="admin-row-title">{item.title}</div>
                      <div className="admin-row-meta">{item.body}</div>
                    </td>
                    <td><span className="admin-row-meta">{item.branch_id ? 'Expression' : 'General COT'}</span></td>
                    <td><Badge label={item.is_urgent ? 'URGENT' : 'INFO'} variant={item.is_urgent ? 'suspended' : 'active'} /></td>
                    <td><span className="admin-row-meta">{new Date(item.created_at).toLocaleString()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="admin-table-empty"><p>No platform notification broadcasts have been sent yet.</p></div>}
      </Card>
    </div>
  );
}

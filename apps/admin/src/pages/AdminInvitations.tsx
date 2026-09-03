import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, SelectField } from '../components/ui';

type PlatformRole = { code: string; name: string; description: string };
type AdminInvitation = {
  id: string;
  target_email: string;
  platform_role_code: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expires_at: string;
  responded_at?: string | null;
  created_at: string;
};
type Payload = { invitations: AdminInvitation[]; roles: PlatformRole[] };

export function AdminInvitations({ api }: { api: ApiClient }) {
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await api.request<Payload>('platform-admin-invitations');
      setRoles(data.roles ?? []);
      setInvitations(data.invitations ?? []);
      setRoleCode((current) => current || data.roles?.find((role) => role.code === 'admin')?.code || data.roles?.[0]?.code || '');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load administrator invitations.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [api]);

  const selectedRole = useMemo(() => roles.find((role) => role.code === roleCode) ?? null, [roles, roleCode]);

  const send = async () => {
    if (!email.trim() || !roleCode) { setError('Enter a registered user email and select the administrator role being offered.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.request('platform-admin-invitations', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), roleCode, message: customMessage.trim() }),
      });
      setSuccess(`Invitation sent to ${email.trim()} for the ${selectedRole?.name ?? roleCode} role. Authority will not be granted until they accept.`);
      setEmail(''); setCustomMessage('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to send administrator invitation.');
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.request('platform-admin-invitations', { method: 'DELETE', body: JSON.stringify({ invitationId: id }) });
      setSuccess('Pending invitation revoked.');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to revoke invitation.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Card title="Invite Platform Administrator" subtitle="Offer a specific Level-1 administration role to an existing registered user. The role is granted only after the invitee accepts in Notifications on mobile or web.">
        {error ? <div className="admin-form-error" role="alert" style={{ marginBottom: 14 }}>{error}</div> : null}
        {success ? <div className="admin-status-message admin-status-success" style={{ marginBottom: 14 }}>{success}</div> : null}
        <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(220px, 1fr)', gap: 16 }}>
          <InputField label="Registered User Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" helperText="The user must already have a COT account." />
          <SelectField label="Administrator Role Offered" value={roleCode} onChange={(event) => setRoleCode(event.target.value)} options={roles.map((role) => ({ label: role.name, value: role.code }))} />
        </div>
        {selectedRole ? <div style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>{selectedRole.description}</div> : null}
        <div className="admin-form-group">
          <label className="admin-form-label">Customized Invitation Message</label>
          <textarea className="admin-form-input" rows={4} value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Optional note explaining the role and responsibility being offered." style={{ resize: 'vertical', minHeight: 96 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="gold" size="md" loading={busy} disabled={loading || !roles.length} onClick={() => void send()}>Send Role Invitation</Button>
        </div>
      </Card>

      <Card title="Administrator Invitation Register" subtitle="Pending, accepted, declined, expired, and revoked offers. This is invitation history—not the current role assignment list." headerAction={<Button variant="outline" size="sm" loading={loading} onClick={() => void load()}>Refresh</Button>}>
        {loading ? <div className="admin-table-loading"><span className="admin-spinner" /><p>Loading invitations...</p></div> : invitations.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {invitations.map((invite) => {
              const role = roles.find((item) => item.code === invite.platform_role_code);
              return <div key={invite.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.3fr) minmax(180px,1fr) 120px auto', gap: 14, alignItems: 'center', padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
                <div><div style={{ fontWeight: 800 }}>{invite.target_email}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Created {new Date(invite.created_at).toLocaleString()}</div></div>
                <div><div style={{ fontWeight: 700 }}>{role?.name ?? invite.platform_role_code}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expires {new Date(invite.expires_at).toLocaleString()}</div></div>
                <Badge label={invite.status.toUpperCase()} variant={invite.status === 'accepted' ? 'active' : invite.status === 'pending' ? 'gold' : 'neutral'} />
                {invite.status === 'pending' ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void revoke(invite.id)}>Revoke</Button> : <span />}
              </div>;
            })}
          </div>
        ) : <div className="admin-empty-state">No administrator invitations have been created yet.</div>}
      </Card>
    </div>
  );
}

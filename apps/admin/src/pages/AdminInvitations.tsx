import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SelectField, Table } from '../components/ui';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<Payload>('platform-admin-invitations');
      setRoles(data.roles ?? []);
      setInvitations(data.invitations ?? []);
      setRoleCode((current) => current || data.roles?.find((role) => role.code === 'admin')?.code || data.roles?.[0]?.code || '');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load administrator invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [api]);

  const selectedRole = useMemo(() => roles.find((role) => role.code === roleCode) ?? null, [roles, roleCode]);

  const openCreate = () => {
    setEmail('');
    setCustomMessage('');
    setError('');
    setSuccess('');
    setRoleCode((current) => current || roles.find((role) => role.code === 'admin')?.code || roles[0]?.code || '');
    setCreateOpen(true);
  };

  const send = async () => {
    if (!email.trim() || !roleCode) {
      setError('Enter a registered user email and select the administrator role being offered.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.request('platform-admin-invitations', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), roleCode, message: customMessage.trim() }),
      });
      setCreateOpen(false);
      setSuccess(`Invitation sent to ${email.trim()} for the ${selectedRole?.name ?? roleCode} role. Authority starts only after acceptance.`);
      setEmail('');
      setCustomMessage('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to send administrator invitation.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.request('platform-admin-invitations', { method: 'DELETE', body: JSON.stringify({ invitationId: id }) });
      setSuccess('Pending invitation revoked.');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to revoke invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page-stack">
      {success ? <div className="admin-status-message admin-status-success">{success}</div> : null}
      {error && !createOpen ? <div className="admin-inline-error" role="alert">{error}</div> : null}

      <Card
        title="Administrator invitations"
        subtitle="Role offers for registered COT accounts. Permissions are granted only after the invited user accepts."
        headerAction={<div className="admin-header-actions"><Button variant="outline" size="sm" loading={loading} onClick={() => void load()}>Refresh</Button><Button variant="gold" size="sm" onClick={openCreate}>New invitation</Button></div>}
      >
        <Table
          columns={[
            {
              header: 'ACCOUNT',
              accessor: (invite) => (
                <div>
                  <div className="admin-row-title">{invite.target_email}</div>
                  <div className="admin-row-meta">Created {new Date(invite.created_at).toLocaleString()}</div>
                </div>
              ),
            },
            {
              header: 'ROLE OFFERED',
              accessor: (invite) => roles.find((item) => item.code === invite.platform_role_code)?.name ?? invite.platform_role_code,
            },
            {
              header: 'STATUS',
              accessor: (invite) => <Badge label={invite.status.toUpperCase()} variant={invite.status === 'accepted' ? 'active' : invite.status === 'pending' ? 'gold' : 'neutral'} />,
            },
            {
              header: 'EXPIRES',
              accessor: (invite) => new Date(invite.expires_at).toLocaleString(),
            },
            {
              header: 'ACTION',
              accessor: (invite) => invite.status === 'pending'
                ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void revoke(invite.id)}>Revoke</Button>
                : <span className="admin-row-meta">Closed</span>,
            },
          ]}
          data={invitations}
          keyExtractor={(invite) => invite.id}
          loading={loading}
          emptyMessage="No administrator invitations have been created yet."
        />
      </Card>

      <Modal
        isOpen={createOpen}
        onClose={() => { if (!busy) setCreateOpen(false); }}
        title="Invite Platform Administrator"
        subtitle="Offer one specific platform role to an existing registered COT account."
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="md" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="gold" size="md" loading={busy} disabled={loading || !roles.length} onClick={() => void send()}>Send invitation</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <InputField
            label="Registered user email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            helperText="The user must already have a COT account."
          />
          <SelectField
            label="Administrator role offered"
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value)}
            options={roles.map((role) => ({ label: role.name, value: role.code }))}
          />
          {selectedRole ? <div className="admin-info-callout">{selectedRole.description}</div> : null}
          <div className="admin-form-group">
            <label className="admin-form-label">Invitation message <span className="admin-optional-label">optional</span></label>
            <textarea className="admin-form-input admin-form-textarea" rows={4} value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Explain the responsibility being offered." />
          </div>
        </div>
      </Modal>
    </div>
  );
}

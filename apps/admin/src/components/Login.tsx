import React, { useState, type FormEvent } from 'react';
import { ApiClient, type ApiError, type AuthState } from '../api';
import { Button, Card, InputField } from './ui';

type PendingPlatformInvitation = {
  id: string;
  message?: string | null;
  expires_at: string;
  platform_role_code: string;
  role?: { code: string; name: string; description?: string | null } | null;
  invitedBy?: { id: string; display_name?: string | null } | null;
};

const ACCESS_POINTS = [
  {
    label: 'Administration',
    title: 'Organisations & Expressions',
    copy: 'Manage church structure and access from one trusted administration workspace.',
  },
  {
    label: 'Services',
    title: 'Services & providers',
    copy: 'Control AI, streaming, payments, integrations and feature availability from one operating surface.',
  },
  {
    label: 'Security',
    title: 'Audit-aware administration',
    copy: 'Sensitive actions are restricted by role and recorded for accountability.',
  },
];

export function Login({
  api,
  onAuthenticated,
}: {
  api: ApiClient;
  onAuthenticated: (auth: AuthState) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<AuthState | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingPlatformInvitation[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await api.request<{
        session: {
          accessToken: string;
          refreshToken?: string;
          expiresAt?: number;
          tokenType?: string;
        };
      }>('login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const provisional: AuthState = {
        accessToken: data.session.accessToken,
        refreshToken: data.session.refreshToken,
        expiresAt: data.session.expiresAt,
        tokenType: data.session.tokenType ?? 'bearer',
      };

      // Authentication alone is not enough for this surface. Resolve Platform
      // Administration authority before persisting the session.
      const platformApi = new ApiClient(() => provisional);
      try {
        await platformApi.request('platform-context');
        onAuthenticated(provisional);
      } catch (authorityError) {
        const maybeAuthorityError = authorityError as ApiError;
        if (maybeAuthorityError?.code !== 'PLATFORM_PERMISSION_DENIED') throw authorityError;
        const pending = await platformApi.request<{ invitations: PendingPlatformInvitation[] }>('platform-admin-invitations?view=pending');
        if (!pending.invitations?.length) throw authorityError;
        setPendingAuth(provisional);
        setPendingInvitations(pending.invitations);
      }
    } catch (value) {
      const maybeApiError = value as ApiError;
      if (maybeApiError?.code === 'PLATFORM_PERMISSION_DENIED') {
        setError('This account does not have access to Platform Administration.');
      } else {
        setError(value instanceof Error ? value.message : 'Unable to sign in to Platform Administration.');
      }
    } finally {
      setBusy(false);
    }
  };

  const respondToInvitation = async (invitation: PendingPlatformInvitation, decision: 'accept' | 'decline') => {
    if (!pendingAuth) return;
    setBusyInvitationId(invitation.id);
    setError('');
    setNotice('');
    try {
      const platformApi = new ApiClient(() => pendingAuth);
      await platformApi.request('platform-admin-invitations', {
        method: 'POST',
        body: JSON.stringify({ invitationId: invitation.id, decision }),
      });
      if (decision === 'accept') {
        await platformApi.request('platform-context');
        onAuthenticated(pendingAuth);
        return;
      }
      const remaining = pendingInvitations.filter((item) => item.id !== invitation.id);
      setPendingInvitations(remaining);
      setNotice('Invitation declined. No Platform Administration access was granted.');
      if (!remaining.length) {
        setPendingAuth(null);
        setPassword('');
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to respond to this invitation.');
    } finally {
      setBusyInvitationId('');
    }
  };

  return (
    <main className="platform-login-shell">
      <div className="platform-login-orb platform-login-orb-one" aria-hidden="true" />
      <div className="platform-login-orb platform-login-orb-two" aria-hidden="true" />

      <section className="platform-login-layout" aria-labelledby="platform-login-title">
        <aside className="platform-login-story">
          <div className="platform-login-story-top">
            <div className="platform-login-brand">
              <div className="platform-login-logo-shell">
                <img src="/cot-family-logo.png" alt="City of Transformation" />
              </div>
              <div>
                <p className="platform-login-kicker">City of Transformation</p>
                <p className="platform-login-product">Platform Administration</p>
              </div>
            </div>

            <div className="platform-login-hero-copy">
              <span className="platform-login-eyebrow">COT PLATFORM ADMINISTRATION</span>
              <h1>Manage the COT digital platform with clarity.</h1>
              <p>
                A focused workspace for church organisations, access, services and security
                and service readiness. Local ministry work stays inside the church and
                Expression experiences where it belongs.
              </p>
            </div>
          </div>

          <div className="platform-login-access-grid" aria-label="Administration capabilities">
            {ACCESS_POINTS.map((item) => (
              <article key={item.label} className="platform-login-access-card">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>

          <div className="platform-login-trust">
            <span className="platform-login-security-dot" aria-hidden="true" />
            <div>
              <strong>Protected administration surface</strong>
              <p>After sign-in, COT confirms that this account currently has administration access.</p>
            </div>
          </div>
        </aside>

        <section className="platform-login-panel">
          <div className="platform-login-mobile-brand" aria-hidden="true">
            <div className="platform-login-logo-shell">
              <img src="/cot-family-logo.png" alt="" />
            </div>
            <div>
              <p className="platform-login-kicker">City of Transformation</p>
              <p className="platform-login-product">Platform Administration</p>
            </div>
          </div>

          <Card className="platform-login-card" glass>
            {pendingAuth && pendingInvitations.length ? (
              <div className="platform-login-form" style={{ gap: 18 }}>
                <div className="platform-login-form-heading">
                  <span className="platform-login-form-kicker">ADMINISTRATOR INVITATION</span>
                  <h2 id="platform-login-title">Review your access offer</h2>
                  <p>Your account is verified. Accept here before Platform Administration access begins.</p>
                </div>

                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 16, background: 'var(--bg-elevated)' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: 15 }}>{invitation.role?.name || invitation.platform_role_code.replaceAll('_', ' ')}</strong>
                      <p className="admin-muted" style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.6 }}>{invitation.role?.description || 'Platform Administration access for COT digital operations.'}</p>
                    </div>
                    {invitation.message ? <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>{invitation.message}</p> : null}
                    <p className="admin-muted" style={{ margin: 0, fontSize: 11 }}>Expires {new Date(invitation.expires_at).toLocaleString()}{invitation.invitedBy?.display_name ? ` · Invited by ${invitation.invitedBy.display_name}` : ''}</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Button variant="outline" size="md" disabled={Boolean(busyInvitationId)} onClick={() => void respondToInvitation(invitation, 'decline')}>Decline</Button>
                      <Button variant="gold" size="md" loading={busyInvitationId === invitation.id} disabled={Boolean(busyInvitationId) && busyInvitationId !== invitation.id} onClick={() => void respondToInvitation(invitation, 'accept')}>Accept and continue</Button>
                    </div>
                  </div>
                ))}

                {error ? <div className="admin-inline-error platform-login-error" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div> : null}
                <Button variant="outline" size="md" disabled={Boolean(busyInvitationId)} onClick={() => { setPendingAuth(null); setPendingInvitations([]); setPassword(''); setError(''); }}>Use another account</Button>
              </div>
            ) : (
              <>
                <div className="platform-login-form-heading">
                  <span className="platform-login-form-kicker">ADMINISTRATOR SIGN IN</span>
                  <h2 id="platform-login-title">Welcome back</h2>
                  <p>Sign in with an account that has access or a pending invitation to Platform Administration.</p>
                </div>

                <form onSubmit={handleSubmit} className="platform-login-form">
              <InputField
                label="Email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={busy}
              />

              <div className="platform-login-password-wrap">
                <InputField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={busy}
                />
                <button
                  className="platform-login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={busy}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {error ? (
                <div className="admin-inline-error platform-login-error" role="alert" aria-live="polite">
                  <span aria-hidden="true">!</span>
                  <p>{error}</p>
                </div>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                loading={busy}
                disabled={!email.trim() || !password}
                type="submit"
                style={{ width: '100%' }}
              >
                Continue to Platform Administration
              </Button>
                </form>

                <div className="platform-login-form-footer">
                  <span className="platform-login-lock" aria-hidden="true">◆</span>
                  <p>
                    Your session stays protected in this browser. Administration access
                    is checked again after sign-in and while you work.
                  </p>
                </div>
              </>
            )}
          </Card>

          {notice ? <div className="admin-status-message admin-status-success" role="status">{notice}</div> : null}

          <p className="platform-login-footnote">
            This area is for COT administrators. Church and Expression leaders use their
            assigned ministry tools in the main application.
          </p>
        </section>
      </section>
    </main>
  );
}

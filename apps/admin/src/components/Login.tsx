import React, { useState, type FormEvent } from 'react';
import { ApiClient, type ApiError, type AuthState } from '../api';
import { Button, Card, InputField } from './ui';

export function Login({
  api,
  onAuthenticated,
}: {
  api: ApiClient;
  onAuthenticated: (auth: AuthState) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.request<{ session: { accessToken: string; refreshToken?: string; expiresAt?: number; tokenType?: string } }>('login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const provisional: AuthState = {
        accessToken: data.session.accessToken,
        refreshToken: data.session.refreshToken,
        expiresAt: data.session.expiresAt,
        tokenType: data.session.tokenType ?? 'bearer',
      };
      const platformApi = new ApiClient(() => provisional);
      await platformApi.request('platform-context');
      onAuthenticated(provisional);
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

  return (
    <main className="platform-login-shell">
      <section className="platform-login-panel" aria-labelledby="platform-login-title">
        <div className="platform-login-brand">
          <div className="platform-login-mark" aria-hidden="true">COT</div>
          <div>
            <p className="platform-login-kicker">City of Transformation</p>
            <h1 id="platform-login-title">Platform Administration</h1>
          </div>
        </div>

        <p className="platform-login-copy">
          Secure administration for church organisations, Expressions, platform services and governance.
        </p>

        <Card>
          <form onSubmit={handleSubmit} className="platform-login-form">
            <InputField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Administrator email"
              required
            />
            <InputField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />

            {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}

            <Button variant="primary" size="lg" loading={busy} type="submit" style={{ width: '100%' }}>
              Sign in
            </Button>
          </form>
        </Card>

        <div className="platform-login-security">
          <span className="platform-login-security-dot" aria-hidden="true" />
          <p className="platform-login-footnote">
            Access is permission-gated and administrative actions are recorded in the security audit trail.
          </p>
        </div>
      </section>
    </main>
  );
}

import React, { useState, type FormEvent } from 'react';
import { ApiClient, type ApiError, type AuthState } from '../api';
import { Button, Card, InputField } from './ui';

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
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError('');
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
            <div className="platform-login-form-heading">
              <span className="platform-login-form-kicker">ADMINISTRATOR SIGN IN</span>
              <h2 id="platform-login-title">Welcome back</h2>
              <p>Sign in with an account that currently has access to Platform Administration.</p>
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
                Your session lasts only for this browser session. Administration access
                are resolved again after sign-in.
              </p>
            </div>
          </Card>

          <p className="platform-login-footnote">
            This area is for COT administrators. Church and Expression leaders use their
            assigned ministry tools in the main application.
          </p>
        </section>
      </section>
    </main>
  );
}

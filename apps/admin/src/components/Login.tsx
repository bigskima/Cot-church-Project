import React, { useState, type FormEvent } from 'react';
import type { ApiClient, AuthState } from '../api';
import { Badge, Button, Card, InputField } from './ui';

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
      const data = await api.request<{ session: { accessToken: string } }>('login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated({ accessToken: data.session.accessToken });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to authenticate leadership session');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #16284c 0%, #040914 70%)',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))',
              borderRadius: 'var(--radius-lg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: '#040914',
              fontWeight: 900,
              boxShadow: 'var(--gold-glow)',
              marginBottom: 16,
            }}
          >
            ✦
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>Sanctuary OS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Platform Control Plane & Global Governance
          </p>
          <div style={{ marginTop: 12 }}>
            <Badge label="LEVEL 1 SUPER ADMIN" variant="gold" />
          </div>
        </div>

        {/* Login Card */}
        <Card glass>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <InputField
              label="Administrative Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="platform.admin@church.org"
              required
            />

            <InputField
              label="Master Access Credential"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••"
              required
            />

            {error ? (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  color: '#FCA5A5',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 18,
                }}
              >
                {error}
              </div>
            ) : null}

            <Button
              variant="gold"
              size="lg"
              loading={busy}
              type="submit"
              style={{ width: '100%' }}
            >
              Sign In to Sanctuary Control Plane ➔
            </Button>
          </form>
        </Card>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 20,
          }}
        >
          Protected by Platform Security Authority. All access attempts logged.
        </p>
      </div>
    </main>
  );
}

import React, { useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, StatWidget, Table } from '../components/ui';

export function PaymentInfrastructure({ api }: { api: ApiClient }) {
  const [paymentAdapters] = useState([
    {
      code: 'stripe',
      name: 'Stripe Payment Gateway Adapter',
      status: 'active',
      currencies: ['USD', 'GBP', 'EUR', 'CAD', 'AUD'],
      secret_reference: 'STRIPE_SECRET_KEY',
      webhook_secret_reference: 'STRIPE_WEBHOOK_SIGNING_SECRET',
      capabilities: ['cards', 'apple_pay', 'google_pay', 'refunds', 'reconciliation'],
    },
    {
      code: 'paystack',
      name: 'Paystack Payment Gateway Adapter (Standby)',
      status: 'standby',
      currencies: ['NGN', 'GHS', 'ZAR', 'KES'],
      secret_reference: 'PAYSTACK_SECRET_KEY',
      webhook_secret_reference: 'PAYSTACK_WEBHOOK_SECRET',
      capabilities: ['cards', 'bank_transfer', 'ussd', 'mobile_money'],
    },
  ]);

  return (
    <div>
      {/* KPI Stats Grid */}
      <div className="admin-stats-grid">
        <StatWidget
          title="Active Payment Adapters"
          value="Stripe & Paystack"
          subtitle="Multi-currency gateway mesh"
          trend={{ value: 'ACTIVE', isPositive: true }}
          icon="💳"
          variant="gold"
        />
        <StatWidget
          title="Webhook Ledger SLA"
          value="100% Idempotent"
          subtitle="Cryptographic HMAC validation"
          trend={{ value: 'SECURE', isPositive: true }}
          icon="🛡"
          variant="success"
        />
        <StatWidget
          title="Reconciliation Engine"
          value="Real-Time"
          subtitle="Zero frontend callback trust"
          trend={{ value: 'STRICT', isPositive: true }}
          icon="⚖️"
        />
      </div>

      {/* Payment Gateway Adapters Cards */}
      <Card
        title="Configured Payment Gateway Adapters"
        subtitle="Provider-agnostic payment processing with isolated secret vaults and settlement webhook routers"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {paymentAdapters.map((p) => (
            <div
              key={p.code}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900 }}>{p.name}</h4>
                <Badge
                  label={p.status.toUpperCase()}
                  variant={p.status === 'active' ? 'active' : 'neutral'}
                  pulse={p.status === 'active'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 14 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>API Secret Vault: </span>
                  <code style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{p.secret_reference}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Webhook Vault: </span>
                  <code style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>{p.webhook_secret_reference}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Supported Currencies: </span>
                  <strong>{p.currencies.join(', ')}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {p.capabilities.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: 'var(--bg-card)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>

              <Button variant="outline" size="sm" style={{ width: '100%' }}>
                Manage Settlement Credentials
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Security & Idempotency Safeguards */}
      <Card title="Financial Tenancy & Cryptographic Verification Directives">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          All giving donations and transactions require server-side signature verification and immutable idempotency ledgering. Platform administrators manage payment infrastructure and settlement health, while local church finance leads oversee expression-level campaigns and stewardship reports.
        </div>
      </Card>
    </div>
  );
}
